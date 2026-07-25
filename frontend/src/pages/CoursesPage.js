import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCourses } from '../services/api';
import { useAudio } from '../context/AudioContext';
import './CoursesPage.css';

const CATEGORY_COLORS = {
  Programming:       'badge-teal',
  'Web Development': 'badge-amber',
  'Data Science':    'badge-coral',
  Language:          'badge-amber',
  Technology:        'badge-teal',
  Wellness:          'badge-coral',
};

const EMOJIS = {
  'python-basics':         '🐍',
  'web-basics':            '🌐',
  'data-science-intro':    '📊',
  'english-communication': '💬',
  'digital-literacy':      '💻',
  'mindfulness-wellbeing': '🧘',
};

export default function CoursesPage() {
  const { speak } = useAudio();
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter,  setFilter]    = useState('All');

  useEffect(() => {
    document.title = 'Courses — VoiceLearn';
    getCourses()
      .then(res => {
        setCourses(res.data.courses);
        setLoading(false);
        const titles = res.data.courses.map(c => c.title).join(', ');
        speak(`Courses page. We have ${res.data.courses.length} audio courses available: ${titles}. Each course includes full audio narration and a spoken quiz. Press Tab to browse.`);
      })
      .catch(() => setLoading(false));
  }, [speak]);

  const categories = ['All', ...new Set(courses.map(c => c.category))];
  const filtered   = filter === 'All' ? courses : courses.filter(c => c.category === filter);

  return (
    <div className="courses-page">
      <div className="container">
        <header className="page-header" role="banner">
          <div className="page-header-inner">
            <h1 className="page-title">
              Audio Courses
              <span className="page-title-accent"> — Learn by Listening</span>
            </h1>
            <p className="page-desc">
              Every lesson narrated. Every concept explained. Your AI tutor is always ready to help.
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => speak('Choose any course below. Each course page has audio lessons and a spoken quiz.')}
            aria-label="Hear navigation instructions"
          >
            <SpeakerIcon />
            How to Navigate
          </button>
        </header>

        <div className="course-filters" role="group" aria-label="Filter courses by category">
          <span className="filter-label">Filter:</span>
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => { setFilter(cat); speak(`Showing ${cat === 'All' ? 'all' : cat} courses.`); }}
              aria-pressed={filter === cat}
              aria-label={`Show ${cat} courses`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Loading courses…</p>
          </div>
        ) : (
          <div className="courses-grid" role="list" aria-label="Available courses">
            {filtered.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <p className="empty-state" role="status">No courses found in this category.</p>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course, index }) {
  const { speak } = useAudio();
  const emoji     = EMOJIS[course.id] || '📖';
  const badgeClass= CATEGORY_COLORS[course.category] || 'badge-amber';

  return (
    <div className="course-card" role="listitem" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="cc-top">
        <div className="cc-emoji" aria-hidden="true">{emoji}</div>
        <div className="cc-meta">
          <span className={`badge ${badgeClass}`}>{course.category}</span>
          <span className="cc-level">{course.level}</span>
        </div>
      </div>
      <h2 className="cc-title">{course.title}</h2>
      <p className="cc-desc">{course.description}</p>
      <div className="cc-stats" aria-label="Course statistics">
        <div className="cc-stat"><ClockIcon /><span>{course.duration}</span></div>
        <div className="cc-stat"><BookIcon /><span>{course.lessons} lessons</span></div>
      </div>
      <div className="cc-topics">
        <h3 className="cc-topics-label">Topics covered:</h3>
        <ul className="cc-topics-list" aria-label={`Topics in ${course.title}`}>
          {course.topics.slice(0, 4).map(t => (
            <li key={t} className="cc-topic">{t}</li>
          ))}
          {course.topics.length > 4 && (
            <li className="cc-topic cc-topic-more">+{course.topics.length - 4} more</li>
          )}
        </ul>
      </div>
      <div className="cc-actions">
        <button
          className="btn btn-ghost cc-hear-btn"
          onClick={() => speak(`${course.title}. ${course.description}. This course covers ${course.topics.join(', ')}.`)}
          aria-label={`Hear description of ${course.title}`}
        >
          <SpeakerIcon />
          Hear Description
        </button>
        <Link
          to={`/courses/${course.id}`}
          className="btn btn-primary cc-start-btn"
          aria-label={`Open ${course.title} course`}
        >
          <PlayIcon />
          Open Course
        </Link>
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
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}