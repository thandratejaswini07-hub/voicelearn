# VoiceLearn — Audio-First E-Learning for Learners

VoiceLearn is a fully accessible, audio-first educational web platform built
specifically for learners. Every interaction works through
voice and keyboard alone. No visual perception required at any stage.

---

## Features

- Auto Voice Recognition — Microphone activates automatically on every page
- AI Tutor — Google Gemini 1.5 Flash answers questions through voice
- Neural TTS — ElevenLabs Rachel voice for natural human-quality audio
- 6 Full Courses — Python, Web Dev, Data Science, English, Digital Literacy, Mindfulness
- Audio Quizzes — Questions and options narrated, keyboard shortcuts 1-4 to answer
- Voice Login — Register and login entirely by speaking
- Dashboard — Complete history of lessons, quizzes, and AI conversations
- WCAG 2.1 AA — Full screen reader and keyboard navigation support

---

## Tech Stack

| Layer       | Technology                  |
|-------------|----------------------------|
| Frontend    | React 18, React Router v6  |
| Backend     | Flask (Python 3.11)        |
| AI Tutor    | Google Gemini 1.5 Flash    |
| Neural TTS  | ElevenLabs API             |
| Voice Input | Web Speech API             |
| Database    | SQLite                     |
| Style       | Custom CSS, ARIA           |

---

## Project Structure

voicelearn/
├── backend/
│   ├── app.py                  Flask API — all routes and logic
│   ├── requirements.txt        Python dependencies
│   └── .env.example            Environment variables template
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── context/
│   │   │   └── AudioContext.js
│   │   ├── components/
│   │   │   ├── Navbar.js
│   │   │   ├── AudioStatusBar.js
│   │   │   └── VoiceAssistant.js
│   │   ├── pages/
│   │   │   ├── LandingPage.js
│   │   │   ├── CoursesPage.js
│   │   │   ├── CoursePage.js
│   │   │   ├── QuizPage.js
│   │   │   ├── LoginPage.js
│   │   │   ├── DashboardPage.js
│   │   │   └── AboutPage.js
│   │   └── styles/
│   │       └── global.css
│   └── package.json
└── README.md

---

## Setup Instructions

### Requirements
- Python 3.11
- Node.js 18 or higher
- Google AI Studio API Key — free at https://aistudio.google.com
- ElevenLabs API Key — free tier at https://elevenlabs.io

### Backend

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and paste your API keys
python app.py

### Frontend

cd frontend
npm install
npm start

### Test backend is working

Expected:
{"status": "ok", "tts": "ElevenLabs", "ai": "Gemini 1.5 Flash"}

---

## How to Use
1. Open the website
2. Page auto-announces and microphone activates
3. Say register to create an account by voice
4. Speak your name, username, and password when prompted
5. Say open Python course or go to courses to navigate
6. Select a lesson — audio plays automatically
7. Click Ask Me to talk to the AI tutor
8. Press 1 2 3 4 to answer quiz questions
9. Visit Dashboard to see full learning history

---

## Database Tables

| Table          | Purpose                          |
|----------------|----------------------------------|
| users          | Accounts with hashed passwords   |
| sessions       | Login tokens with expiry         |
| user_progress  | Lessons completed per user       |
| quiz_results   | Quiz scores and history          |
| chat_history   | AI tutor conversations           |
| voice_activity | Voice commands log               |
| page_visits    | Navigation history               |

---

## Courses Available

1. Python for Beginners — Variables, loops, functions, OOP
2. Web Development Fundamentals — HTML, CSS, JavaScript, DOM
3. Data Science Essentials — Statistics, ML basics, visualization
4. Effective English Communication — Grammar, vocabulary, speaking
5. Digital Literacy for Everyone — Internet safety, email, cloud
6. Mindfulness and Mental Wellbeing — Breathing, stress, habits

Each course has 6 topics with full audio narration and a 5-question spoken quiz.

---

## AI Technologies Used

| Technology              | Type                    | Purpose                        |
|-------------------------|-------------------------|--------------------------------|
| Google Gemini 1.5 Flash | Large Language Model    | Conversational AI tutor        |
| ElevenLabs Neural TTS   | Neural Vocoder          | Natural voice output           |
| Web Speech API          | Neural ASR              | Voice input recognition        |
| 3-Tier TTS Pipeline     | Neural Audio Engineering| Guaranteed audio delivery      |

---

