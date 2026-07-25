import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import './LandingPage.css';

const WELCOME_SPEECH = "Welcome to VoiceLearn — your audio-first learning platform designed for visually impaired learners. Browse our courses in programming, web development, data science, English communication, digital literacy, and mindfulness. Every lesson is narrated, and our AI assistant is ready to answer your questions. Press Tab to navigate, or say hello to the assistant in the corner.";

const FEATURES = [
  {
    icon: '🎧',
    title: 'Every Lesson Narrated',
    desc: 'All course content is professionally narrated and available as audio. Learn without ever needing to read a screen.',
  },
  {
    icon: '🤖',
    title: 'AI Voice Tutor',
    desc: 'Ask questions, get explanations, and have full conversations with your AI tutor — all through voice or text.',
  },
  {
    icon: '🎤',
    title: 'Voice Input',
    desc: 'Navigate the platform, ask questions, and interact with quizzes entirely using your voice.',
  },
  {
    icon: '📚',
    title: 'Six Rich Courses',
    desc: 'Python, Web Development, Data Science, English, Digital Literacy, and Mindfulness — all audio-first.',
  },
  {
    icon: '🧠',
    title: 'Audio Quizzes',
    desc: 'Every quiz question and answer choice is read aloud. Test your knowledge without reading a word.',
  },
  {
    icon: '♿',
    title: 'Full Accessibility',
    desc: 'Screen reader compatible, keyboard navigable, and ARIA-annotated throughout.',
  },
];


const COURSES_PREVIEW = [
  { id: 'python-basics',        emoji: '🐍', title: 'Python for Beginners',        level: 'Beginner',      cat: 'Programming' },
  { id: 'web-basics',           emoji: '🌐', title: 'Web Development Fundamentals', level: 'Beginner',      cat: 'Web Dev' },
  { id: 'data-science-intro',   emoji: '📊', title: 'Data Science Essentials',      level: 'Intermediate',  cat: 'Data Science' },
  { id: 'english-communication',emoji: '💬', title: 'Effective English',            level: 'All Levels',    cat: 'Language' },
  { id: 'digital-literacy',     emoji: '💻', title: 'Digital Literacy',             level: 'Beginner',      cat: 'Technology' },
  { id: 'mindfulness-wellbeing',emoji: '🧘', title: 'Mindfulness & Wellbeing',      level: 'All Levels',    cat: 'Wellness' },
];

