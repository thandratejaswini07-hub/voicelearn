import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCourse, getLessonAudio } from '../services/api';
import { useAudio } from '../context/AudioContext';
import './CoursePage.css';

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { speak, stop } = useAudio();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [lessonContent, setLessonContent] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const lessonAudioRef = useRef(null);

  useEffect(() => {
    getCourse(id)
      .then(res => {
        const c = res.data.course;
        setCourse(c);
        setLoading(false);
        document.title = `${c.title} — VoiceLearn`;
        speak(`Welcome to ${c.title}. ${c.description}. This course has ${c.topics.length} topics. Select a topic to begin listening.`);
      })
      .catch(() => {
        setLoading(false);
        speak('Sorry, I could not load this course. Please go back to courses and try again.');
      });

    return () => {
      stop();
      if (lessonAudioRef.current) lessonAudioRef.current.pause();
    };
  }, [id, speak, stop]);

  const handleTopicSelect = async (topic) => {
    stop();
    if (lessonAudioRef.current) {
      lessonAudioRef.current.pause();
      lessonAudioRef.current = null;
    }
    setAudioPlaying(false);
    setSelectedTopic(topic);
    setLessonContent('');
    setLessonLoading(true);

    speak(`Loading audio lesson: ${topic}. Please wait.`);

    try {
      const res = await getLessonAudio(id, topic);
      const { audio, content } = res.data;
      setLessonContent(content);
      setLessonLoading(false);

      if (audio) {
        const audioEl = new Audio(`data:audio/mp3;base64,${audio}`);
        lessonAudioRef.current = audioEl;
        audioEl.onplay  = () => setAudioPlaying(true);
        audioEl.onended = () => setAudioPlaying(false);
        audioEl.onerror = () => {
          setAudioPlaying(false);
          speak(`Lesson ${topic}. ${content}`);
        };
        setTimeout(() => audioEl.play().catch(() => speak(`Lesson ${topic}. ${content}`)), 300);
      } else {
        speak(`Lesson: ${topic}. ${content}`);
      }
    } catch {
      setLessonLoading(false);
      speak(`Sorry, I couldn't load the audio for ${topic}. Please try again.`);
    }
  };

  const handleReplayLesson = () => {
    if (lessonAudioRef.current) {
      lessonAudioRef.current.currentTime = 0;
      lessonAudioRef.current.play();
    } else if (lessonContent) {
      speak(`Lesson: ${selectedTopic}. ${lessonContent}`);
    }
  };

  const handleStopLesson = () => {
    if (lessonAudioRef.current) {
      lessonAudioRef.current.pause();
      lessonAudioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
    stop();
  };

  if (loading) {
    return (
      <div className="course-page-loading" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Loading course…</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="course-page-error" role="alert">
        <p>Course not found.</p>
        <Link to="/courses" className="btn btn-primary">Back to Courses</Link>
      </div>
    );
  }

  return (
    <div className="course-page">
      <div className="container">

        {/* Back */}
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/courses" className="breadcrumb-link" aria-label="Back to all courses">
            ← All Courses
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{course.title}</span>
        </nav>

        {/* Course hero */}
        <header className="course-hero" aria-labelledby="course-title">
          <div className="course-hero-left">
            <div className="course-hero-badges">
              <span className="badge badge-amber">{course.category}</span>
              <span className="badge badge-teal">{course.level}</span>
            </div>
            <h1 id="course-title" className="course-title">{course.title}</h1>
            <p className="course-description">{course.description}</p>

            <div className="course-meta-row">
              <div className="course-meta-item">
                <span className="meta-label">Duration</span>
                <span className="meta-value">{course.duration}</span>
              </div>
              <div className="course-meta-item">
                <span className="meta-label">Lessons</span>
                <span className="meta-value">{course.lessons}</span>
              </div>
              <div className="course-meta-item">
                <span className="meta-label">Topics</span>
                <span className="meta-value">{course.topics.length}</span>
              </div>
            </div>
          </div>

          <div className="course-hero-actions">
            <button
              className="btn btn-ghost"
              onClick={() => speak(`${course.title}. ${course.description}. This course covers: ${course.topics.join(', ')}.`)}
              aria-label={`Hear full description of ${course.title}`}
            >
              <SpeakerIcon />
              Hear Overview
            </button>
            <Link
              to={`/quiz/${id}`}
              className="btn btn-primary"
              aria-label={`Take the audio quiz for ${course.title}`}
            >
              <QuizIcon />
              Take Audio Quiz
            </Link>
          </div>
        </header>

        <div className="divider" />

        {/* Two-column layout */}
        <div className="course-layout">

          {/* Topic list */}
          <aside className="topics-sidebar" aria-label="Course topics">
            <h2 className="sidebar-title">Topics</h2>
            <p className="sidebar-hint">Select a topic to hear its audio lesson</p>

            <ol className="topics-list" aria-label="Select a topic to listen">
              {course.topics.map((topic, i) => (
                <li key={topic}>
                  <button
                    className={`topic-btn ${selectedTopic === topic ? 'active' : ''}`}
                    onClick={() => handleTopicSelect(topic)}
                    aria-label={`Listen to lesson ${i + 1}: ${topic}`}
                    aria-pressed={selectedTopic === topic}
                    disabled={lessonLoading && selectedTopic !== topic}
                  >
                    <span className="topic-num" aria-hidden="true">{i + 1}</span>
                    <span className="topic-name">{topic}</span>
                    {selectedTopic === topic && audioPlaying && (
                      <div className="topic-wave waveform" aria-label="Playing" aria-hidden="true">
                        {[1,2,3].map(j => <div key={j} className="bar" />)}
                      </div>
                    )}
                    {selectedTopic === topic && lessonLoading && (
                      <div className="spinner topic-spinner" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          {/* Lesson panel */}
          <main className="lesson-panel" aria-label="Lesson content" aria-live="polite">
            {!selectedTopic ? (
              <div className="lesson-empty">
                <div className="lesson-empty-icon" aria-hidden="true">
                  <SpeakerLargeIcon />
                </div>
                <h2>Select a Topic</h2>
                <p>Choose any topic from the left panel to begin listening to its audio lesson. The lesson will start automatically.</p>
                <button
                  className="btn btn-outline"
                  onClick={() => handleTopicSelect(course.topics[0])}
                  aria-label={`Start with the first lesson: ${course.topics[0]}`}
                >
                  <PlayIcon />
                  Start First Lesson
                </button>
              </div>
            ) : (
              <div className="lesson-content" key={selectedTopic}>
                {/* Lesson header */}
                <div className="lesson-header">
                  <div>
                    <div className="lesson-label">Now Playing</div>
                    <h2 className="lesson-title">{selectedTopic}</h2>
                  </div>

                  <div className="lesson-controls">
                    {audioPlaying ? (
                      <button
                        className="btn btn-ghost lesson-ctrl-btn"
                        onClick={handleStopLesson}
                        aria-label="Stop audio lesson"
                      >
                        <StopIcon />
                        Stop
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost lesson-ctrl-btn"
                        onClick={handleReplayLesson}
                        disabled={lessonLoading}
                        aria-label="Replay this lesson"
                      >
                        <ReplayIcon />
                        Replay
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio status */}
                {lessonLoading && (
                  <div className="lesson-loading" role="status" aria-live="polite">
                    <div className="spinner" aria-hidden="true" />
                    <span>Generating audio narration…</span>
                  </div>
                )}

                {audioPlaying && (
                  <div className="lesson-playing-indicator" aria-live="polite" aria-label="Audio lesson is playing">
                    <div className="waveform lesson-waveform" aria-hidden="true">
                      {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bar" />)}
                    </div>
                    <span>Audio lesson playing — listen carefully</span>
                  </div>
                )}

                {/* Transcript */}
                {lessonContent && (
                  <div className="lesson-transcript">
                    <h3 className="transcript-label">Lesson Transcript</h3>
                    <p className="transcript-text">{lessonContent}</p>

                    <button
                      className="btn btn-outline transcript-read-btn"
                      onClick={() => speak(lessonContent)}
                      aria-label="Read the lesson transcript aloud"
                    >
                      <SpeakerIcon />
                      Read Aloud
                    </button>
                  </div>
                )}

                {/* Next topic */}
                {course.topics.indexOf(selectedTopic) < course.topics.length - 1 && !lessonLoading && (
                  <button
                    className="btn btn-ghost next-topic-btn"
                    onClick={() => {
                      const nextIdx = course.topics.indexOf(selectedTopic) + 1;
                      handleTopicSelect(course.topics[nextIdx]);
                    }}
                    aria-label={`Next lesson: ${course.topics[course.topics.indexOf(selectedTopic) + 1]}`}
                  >
                    Next Lesson: {course.topics[course.topics.indexOf(selectedTopic) + 1]}
                    →
                  </button>
                )}

                {/* Quiz CTA */}
                {course.topics.indexOf(selectedTopic) === course.topics.length - 1 && !lessonLoading && (
                  <div className="course-complete-banner">
                    <span>🎉</span>
                    <div>
                      <strong>All topics covered!</strong>
                      <p>Ready to test your knowledge with the audio quiz?</p>
                    </div>
                    <Link to={`/quiz/${id}`} className="btn btn-primary" aria-label="Take the quiz">
                      Take Quiz
                    </Link>
                  </div>
                )}
              </div>
            )}
          </main>
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

function SpeakerLargeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3.54"/>
    </svg>
  );
}