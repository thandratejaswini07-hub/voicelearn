import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import './AboutPage.css';

const ABOUT_SPEECH = "About VoiceLearn. VoiceLearn is an audio-first educational platform built specifically for visually impaired learners. Every single lesson is narrated using high-quality text-to-speech. Our AI tutor, powered by Google Gemini, can answer any question through voice or text, explain concepts in plain language, and guide you through courses conversationally. We offer six courses: Python programming, Web Development, Data Science, English Communication, Digital Literacy, and Mindfulness. Every quiz is fully spoken. The platform is fully keyboard navigable and screen-reader compatible.";

const ACCESSIBILITY_FEATURES = [
  { icon: '🔊', title: 'Auto-Narration', desc: 'Pages announce themselves automatically on load. Every navigation action is confirmed with audio.' },
  { icon: '⌨️', title: 'Full Keyboard Navigation', desc: 'Every feature accessible via Tab, Enter, Space, and number keys. Quiz answers via 1-4 keys.' },
  { icon: '🗣️', title: 'Voice Input', desc: 'Speak to the AI assistant using your microphone. Voice commands work throughout the platform.' },
  { icon: '📢', title: 'Screen Reader Compatible', desc: 'Full ARIA labeling, landmark roles, live regions, and semantic HTML throughout.' },
  { icon: '⏸️', title: 'Stop Anytime', desc: 'Global stop button always accessible. Audio pauses instantly when you begin speaking.' },
  { icon: '🔄', title: 'Replay Everything', desc: 'Every piece of audio can be replayed. Questions, lessons, and explanations all have replay buttons.' },
];

const TECH_STACK = [
  { name: 'Google Gemini AI', role: 'Conversational AI tutor — understands questions, explains concepts, guides learners' },
  { name: 'gTTS (Google Text-to-Speech)', role: 'Converts all lesson content, quiz questions, and AI responses to natural speech audio' },
  { name: 'Web Speech API', role: 'Browser-native voice input for the AI assistant microphone feature' },
  { name: 'React 18', role: 'Frontend framework — component-based UI with accessibility-first architecture' },
  { name: 'Flask + Python', role: 'Backend API — handles AI conversations, TTS generation, and course data' },
  { name: 'React Router', role: 'Client-side navigation with route-based audio announcements' },
];

const COURSES_INFO = [
  { id: 'python-basics',         emoji: '🐍', title: 'Python for Beginners',              topics: 6, lessons: 24, duration: '8 hours',  desc: 'Variables, loops, functions, data structures, file handling, and object-oriented programming.' },
  { id: 'web-basics',            emoji: '🌐', title: 'Web Development Fundamentals',       topics: 6, lessons: 30, duration: '10 hours', desc: 'How the internet works, HTML semantics, CSS styling, JavaScript, DOM manipulation, and responsive design.' },
  { id: 'data-science-intro',    emoji: '📊', title: 'Data Science Essentials',            topics: 6, lessons: 36, duration: '12 hours', desc: 'Data science introduction, statistics, data collection and cleaning, EDA, machine learning basics, and visualization.' },
  { id: 'english-communication', emoji: '💬', title: 'Effective English Communication',    topics: 6, lessons: 18, duration: '6 hours',  desc: 'Pronunciation, grammar essentials, vocabulary building, formal vs informal communication, writing, and public speaking.' },
  { id: 'digital-literacy',      emoji: '💻', title: 'Digital Literacy for Everyone',      topics: 6, lessons: 15, duration: '5 hours',  desc: 'Smartphones, internet safety, email communication, cloud storage, online shopping, and social media.' },
  { id: 'mindfulness-wellbeing', emoji: '🧘', title: 'Mindfulness and Mental Wellbeing',   topics: 6, lessons: 12, duration: '4 hours',  desc: 'Mindfulness introduction, breathing techniques, stress management, sleep hygiene, positive habits, and emotional intelligence.' },
];