export default function LandingPage() {
  const { speak } = useAudio();
  const heroRef = useRef(null);
  const announcedRef = useRef(false);

  useEffect(() => {
    document.title = 'VoiceLearn — Audio-First Learning for Everyone';
    // Auto-announce on first visit
    if (!announcedRef.current) {
      announcedRef.current = true;
      setTimeout(() => speak(WELCOME_SPEECH), 800);
    }
  }, [speak]);

  return (
    <div className="landing">

      {/* ── Hero ── */}
      <section className="hero" ref={heroRef} aria-labelledby="hero-heading">
        <div className="hero-bg-grid" aria-hidden="true" />

        <div className="container hero-content">
          <div className="hero-badge animate-fade-up">
            <span className="hero-badge-dot" aria-hidden="true" />
            <span>Audio-First Education Platform</span>
          </div>

          <h1 id="hero-heading" className="hero-title animate-fade-up delay-100">
            Learn Through
            <span className="hero-title-em">
              <br />the Power of Sound
            </span>
          </h1>

          <p className="hero-subtitle animate-fade-up delay-200">
            A fully accessible, audio-first learning platform crafted for visually impaired learners.
            Every lesson narrated. Every quiz spoken. An AI tutor always listening.
          </p>

          {/* Giant audio visualizer */}
          <div
            className="hero-visualizer animate-fade-up delay-300"
            aria-hidden="true"
            role="img"
            aria-label="Audio waveform decoration"
          >
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="hero-bar" style={{ animationDelay: `${(i * 47) % 600}ms` }} />
            ))}
          </div>

          <div className="hero-actions animate-fade-up delay-400">
            <Link
              to="/courses"
              className="btn btn-primary btn-hero"
              aria-label="Browse all available courses"
            >
              <PlayIcon />
              Start Learning
            </Link>

            <button
              className="btn btn-ghost btn-hero"
              onClick={() => speak(WELCOME_SPEECH)}
              aria-label="Hear an audio introduction to VoiceLearn"
            >
              <SpeakerIcon />
              Hear Introduction
            </button>
          </div>

          <div className="hero-stats animate-fade-up delay-500" role="list" aria-label="Platform statistics">
            {[
              { num: '6', label: 'Audio Courses' },
              { num: '135+', label: 'Narrated Lessons' },
              { num: '30+', label: 'Audio Quizzes' },
              { num: '24/7', label: 'AI Tutor' },
            ].map(s => (
              <div key={s.label} className="hero-stat" role="listitem">
                <div className="hero-stat-num">{s.num}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audio announcement ── */}
      <section className="announce-section" aria-label="Page announcement">
        <div className="container">
          <div className="announce-box" role="note">
            <div className="waveform" aria-hidden="true">
              {[1,2,3,4,5,6,7].map(i => <div key={i} className="bar" />)}
            </div>
            <p>
              <strong>Audio narration is active.</strong> This page will read aloud automatically.
              Use <kbd>Tab</kbd> to navigate, <kbd>Enter</kbd> to activate, and the <strong>Ask Me</strong> button to chat with your AI tutor.
            </p>
            <button
              className="btn btn-ghost announce-btn"
              onClick={() => speak(WELCOME_SPEECH)}
              aria-label="Replay the welcome introduction"
            >
              Replay Intro
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section" aria-labelledby="features-heading">
        <div className="container">
          <h2 id="features-heading" className="section-title">
            Built for How You Learn
          </h2>
          <p className="section-subtitle">
            Every feature designed with accessibility at its core — not as an afterthought.
          </p>

          <div className="features-grid" role="list">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="feature-card"
                role="listitem"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Courses Preview ── */}
      <section className="courses-preview-section" aria-labelledby="courses-preview-heading">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 id="courses-preview-heading" className="section-title">Our Audio Courses</h2>
              <p className="section-subtitle">Six rich courses, all narrated in full.</p>
            </div>
            <Link to="/courses" className="btn btn-outline" aria-label="See all available courses">
              View All Courses
            </Link>
          </div>

          <div className="courses-preview-grid" role="list">
            {COURSES_PREVIEW.map((c, i) => (
              <Link
                key={c.id}
                to={`/courses/${c.id}`}
                className="course-preview-card"
                role="listitem"
                aria-label={`${c.title} — ${c.level} level ${c.cat} course`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="cpc-emoji" aria-hidden="true">{c.emoji}</div>
                <div className="cpc-info">
                  <span className="badge badge-amber">{c.cat}</span>
                  <h3 className="cpc-title">{c.title}</h3>
                  <span className="cpc-level">{c.level}</span>
                </div>
                <div className="cpc-arrow" aria-hidden="true">→</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="container">
          <div className="cta-box">
            <div className="cta-orb" aria-hidden="true" />
            <h2 id="cta-heading" className="cta-title">
              Ready to Begin Your<br />Audio Learning Journey?
            </h2>
            <p className="cta-subtitle">
              Your AI tutor is ready. Your courses are waiting. Press play.
            </p>
            <Link
              to="/courses"
              className="btn btn-primary btn-lg"
              aria-label="Browse all courses and start learning"
            >
              <PlayIcon />
              Browse All Courses
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer" role="contentinfo">
        <div className="container">
          <p className="footer-text">
            VoiceLearn — Audio-First Education for Visually Impaired Learners
          </p>
          <p className="footer-sub">
            Powered by Google Gemini AI · Text-to-Speech by gTTS · Built with React
          </p>
        </div>
      </footer>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}