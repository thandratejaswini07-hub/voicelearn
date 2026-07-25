import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAudio, authHeaders, clearToken } from '../context/AudioContext';
import axios from 'axios';
import './DashboardPage.css';

export default function DashboardPage() {
  const { speak } = useAudio();
  const navigate  = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview');

  useEffect(() => {
    document.title = 'Dashboard — VoiceLearn';
    axios.get('/api/dashboard', { headers: authHeaders() })
      .then(res => {
        setData(res.data);
        setLoading(false);
        const d = res.data;
        speak(
          `Welcome back, ${d.user.fullName}! ` +
          `You have completed ${d.stats.topicsDone} lessons and taken ${d.stats.quizzesTaken} quizzes. ` +
          `Your best quiz score is ${d.stats.bestScore} percent. ` +
          `You have started ${d.stats.coursesStarted} courses. ` +
          `Say browse courses to continue learning, or explore your activity below.`
        );
      })
      .catch(() => {
        setLoading(false);
        navigate('/login');
      });
  }, []); // eslint-disable-line

  const handleLogout = async () => {
    speak("Logging you out. Goodbye!");
    await axios.post('/api/auth/logout', {}, { headers: authHeaders() });
    clearToken();
    localStorage.removeItem('vl_user');
    setTimeout(() => navigate('/login'), 1500);
  };

  if (loading) return (
    <div className="dash-loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Loading your dashboard...</p>
    </div>
  );

  if (!data) return null;

  const { user, stats, recentActivity } = data;

  return (
    <div className="dashboard-page">
      <div className="container">

        {/* Header */}
        <header className="dash-header">
          <div>
            <h1 className="dash-greeting">
              Hello, <span className="dash-name">{user.fullName.split(' ')[0]}</span> 👋
            </h1>
            <p className="dash-subtitle">
              {user.totalSessions} sessions completed · Last login: {
                user.lastLogin
                  ? new Date(user.lastLogin).toLocaleDateString('en-IN', {day:'numeric',month:'short'})
                  : 'First time!'
              }
            </p>
          </div>
          <div className="dash-header-actions">
            <Link to="/courses" className="btn btn-primary" aria-label="Browse all courses">
              Browse Courses
            </Link>
            <button className="btn btn-ghost" onClick={handleLogout}
                    aria-label="Log out of VoiceLearn">
              Logout
            </button>
          </div>
        </header>

        {/* Stats cards */}
        <div className="dash-stats" role="list" aria-label="Your learning statistics">
          {[
            { label:'Lessons Completed', value: stats.topicsDone,      icon:'📖', color:'amber' },
            { label:'Quizzes Taken',     value: stats.quizzesTaken,    icon:'🧠', color:'teal'  },
            { label:'Best Quiz Score',   value: `${stats.bestScore}%`, icon:'🏆', color:'coral' },
            { label:'Courses Started',   value: stats.coursesStarted,  icon:'📚', color:'amber' },
          ].map(s => (
            <div key={s.label} className={`dash-stat-card dash-stat-${s.color}`} role="listitem">
              <div className="dash-stat-icon" aria-hidden="true">{s.icon}</div>
              <div className="dash-stat-value">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
          {['overview','lessons','quizzes','conversations'].map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`dash-tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); speak(`Showing ${t}`); }}
              aria-label={`View ${t}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div role="tabpanel" aria-label={`${tab} content`} className="dash-panel">

          {tab === 'overview' && (
            <div className="dash-overview">
              <h2 className="dash-section-title">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <div className="dash-empty">
                  <p>No activity yet. <Link to="/courses">Start your first lesson!</Link></p>
                </div>
              ) : (
                <div className="dash-activity-list" role="list">
                  {recentActivity.map((a, i) => (
                    <div key={i} className="dash-activity-item" role="listitem">
                      <div className={`activity-icon ${a.type}`} aria-hidden="true">
                        {a.type === 'lesson' ? '📖' : '🧠'}
                      </div>
                      <div className="activity-info">
                        <div className="activity-type">
                          {a.type === 'lesson' ? 'Lesson completed' : 'Quiz taken'}
                        </div>
                        <div className="activity-detail">
                          {a.course_id?.replace(/-/g,' ')} — {a.detail}
                        </div>
                      </div>
                      <div className="activity-time">
                        {new Date(a.when_).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'lessons' && <LessonsTab />}
          {tab === 'quizzes' && <QuizzesTab />}
          {tab === 'conversations' && <ConversationsTab />}
        </div>
      </div>
    </div>
  );
}

function LessonsTab() {
  const [data, setData] = useState([]);
  useEffect(() => {
    axios.get('/api/history', { headers: authHeaders() })
      .then(res => setData(res.data.progress || []));
  }, []);
  return (
    <div>
      <h2 className="dash-section-title">Lessons Listened ({data.length})</h2>
      {data.length === 0 ? (
        <p className="dash-empty-text">No lessons completed yet. <Link to="/courses">Start learning!</Link></p>
      ) : (
        <div className="dash-list" role="list">
          {data.map((item, i) => (
            <div key={i} className="dash-list-item" role="listitem">
              <span className="dli-icon" aria-hidden="true">📖</span>
              <div className="dli-info">
                <div className="dli-course">{item.course_id?.replace(/-/g,' ')}</div>
                <div className="dli-topic">{item.topic}</div>
              </div>
              <div className="dli-time">
                {new Date(item.listened_at).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizzesTab() {
  const [data, setData] = useState([]);
  useEffect(() => {
    axios.get('/api/history', { headers: authHeaders() })
      .then(res => setData(res.data.quizzes || []));
  }, []);
  return (
    <div>
      <h2 className="dash-section-title">Quiz History ({data.length})</h2>
      {data.length === 0 ? (
        <p className="dash-empty-text">No quizzes taken yet. <Link to="/courses">Try a quiz!</Link></p>
      ) : (
        <div className="dash-list" role="list">
          {data.map((item, i) => (
            <div key={i} className="dash-list-item" role="listitem">
              <span className="dli-icon" aria-hidden="true">🧠</span>
              <div className="dli-info">
                <div className="dli-course">{item.course_id?.replace(/-/g,' ')}</div>
                <div className="dli-topic">{item.score} / {item.total} correct</div>
              </div>
              <div className={`dli-score ${item.percentage >= 80 ? 'good' : item.percentage >= 60 ? 'ok' : 'low'}`}>
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationsTab() {
  const [data, setData] = useState([]);
  useEffect(() => {
    axios.get('/api/history', { headers: authHeaders() })
      .then(res => setData(res.data.chats || []));
  }, []);
  return (
    <div>
      <h2 className="dash-section-title">Conversation History ({data.length} messages)</h2>
      {data.length === 0 ? (
        <p className="dash-empty-text">No conversations yet. Open the AI Assistant to chat!</p>
      ) : (
        <div className="dash-chat-list" role="log" aria-label="Conversation history">
          {[...data].reverse().map((msg, i) => (
            <div key={i} className={`dash-chat-msg ${msg.role}`}>
              <span className="dcm-role" aria-label={msg.role === 'user' ? 'You said' : 'Assistant said'}>
                {msg.role === 'user' ? '🧑' : '🤖'}
              </span>
              <div className="dcm-content">
                <p>{msg.content}</p>
                <span className="dcm-time">
                  {msg.page && `${msg.page} · `}
                  {new Date(msg.created_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}