export default function AboutPage() {
  const { speak } = useAudio();

  useEffect(() => {
    document.title = 'About — VoiceLearn';
    setTimeout(() => speak(ABOUT_SPEECH), 600);
  }, [speak]);

  return (
    <div className="about-page">
      <div className="container">
        <header className="about-hero" aria-labelledby="about-heading">
          <div className="about-hero-badge"><span>Our Mission</span></div>
          <h1 id="about-heading" className="about-title">
            Education That Speaks<br />
            <span className="about-title-em">to Everyone</span>
          </h1>
          <p className="about-intro">
            VoiceLearn was built on a single belief: quality education should never be limited by how someone perceives the world.
            We create learning experiences where audio is the primary medium — not an afterthought.
          </p>
          <div className="about-hero-actions">
            <button className="btn btn-primary" onClick={() => speak(ABOUT_SPEECH)} aria-label="Hear the full about page introduction">
              <SpeakerIcon />
              Hear Introduction
            </button>
            <Link to="/courses" className="btn btn-ghost" aria-label="Go to the courses page">
              Browse Courses →
            </Link>
          </div>
        </header>

        <div className="divider" />

        <section aria-labelledby="accessibility-heading">
          <h2 id="accessibility-heading" className="section-heading">Accessibility First</h2>
          <p className="section-subhead">Every design decision was made with visually impaired users at the center.</p>
          <div className="features-grid-about" role="list">
            {ACCESSIBILITY_FEATURES.map((f, i) => (
              <div key={f.title} className="about-feature-card" role="listitem" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="afc-icon" aria-hidden="true">{f.icon}</div>
                <h3 className="afc-title">{f.title}</h3>
                <p className="afc-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />

        <section aria-labelledby="courses-detail-heading">
          <h2 id="courses-detail-heading" className="section-heading">All Six Courses</h2>
          <p className="section-subhead">Each course is fully narrated with 5 audio quiz questions. Click to start learning.</p>
          <div className="courses-detail-grid" role="list">
            {COURSES_INFO.map((c, i) => (
              <Link key={c.id} to={`/courses/${c.id}`} className="course-detail-card" role="listitem"
                aria-label={`${c.title}: ${c.duration}, ${c.lessons} lessons`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="cdc-header">
                  <span className="cdc-emoji" aria-hidden="true">{c.emoji}</span>
                  <div>
                    <h3 className="cdc-title">{c.title}</h3>
                    <div className="cdc-meta">
                      <span>{c.duration}</span><span>·</span>
                      <span>{c.lessons} lessons</span><span>·</span>
                      <span>{c.topics} topics</span>
                    </div>
                  </div>
                </div>
                <p className="cdc-desc">{c.desc}</p>
                <span className="cdc-link">Start Learning →</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="divider" />

        <section aria-labelledby="tech-heading">
          <h2 id="tech-heading" className="section-heading">Powered By</h2>
          <p className="section-subhead">The technologies behind VoiceLearn's audio-first experience.</p>
          <div className="tech-stack" role="list">
            {TECH_STACK.map((t, i) => (
              <div key={t.name} className="tech-item" role="listitem" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="tech-name">{t.name}</div>
                <div className="tech-role">{t.role}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />

        <section aria-labelledby="keyboard-heading">
          <h2 id="keyboard-heading" className="section-heading">Keyboard Reference</h2>
          <p className="section-subhead">VoiceLearn is fully navigable by keyboard.</p>
          <div className="keyboard-ref" role="table" aria-label="Keyboard shortcuts">
            <div className="kref-header" role="row">
              <div role="columnheader">Key</div>
              <div role="columnheader">Action</div>
            </div>
            {[
              ['Tab',            'Move focus to next interactive element'],
              ['Shift + Tab',    'Move focus to previous interactive element'],
              ['Enter / Space',  'Activate focused button or link'],
              ['1 / 2 / 3 / 4', 'Select quiz answer option A, B, C, or D'],
              ['Enter (quiz)',   'Proceed to next question after answering'],
              ['Escape',         'Close the voice assistant panel'],
            ].map(([key, action]) => (
              <div key={key} className="kref-row" role="row">
                <div role="cell"><kbd>{key}</kbd></div>
                <div role="cell">{action}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="about-cta" role="complementary" aria-label="Get started">
          <h2 className="about-cta-title">Start Your Audio Journey</h2>
          <p>Every lesson is waiting. Your AI tutor is ready.</p>
          <Link to="/courses" className="btn btn-primary btn-lg" aria-label="Browse all available courses">
            Browse All Courses
          </Link>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}