import os, io, base64, sqlite3, uuid, hashlib, json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import requests

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

GOOGLE_AI_API_KEY  = os.getenv("GOOGLE_AI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
if GOOGLE_AI_API_KEY:
    genai.configure(api_key=GOOGLE_AI_API_KEY)

DATABASE = os.path.join(os.path.dirname(__file__), "voicelearn.db")

# ── DB helpers ────────────────────────────────────────────────────────────────
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(e):
    db = getattr(g, "_database", None)
    if db: db.close()

def init_db():
    with app.app_context():
        db = sqlite3.connect(DATABASE)
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id           TEXT PRIMARY KEY,
            username     TEXT UNIQUE NOT NULL,
            password     TEXT NOT NULL,
            full_name    TEXT NOT NULL,
            email        TEXT,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login   TIMESTAMP,
            total_sessions INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS user_progress (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      TEXT NOT NULL,
            course_id    TEXT NOT NULL,
            topic        TEXT NOT NULL,
            listened_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, course_id, topic),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_results (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            course_id   TEXT NOT NULL,
            score       INTEGER NOT NULL,
            total       INTEGER NOT NULL,
            percentage  REAL NOT NULL,
            taken_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS chat_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            page       TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS voice_activity (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      TEXT NOT NULL,
            transcript   TEXT NOT NULL,
            response     TEXT NOT NULL,
            command_type TEXT,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS page_visits (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    TEXT NOT NULL,
            page       TEXT NOT NULL,
            visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """)
        db.commit()
        db.close()
    print("✅ Database initialized:", DATABASE)

def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()

def get_user_from_token(token):
    if not token: return None
    db = get_db()
    sess = db.execute(
        "SELECT s.user_id, u.username, u.full_name FROM sessions s "
        "JOIN users u ON u.id = s.user_id "
        "WHERE s.id = ? AND s.expires_at > ?",
        (token, datetime.now().isoformat())
    ).fetchone()
    return dict(sess) if sess else None

# ── TTS ───────────────────────────────────────────────────────────────────────
def tts_elevenlabs(text):
    if not ELEVENLABS_API_KEY: return None
    try:
        r = requests.post(
            "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
            json={"text": text, "model_id": "eleven_turbo_v2",
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.85}},
            headers={"xi-api-key": ELEVENLABS_API_KEY, "Accept": "audio/mpeg",
                     "Content-Type": "application/json"},
            timeout=15
        )
        if r.status_code == 200:
            return base64.b64encode(r.content).decode()
    except: pass
    return None

def tts_gtts(text):
    try:
        from gtts import gTTS
        buf = io.BytesIO()
        gTTS(text=text, lang="en", slow=False).write_to_fp(buf)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except: return None

def generate_tts(text):
    if not text: return None
    clean = text.replace("*","").replace("#","").replace("`","").replace("_"," ").strip()
    audio = tts_elevenlabs(clean)
    if audio: return audio
    return tts_gtts(clean)

# ── AI ────────────────────────────────────────────────────────────────────────
def get_ai_response(message, context, history, user_name="friend"):
    current_course = context.get("currentCourse")
    current_page   = context.get("currentPage", "home")

    course_info = ""
    if current_course:
        c = next((x for x in COURSES if x["id"] == current_course), None)
        if c:
            course_info = f"User is studying: {c['title']}. Topics: {', '.join(c['topics'])}."

    prompt = f"""You are VoiceLearn Assistant, a warm, encouraging AI tutor for visually impaired learners.
The user's name is {user_name}. Address them by name occasionally.

CRITICAL RULES — response is read aloud by text-to-speech:
- Write ONLY in natural conversational spoken English
- NEVER use asterisks, hashtags, bullet dashes, markdown, or symbols
- Use "first", "second", "third" instead of numbered lists
- Keep responses concise: 2 to 5 sentences maximum
- Be warm, patient, and encouraging always
- If user gives a navigation command like "go to courses" or "open python", acknowledge it

Current page: {current_page}
{course_info}

Available courses: Python for Beginners, Web Development, Data Science, English Communication, Digital Literacy, Mindfulness.
Help users navigate, explain concepts, encourage during quizzes, and answer questions conversationally."""

    if not GOOGLE_AI_API_KEY:
        return "I cannot connect to the AI service right now. Please check the API key configuration."

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        gem_history = []
        for m in history[-8:]:
            role = "user" if m["role"] == "user" else "model"
            gem_history.append({"role": role, "parts": [m["content"]]})
        chat = model.start_chat(history=gem_history)
        full = f"{prompt}\n\nUser: {message}" if not gem_history else message
        return chat.send_message(full).text.strip()
    except Exception as e:
        print("Gemini error:", e)
        return f"I am sorry {user_name}, I had trouble with that. Please try again."

# ── Course data ───────────────────────────────────────────────────────────────
COURSES = [
    {
        "id": "python-basics", "title": "Python for Beginners",
        "description": "Learn Python programming from scratch with audio lessons.",
        "category": "Programming", "level": "Beginner", "duration": "8 hours", "lessons": 24,
        "topics": ["Variables and Data Types","Control Flow: if, else, loops","Functions and Modules","Lists, Tuples, and Dictionaries","File Handling","Introduction to OOP"],
        "lessonContent": {
            "Variables and Data Types": "In Python, a variable is like a labeled box where you store information. You can store numbers, text, or more complex data. For example, you can write name equals Alice to store the text Alice. Python automatically figures out the type of data you are storing. Numbers without decimals are called integers. Numbers with decimals are called floats. Text is called a string, and True or False values are called booleans.",
            "Control Flow: if, else, loops": "Control flow lets your program make decisions. An if statement checks a condition and runs code only if that condition is true. For example, if temperature is greater than 30, print It is hot. The else clause handles when the condition is false. Loops repeat code. A for loop repeats a fixed number of times, while a while loop repeats as long as a condition remains true.",
            "Functions and Modules": "A function is a reusable block of code that performs a specific task. You define a function using the def keyword, give it a name, and list any inputs called parameters. You call a function by writing its name followed by parentheses. Modules are files containing related functions and variables that you can import into your program using the import statement.",
            "Lists, Tuples, and Dictionaries": "Lists store multiple items in order and you can change them. Tuples also store items in order but cannot be changed after creation. Dictionaries store key-value pairs like a real dictionary where each word has a definition. You access dictionary values using their keys rather than numeric positions.",
            "File Handling": "Python can read from and write to files on your computer. You open a file using the open function, specifying the file name and mode. Use r for reading, w for writing, or a for appending. Always close files after use, or use a with statement which closes the file automatically.",
            "Introduction to OOP": "Object-Oriented Programming organizes code around objects that combine data and behavior. A class is a blueprint for creating objects. Each object created from a class is called an instance. Objects have attributes which are their data, and methods which are their behaviors. OOP helps you write cleaner and more reusable code.",
        },
    },
    {
        "id": "web-basics", "title": "Web Development Fundamentals",
        "description": "Understand how the web works with audio explanations of HTML, CSS and JavaScript.",
        "category": "Web Development", "level": "Beginner", "duration": "10 hours", "lessons": 30,
        "topics": ["How the Internet Works","HTML Structure and Semantics","CSS Styling Basics","JavaScript Fundamentals","DOM Manipulation","Responsive Design Principles"],
        "lessonContent": {
            "How the Internet Works": "The internet is a global network of computers communicating using agreed-upon rules called protocols. When you visit a website, your browser sends a request to a server which stores the website files. The server sends back the files and your browser displays them. This exchange uses a protocol called HTTP or its secure version HTTPS. Domain names are translated to numeric IP addresses by a system called DNS.",
            "HTML Structure and Semantics": "HTML stands for HyperText Markup Language. It provides the structure and content of web pages using elements called tags. The html tag wraps the entire page. The head tag contains metadata. The body tag contains visible content. Semantic tags like header, nav, main, article, and footer give meaning to your content helping screen readers understand the page structure.",
            "CSS Styling Basics": "CSS stands for Cascading Style Sheets. It controls how HTML elements look on screen. You write CSS rules that select elements and apply styles. A rule has a selector which targets elements and declarations inside curly braces. Each declaration has a property and a value. For example, color colon blue sets text color to blue.",
            "JavaScript Fundamentals": "JavaScript makes web pages interactive. It runs in your browser and responds to user actions. Variables store data. Functions group reusable code. Conditional statements make decisions. Loops repeat actions. JavaScript can change page content dynamically and communicate with servers to load new data without refreshing the page.",
            "DOM Manipulation": "The DOM or Document Object Model is a programming interface that represents your HTML page as a tree of objects. JavaScript uses the DOM to access and change page content, structure, and styles. You can find elements using getElementById or querySelector and change their text, attributes, and styles.",
            "Responsive Design Principles": "Responsive design means your website looks and works well on screens of all sizes. You achieve this using flexible layouts with percentages, CSS media queries that apply different styles at different screen sizes, and flexible images that scale down when needed. The mobile-first approach means designing for small screens first then enhancing for larger screens.",
        },
    },
    {
        "id": "data-science-intro", "title": "Data Science Essentials",
        "description": "Explore data science through audio explanations of statistics and machine learning.",
        "category": "Data Science", "level": "Intermediate", "duration": "12 hours", "lessons": 36,
        "topics": ["Introduction to Data Science","Statistics Fundamentals","Data Collection and Cleaning","Exploratory Data Analysis","Machine Learning Basics","Data Visualization Concepts"],
        "lessonContent": {
            "Introduction to Data Science": "Data science is the practice of extracting knowledge and insights from data. It combines statistics, programming, and domain expertise. A data scientist collects data, cleans it, analyzes it to find patterns, builds predictive models, and communicates findings. Data science is used in healthcare to predict diseases, in finance to detect fraud, and in marketing to understand customers.",
            "Statistics Fundamentals": "Statistics is the science of collecting, analyzing, and interpreting data. Descriptive statistics summarize data. The mean is the average, the median is the middle value, and the mode is the most frequent value. The standard deviation measures how spread out data is. Inferential statistics use samples to draw conclusions about larger populations.",
            "Data Collection and Cleaning": "Data collection involves gathering information from databases, surveys, sensors, or web scraping. Raw data is rarely perfect. Data cleaning removes duplicates, handles missing values, corrects errors, and standardizes formats. This step is crucial because poor quality data leads to unreliable results.",
            "Exploratory Data Analysis": "Exploratory Data Analysis is the process of examining a dataset to understand its characteristics before formal modeling. You look at distributions to see how values are spread, identify outliers which are extreme values, discover correlations between variables, and spot patterns that guide your analysis.",
            "Machine Learning Basics": "Machine learning teaches computers to learn from data without being explicitly programmed for every situation. Supervised learning trains models on labeled examples to make predictions. Unsupervised learning finds patterns in unlabeled data. Common algorithms include linear regression for predicting continuous values and classification for predicting categories.",
            "Data Visualization Concepts": "Data visualization represents data graphically to make it easier to understand. Bar charts compare quantities across categories. Line charts show trends over time. Scatter plots reveal relationships between two variables. Good visualizations are clear, accurate, and tell a compelling story about your data.",
        },
    },
    {
        "id": "english-communication", "title": "Effective English Communication",
        "description": "Master spoken and written English with immersive audio lessons.",
        "category": "Language", "level": "All Levels", "duration": "6 hours", "lessons": 18,
        "topics": ["Pronunciation and Clarity","Grammar Essentials","Vocabulary Building","Formal vs Informal Communication","Writing Clear Sentences","Public Speaking Confidence"],
        "lessonContent": {
            "Pronunciation and Clarity": "Clear pronunciation means producing sounds accurately so listeners understand you easily. Focus on vowel sounds which are often most challenging across languages. Pay attention to word stress. In English certain syllables are emphasized more than others. Speak at a moderate pace neither too fast nor too slow. Record yourself and listen back to identify areas for improvement.",
            "Grammar Essentials": "Grammar is the set of rules governing how words combine to form sentences. A sentence needs a subject which is the doer of the action, and a verb which is the action itself. Tense indicates when the action happens whether past, present, or future. Articles like a, an, and the come before nouns. Prepositions like in, on, at, and by show relationships between words.",
            "Vocabulary Building": "A rich vocabulary helps you express ideas precisely and understand others clearly. The most effective way to build vocabulary is through reading widely and encountering words in context. When you meet a new word, note its meaning and how it is used in a sentence. Use new words in your own speaking and writing to cement them in memory.",
            "Formal vs Informal Communication": "Formal communication uses complete sentences, correct grammar, professional vocabulary, and a respectful tone. You use it in job interviews, business emails, academic writing, and official presentations. Informal communication is relaxed and conversational. Knowing which style to use in which situation is a key communication skill.",
            "Writing Clear Sentences": "Clear sentences are short, direct, and say exactly what you mean. Use active voice rather than passive voice when possible. One idea per sentence reduces confusion. Avoid unnecessary words and jargon. Read your writing aloud to hear whether it sounds natural. If you stumble while reading, your reader will likely struggle too.",
            "Public Speaking Confidence": "Confidence in public speaking comes from preparation, practice, and the right mindset. Know your material thoroughly so you can speak without reading from notes. Breathe deeply before you begin to calm nerves. Speak more slowly than feels natural as nervousness tends to speed up our speech.",
        },
    },
    {
        "id": "digital-literacy", "title": "Digital Literacy for Everyone",
        "description": "Navigate the digital world confidently through audio guidance.",
        "category": "Technology", "level": "Beginner", "duration": "5 hours", "lessons": 15,
        "topics": ["Using a Smartphone Effectively","Internet Safety and Privacy","Email Communication","Cloud Storage and File Management","Online Shopping Safely","Social Media Basics"],
        "lessonContent": {
            "Using a Smartphone Effectively": "A smartphone is a powerful computer that fits in your pocket. The touchscreen lets you interact by tapping, swiping, and pinching. Apps are programs you install to do specific things. Assistive features like text-to-speech, voice control, and screen magnification make smartphones accessible to everyone.",
            "Internet Safety and Privacy": "Staying safe online requires awareness and good habits. Use strong unique passwords for each account and consider a password manager. Enable two-factor authentication for important accounts. Be cautious of phishing emails pretending to be from trusted companies. Never share personal information unless certain of the recipient's identity.",
            "Email Communication": "Email is electronic mail that travels instantly across the internet. An email has a recipient address, a subject line summarizing the message, and the body where you write your message. You can attach files like documents and photos. Be cautious of unexpected attachments or links even from known senders.",
            "Cloud Storage and File Management": "Cloud storage saves your files on remote servers accessible from any device with internet. Services like Google Drive and Dropbox automatically back up your files so you never lose them. You can share files with others and control whether they can view or edit. Organize files in clearly named folders so you can find things easily.",
            "Online Shopping Safely": "Look for the padlock symbol and HTTPS in the website address before entering payment information. Use credit cards rather than debit cards for better fraud protection. Read seller reviews before purchasing. Be aware of deals that seem too good to be true as they often are.",
            "Social Media Basics": "Social media platforms let you connect with others, share content, and discover news and ideas. Control your privacy settings to choose who sees your posts. Think before you post as content can spread widely and remain online for years. Take regular breaks as social media can be designed to be addictive.",
        },
    },
    {
        "id": "mindfulness-wellbeing", "title": "Mindfulness and Mental Wellbeing",
        "description": "Audio-guided mindfulness, stress management, and mental health practices.",
        "category": "Wellness", "level": "All Levels", "duration": "4 hours", "lessons": 12,
        "topics": ["Introduction to Mindfulness","Breathing Techniques","Managing Stress and Anxiety","Sleep Hygiene","Building Positive Habits","Emotional Intelligence"],
        "lessonContent": {
            "Introduction to Mindfulness": "Mindfulness is the practice of paying attention to the present moment with openness and without judgment. When you are mindful you notice your thoughts, feelings, and sensations without getting swept away. Regular mindfulness practice reduces stress, improves focus, and increases emotional wellbeing. You can practice anywhere while eating, walking, or simply sitting quietly.",
            "Breathing Techniques": "Your breath is always with you and is a powerful tool for calming your mind and body. Diaphragmatic or belly breathing means expanding your belly as you inhale deeply then contracting as you exhale. The four-seven-eight technique involves inhaling for four counts, holding for seven counts, and exhaling for eight counts which activates your relaxation response.",
            "Managing Stress and Anxiety": "Stress is a normal response to challenging situations but chronic stress harms your health. Recognize your personal stress triggers and early warning signs in your body. Regular physical activity, adequate sleep, and social connection all buffer against stress. When anxious thoughts arise challenge them by asking whether the worry is realistic.",
            "Sleep Hygiene": "Quality sleep is essential for physical health, emotional regulation, memory, and cognitive function. Maintain a consistent sleep schedule going to bed and waking at the same time daily. Create a relaxing bedtime routine to signal to your body that sleep is coming. Avoid screens for at least an hour before bed as blue light interferes with melatonin production.",
            "Building Positive Habits": "Habits are automatic behaviors triggered by specific cues. To build a positive habit identify a clear cue, define the simplest possible version of the habit, and link it to an immediate reward. Start smaller than you think necessary. Two minutes of exercise beats no exercise at all. Stack new habits onto existing routines.",
            "Emotional Intelligence": "Emotional intelligence is the ability to recognize, understand, manage, and effectively express your own emotions and to recognize and respond to the emotions of others. Self-awareness means noticing your emotional states and their triggers. Self-regulation means managing your emotional responses thoughtfully rather than reacting impulsively.",
        },
    },
]

QUIZ_BANK = {
    "python-basics": [
        {"question": "In Python, what is the correct way to store the text Hello World in a variable called greeting?", "options": ["greeting = Hello World","greeting = 'Hello World'","var greeting = 'Hello World'","greeting := 'Hello World'"], "answer": 1, "explanation": "In Python text strings must be enclosed in quotes. So you write greeting equals Hello World with quotes around the text."},
        {"question": "Which loop repeats as long as a condition remains true?", "options": ["for loop","if statement","while loop","def statement"], "answer": 2, "explanation": "A while loop continues as long as its condition is true. A for loop repeats a specific number of times."},
        {"question": "What keyword creates a function in Python?", "options": ["function","func","def","create"], "answer": 2, "explanation": "The def keyword, short for define, is used to create functions in Python."},
        {"question": "Which data structure stores items as key-value pairs?", "options": ["List","Tuple","Dictionary","String"], "answer": 2, "explanation": "A dictionary stores key-value pairs, similar to a real dictionary where each word has a definition."},
        {"question": "What does OOP stand for?", "options": ["Open Output Processing","Object-Oriented Programming","Ordered Operation Protocol","Online Open Platform"], "answer": 1, "explanation": "OOP stands for Object-Oriented Programming, organizing code around objects that combine data and behaviors."},
    ],
    "web-basics": [
        {"question": "What does HTML stand for?", "options": ["Hyper Text Markup Language","High Tech Modern Language","Hyper Transfer Method Link","Home Tool Markup Language"], "answer": 0, "explanation": "HTML stands for HyperText Markup Language, providing structure and content for web pages."},
        {"question": "What is CSS used for?", "options": ["Server-side logic","Controlling how pages look","Managing databases","User authentication"], "answer": 1, "explanation": "CSS, Cascading Style Sheets, controls the visual appearance of web pages including colors, fonts, and layout."},
        {"question": "What does DOM stand for?", "options": ["Digital Output Manager","Document Object Model","Data Operations Module","Dynamic Online Method"], "answer": 1, "explanation": "DOM stands for Document Object Model, representing your HTML page as a tree of objects JavaScript can manipulate."},
        {"question": "Which protocol makes web connections secure?", "options": ["FTP","SMTP","HTTPS","SSH"], "answer": 2, "explanation": "HTTPS is the secure version of HTTP. The padlock in your browser indicates an HTTPS connection."},
        {"question": "What is responsive design?", "options": ["Making pages load faster","Making websites work on all screen sizes","Adding animations","Connecting to databases"], "answer": 1, "explanation": "Responsive design ensures your website works well on all screen sizes from large monitors to mobile phones."},
    ],
    "data-science-intro": [
        {"question": "What is the mean of 2, 4, 6, 8, and 10?", "options": ["5","6","7","8"], "answer": 1, "explanation": "The mean is calculated by adding all numbers and dividing by how many there are. 30 divided by 5 equals 6."},
        {"question": "What is supervised learning?", "options": ["Learning without data","Training on labeled examples","Human supervising computer","Learning only from images"], "answer": 1, "explanation": "Supervised learning trains a model on examples with known correct answers so it can predict answers for new data."},
        {"question": "What is the purpose of Exploratory Data Analysis?", "options": ["Building the final model","Understanding data before formal analysis","Collecting new data","Publishing results"], "answer": 1, "explanation": "EDA helps you understand your data before formal modeling by finding patterns and spotting outliers."},
        {"question": "What does data cleaning involve?", "options": ["Deleting all data","Removing errors and handling missing values","Adding more data","Encrypting data"], "answer": 1, "explanation": "Data cleaning removes duplicates, handles missing values, corrects errors, and standardizes formats."},
        {"question": "Which chart best shows trends over time?", "options": ["Pie chart","Bar chart","Line chart","Scatter plot"], "answer": 2, "explanation": "Line charts are ideal for showing how values change over time because the connected line makes trends easy to see."},
    ],
    "english-communication": [
        {"question": "Which sentence uses active voice?", "options": ["The report was written by Sarah.","Sarah wrote the report.","The report has been written.","Written by Sarah was the report."], "answer": 1, "explanation": "Active voice puts the doer first. Sarah wrote the report is clearer and more direct."},
        {"question": "Which is most appropriate in formal communication?", "options": ["Hey, can u send me the stuff?","Please send the required documents at your earliest convenience.","Send docs ASAP lol","Yo, where's the file?"], "answer": 1, "explanation": "Formal communication uses complete sentences, polite language, and professional vocabulary."},
        {"question": "What does vocabulary building help you achieve?", "options": ["Writing longer sentences","Expressing ideas more precisely","Speaking faster","Using abbreviations"], "answer": 1, "explanation": "A rich vocabulary allows you to choose exactly the right word, helping you express ideas with precision."},
        {"question": "Most effective technique when nervous speaking publicly?", "options": ["Speak as fast as possible","Read from notes","Breathe deeply and slow down","Avoid looking at audience"], "answer": 2, "explanation": "Deep breathing activates your relaxation response and slowing speech counteracts the tendency to rush when nervous."},
        {"question": "What is the function of a subject in a sentence?", "options": ["Describes an action","Is the doer or topic","Shows when something happened","Connects two clauses"], "answer": 1, "explanation": "The subject is who or what the sentence is about, typically the doer of the action expressed by the verb."},
    ],
    "digital-literacy": [
        {"question": "What does HTTPS indicate in a website address?", "options": ["Website is popular","Connection is secure and encrypted","Website is free","Website is government-owned"], "answer": 1, "explanation": "HTTPS means the connection is encrypted, keeping your data safe from interception."},
        {"question": "What is two-factor authentication?", "options": ["Using two passwords","Logging in from two devices","Verifying identity with a second method","Sharing account with two people"], "answer": 2, "explanation": "Two-factor authentication adds a second verification step beyond your password, making accounts much harder to hack."},
        {"question": "What is cloud storage?", "options": ["Storage in clouds in the sky","Saving files on remote servers accessible anywhere","A type of USB drive","Storage built into your phone"], "answer": 1, "explanation": "Cloud storage saves files on servers you can access from any device with internet connection."},
        {"question": "What is phishing?", "options": ["An online game","Fraudulent attempts to steal information by pretending to be trustworthy","A fast internet method","A social media platform"], "answer": 1, "explanation": "Phishing is when criminals send fake emails pretending to be trusted organizations to trick you into revealing personal information."},
        {"question": "Why use unique passwords for different accounts?", "options": ["Easier to remember","If one is hacked others remain safe","Websites require it","Makes internet faster"], "answer": 1, "explanation": "Unique passwords mean that if one account is compromised, hackers cannot access your other accounts."},
    ],
    "mindfulness-wellbeing": [
        {"question": "What is mindfulness?", "options": ["Thinking about the future","Paying attention to the present moment without judgment","Avoiding stressful thoughts","Meditating for hours"], "answer": 1, "explanation": "Mindfulness is paying full attention to the present moment with openness and without judgment."},
        {"question": "What is the four-seven-eight breathing technique?", "options": ["Inhale 4, hold 7, exhale 8 counts","Breathe 4 times per minute for 7 minutes","Inhale 4 seconds exhale 7 wait 8","Take 4 deep 7 normal 8 shallow breaths"], "answer": 0, "explanation": "Inhale for 4 counts, hold for 7, exhale for 8 counts. This activates your body's relaxation response."},
        {"question": "Best approach for building a positive habit?", "options": ["Start with ambitious goal","Start with smallest possible version","Practice only when motivated","Change everything at once"], "answer": 1, "explanation": "Starting with a tiny version makes it easy to begin and build consistency. You can increase intensity gradually."},
        {"question": "What is diaphragmatic breathing?", "options": ["Breathing only through mouth","Expanding belly when inhaling deeply","Taking short rapid breaths","Breathing through one nostril"], "answer": 1, "explanation": "Belly breathing involves expanding your abdomen as you inhale deeply, engaging the diaphragm fully for a calming effect."},
        {"question": "What is emotional intelligence?", "options": ["Having a high IQ","Ability to recognize and manage emotions in yourself and others","Being emotionless","Having psychology knowledge"], "answer": 1, "explanation": "Emotional intelligence includes self-awareness, self-regulation, empathy, and social skills to navigate relationships."},
    ],
}

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username  = data.get("username", "").strip().lower()
    password  = data.get("password", "").strip()
    full_name = data.get("fullName", "").strip()
    email     = data.get("email", "").strip()

    if not username or not password or not full_name:
        msg = "Please provide your name, username, and password to register."
        return jsonify({"error": msg, "audio": generate_tts(msg)}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        msg = f"The username {username} is already taken. Please choose a different username."
        return jsonify({"error": msg, "audio": generate_tts(msg)}), 409

    user_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO users (id, username, password, full_name, email) VALUES (?,?,?,?,?)",
        (user_id, username, hash_password(password), full_name, email)
    )
    db.commit()

    # Create session
    token  = str(uuid.uuid4())
    expiry = (datetime.now() + timedelta(days=30)).isoformat()
    db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)", (token, user_id, expiry))
    db.execute("UPDATE users SET last_login=?, total_sessions=total_sessions+1 WHERE id=?",
               (datetime.now().isoformat(), user_id))
    db.commit()

    msg = f"Welcome to VoiceLearn, {full_name}! Your account has been created successfully. You are now logged in and ready to start learning."
    return jsonify({
        "success": True, "token": token,
        "user": {"id": user_id, "username": username, "fullName": full_name},
        "message": msg, "audio": generate_tts(msg)
    })


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()

    if not username or not password:
        msg = "Please say or type your username and password to log in."
        return jsonify({"error": msg, "audio": generate_tts(msg)}), 400

    db   = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (username, hash_password(password))
    ).fetchone()

    if not user:
        msg = "I could not find an account with that username and password. Please try again, or say register to create a new account."
        return jsonify({"error": msg, "audio": generate_tts(msg)}), 401

    user = dict(user)
    token  = str(uuid.uuid4())
    expiry = (datetime.now() + timedelta(days=30)).isoformat()
    db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)",
               (token, user["id"], expiry))
    db.execute("UPDATE users SET last_login=?, total_sessions=total_sessions+1 WHERE id=?",
               (datetime.now().isoformat(), user["id"]))
    db.commit()

    msg = f"Welcome back, {user['full_name']}! You are now logged in. Say hello to your AI tutor or browse your courses to continue learning."
    return jsonify({
        "success": True, "token": token,
        "user": {"id": user["id"], "username": user["username"], "fullName": user["full_name"]},
        "message": msg, "audio": generate_tts(msg)
    })


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    db    = get_db()
    db.execute("DELETE FROM sessions WHERE id=?", (token,))
    db.commit()
    msg = "You have been logged out. Come back soon to continue your learning journey!"
    return jsonify({"success": True, "message": msg, "audio": generate_tts(msg)})


@app.route("/api/auth/me", methods=["GET"])
def get_me():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": user})


# ═══════════════════════════════════════════════════════════════════════════════
# COURSES ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/courses", methods=["GET"])
def get_courses():
    return jsonify({"courses": COURSES})

@app.route("/api/courses/<course_id>", methods=["GET"])
def get_course(course_id):
    c = next((x for x in COURSES if x["id"] == course_id), None)
    if not c:
        return jsonify({"error": "Course not found"}), 404
    return jsonify({"course": c})

@app.route("/api/quiz/<course_id>", methods=["GET"])
def get_quiz(course_id):
    qs = QUIZ_BANK.get(course_id)
    if not qs:
        return jsonify({"error": "Quiz not found"}), 404
    return jsonify({"questions": qs, "total": len(qs)})


# ═══════════════════════════════════════════════════════════════════════════════
# PROGRESS / HISTORY ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/progress/topic", methods=["POST"])
def mark_topic():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user: return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json()
    db   = get_db()
    db.execute(
        "INSERT OR IGNORE INTO user_progress (user_id, course_id, topic) VALUES (?,?,?)",
        (user["user_id"], data.get("courseId"), data.get("topic"))
    )
    db.commit()
    return jsonify({"saved": True})


@app.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user: return jsonify({"error": "Not authenticated"}), 401

    data  = request.get_json()
    score = data.get("score", 0)
    total = data.get("total", 5)
    pct   = round((score / total) * 100, 1) if total > 0 else 0

    db = get_db()
    db.execute(
        "INSERT INTO quiz_results (user_id, course_id, score, total, percentage) VALUES (?,?,?,?,?)",
        (user["user_id"], data.get("courseId"), score, total, pct)
    )
    db.commit()
    return jsonify({"saved": True, "percentage": pct})


@app.route("/api/history", methods=["GET"])
def get_history():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user: return jsonify({"error": "Not authenticated"}), 401

    db  = get_db()
    uid = user["user_id"]

    progress = db.execute(
        "SELECT course_id, topic, listened_at FROM user_progress WHERE user_id=? ORDER BY listened_at DESC",
        (uid,)
    ).fetchall()

    quizzes = db.execute(
        "SELECT course_id, score, total, percentage, taken_at FROM quiz_results WHERE user_id=? ORDER BY taken_at DESC LIMIT 20",
        (uid,)
    ).fetchall()

    chats = db.execute(
        "SELECT role, content, page, created_at FROM chat_history WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
        (uid,)
    ).fetchall()

    voice = db.execute(
        "SELECT transcript, response, command_type, created_at FROM voice_activity WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
        (uid,)
    ).fetchall()

    return jsonify({
        "progress":  [dict(r) for r in progress],
        "quizzes":   [dict(r) for r in quizzes],
        "chats":     [dict(r) for r in chats],
        "voice":     [dict(r) for r in voice],
    })


@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user: return jsonify({"error": "Not authenticated"}), 401

    db  = get_db()
    uid = user["user_id"]

    topics_done = db.execute(
        "SELECT COUNT(*) as cnt FROM user_progress WHERE user_id=?", (uid,)
    ).fetchone()["cnt"]

    quizzes_taken = db.execute(
        "SELECT COUNT(*) as cnt FROM quiz_results WHERE user_id=?", (uid,)
    ).fetchone()["cnt"]

    best_score = db.execute(
        "SELECT MAX(percentage) as best FROM quiz_results WHERE user_id=?", (uid,)
    ).fetchone()["best"] or 0

    courses_started = db.execute(
        "SELECT COUNT(DISTINCT course_id) as cnt FROM user_progress WHERE user_id=?", (uid,)
    ).fetchone()["cnt"]

    recent_activity = db.execute(
        """SELECT 'lesson' as type, course_id, topic as detail, listened_at as when_
           FROM user_progress WHERE user_id=?
           UNION ALL
           SELECT 'quiz' as type, course_id, CAST(percentage AS TEXT)||'%' as detail, taken_at as when_
           FROM quiz_results WHERE user_id=?
           ORDER BY when_ DESC LIMIT 5""",
        (uid, uid)
    ).fetchall()

    user_info = db.execute("SELECT full_name, total_sessions, last_login FROM users WHERE id=?", (uid,)).fetchone()

    return jsonify({
        "user": {
            "fullName": user_info["full_name"],
            "totalSessions": user_info["total_sessions"],
            "lastLogin": user_info["last_login"],
        },
        "stats": {
            "topicsDone": topics_done,
            "quizzesTaken": quizzes_taken,
            "bestScore": best_score,
            "coursesStarted": courses_started,
        },
        "recentActivity": [dict(r) for r in recent_activity],
    })


@app.route("/api/page-visit", methods=["POST"])
def page_visit():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)
    if not user: return jsonify({"ok": True})
    data = request.get_json()
    db   = get_db()
    db.execute("INSERT INTO page_visits (user_id, page) VALUES (?,?)",
               (user["user_id"], data.get("page", "")))
    db.commit()
    return jsonify({"ok": True})


# ═══════════════════════════════════════════════════════════════════════════════
# TTS / AUDIO ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    data  = request.get_json()
    text  = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text"}), 400
    audio = generate_tts(text)
    return jsonify({"audio": audio, "fallback": audio is None})


@app.route("/api/lesson-audio", methods=["POST"])
def lesson_audio():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user  = get_user_from_token(token)

    data      = request.get_json()
    course_id = data.get("courseId")
    topic     = data.get("topic")
    course    = next((c for c in COURSES if c["id"] == course_id), None)
    if not course: return jsonify({"error": "Course not found"}), 404
    content = course.get("lessonContent", {}).get(topic)
    if not content: return jsonify({"error": "Lesson not found"}), 404

    audio = generate_tts(f"Lesson: {topic}. {content}")

    # Save progress if logged in
    if user:
        db = get_db()
        db.execute("INSERT OR IGNORE INTO user_progress (user_id, course_id, topic) VALUES (?,?,?)",
                   (user["user_id"], course_id, topic))
        db.commit()

    return jsonify({"audio": audio, "topic": topic, "content": content})


@app.route("/api/quiz-audio", methods=["POST"])
def quiz_audio():
    data     = request.get_json()
    question = data.get("question", "")
    options  = data.get("options", [])
    opts_txt = " ".join([f"Option {chr(65+i)}: {o}." for i, o in enumerate(options)])
    audio    = generate_tts(f"Question: {question}. Your options are: {opts_txt}")
    return jsonify({"audio": audio})


# ═══════════════════════════════════════════════════════════════════════════════
# VOICE & CHAT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/voice", methods=["POST"])
def voice():
    token      = request.headers.get("Authorization", "").replace("Bearer ", "")
    user       = get_user_from_token(token)
    data       = request.get_json()
    transcript = data.get("transcript", "").strip()
    context    = data.get("context", {})
    history    = data.get("history", [])

    if not transcript:
        return jsonify({"error": "No transcript"}), 400

    user_name = user["full_name"].split()[0] if user else "friend"
    reply     = get_ai_response(transcript, context, history, user_name)
    audio     = generate_tts(reply)

    # Save voice activity
    if user:
        db = get_db()
        db.execute(
            "INSERT INTO voice_activity (user_id, transcript, response, command_type) VALUES (?,?,?,?)",
            (user["user_id"], transcript, reply, context.get("currentPage", ""))
        )
        db.execute(
            "INSERT INTO chat_history (user_id, role, content, page) VALUES (?,?,?,?)",
            (user["user_id"], "user", transcript, context.get("currentPage", ""))
        )
        db.execute(
            "INSERT INTO chat_history (user_id, role, content, page) VALUES (?,?,?,?)",
            (user["user_id"], "assistant", reply, context.get("currentPage", ""))
        )
        db.commit()

    return jsonify({"reply": reply, "audio": audio, "transcript": transcript})


@app.route("/api/chat", methods=["POST"])
def chat():
    token    = request.headers.get("Authorization", "").replace("Bearer ", "")
    user     = get_user_from_token(token)
    data     = request.get_json()
    message  = data.get("message", "").strip()
    context  = data.get("context", {})
    history  = data.get("history", [])

    if not message: return jsonify({"error": "No message"}), 400

    user_name = user["full_name"].split()[0] if user else "friend"
    reply     = get_ai_response(message, context, history, user_name)
    audio     = generate_tts(reply)

    if user:
        db = get_db()
        db.execute("INSERT INTO chat_history (user_id, role, content, page) VALUES (?,?,?,?)",
                   (user["user_id"], "user", message, context.get("currentPage", "")))
        db.execute("INSERT INTO chat_history (user_id, role, content, page) VALUES (?,?,?,?)",
                   (user["user_id"], "assistant", reply, context.get("currentPage", "")))
        db.commit()

    return jsonify({"reply": reply, "audio": audio})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "tts": "ElevenLabs" if ELEVENLABS_API_KEY else "gTTS", "ai": "Gemini 1.5 Flash"})


if __name__ == "__main__":
    init_db()
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development"
    print(f"🎧 VoiceLearn API — Port {port} — TTS: {'ElevenLabs' if ELEVENLABS_API_KEY else 'gTTS'}")
    app.run(debug=debug, host="0.0.0.0", port=port)