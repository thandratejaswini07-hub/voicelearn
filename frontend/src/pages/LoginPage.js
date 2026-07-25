import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudio, useAutoVoice, setToken } from '../context/AudioContext';
import axios from 'axios';
import './LoginPage.css';

const FIELD_PROMPTS = {
  username: "Please say or type your username.",
  password: "Please say or type your password.",
  fullName: "Please say or type your full name.",
  email:    "Please say or type your email address. You can also say skip to continue without email.",
};

export default function LoginPage() {
  const { speak, stop } = useAudio();
  const navigate = useNavigate();

  const [mode,    setMode]    = useState('welcome'); // welcome | login | register
  const [step,    setStep]    = useState('');
  const [fields,  setFields]  = useState({ username:'', password:'', fullName:'', email:'' });
  const [status,  setStatus]  = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  // ── Auto voice handler ────────────────────────────────────────────────
  const handleTranscript = useCallback((transcript) => {
    const t = transcript.toLowerCase().trim();
    console.log('Heard:', transcript);

    // Welcome screen commands
    if (mode === 'welcome') {
      if (t.includes('login') || t.includes('log in') || t.includes('sign in')) {
        startLogin();
      } else if (t.includes('register') || t.includes('sign up') || t.includes('create account') || t.includes('new account')) {
        startRegister();
      } else {
        speak("I heard: " + transcript + ". Please say login to log in, or register to create a new account.");
      }
      return;
    }

    // Form filling by voice
    if (step) {
      if (t.includes('skip') && step === 'email') {
        setFields(f => ({ ...f, email: '' }));
        submitForm({ ...fields, email: '' });
        return;
      }
      if (t.includes('cancel') || t.includes('go back')) {
        setMode('welcome');
        setStep('');
        speak("Cancelled. Welcome back. Say login or register.");
        return;
      }
      // Fill the current field with the spoken text
      fillField(step, transcript);
    }
  }, [mode, step, fields]); // eslint-disable-line

  const { listening, error: voiceError } = useAutoVoice({
    onTranscript: handleTranscript,
    enabled: voiceOn && !loading,
    pauseWhileSpeaking: true,
  });

  // ── Welcome announcement ──────────────────────────────────────────────
  useEffect(() => {
    document.title = 'VoiceLearn — Login';
    // Check if already logged in
    const token = localStorage.getItem('vl_token');
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.data.user) navigate('/');
        }).catch(() => {});
    }

    setTimeout(() => {
      speak("Welcome to VoiceLearn, your audio-first learning platform. " +
        "You can use your voice to log in or create an account. " +
        "Say login to sign in to your existing account, or say register to create a new account. " +
        "You can also type using the keyboard.");
    }, 600);
  }, []); // eslint-disable-line

  // ── Start login flow ──────────────────────────────────────────────────
  const startLogin = () => {
    setMode('login');
    setFields({ username:'', password:'', fullName:'', email:'' });
    setStep('username');
    speak("Starting login. " + FIELD_PROMPTS.username);
  };

  // ── Start register flow ───────────────────────────────────────────────
  const startRegister = () => {
    setMode('register');
    setFields({ username:'', password:'', fullName:'', email:'' });
    setStep('fullName');
    speak("Creating a new account. Let's start with your name. " + FIELD_PROMPTS.fullName);
  };

  // ── Fill a field and advance ──────────────────────────────────────────
  const fillField = (field, value) => {
    const clean = value.trim();
    // For password, don't echo it back
    const echo  = field === 'password' ? 'password received' : clean;
    setFields(prev => {
      const updated = { ...prev, [field]: clean };
      speak(`${echo}. `);
      // Advance to next field after short delay
      setTimeout(() => advanceStep(field, updated), 1800);
      return updated;
    });
  };

  // ── Advance to next step ──────────────────────────────────────────────
  const advanceStep = (currentField, currentFields) => {
    if (mode === 'login') {
      if (currentField === 'username') {
        setStep('password');
        speak(FIELD_PROMPTS.password);
      } else if (currentField === 'password') {
        setStep('');
        submitForm(currentFields);
      }
    } else { // register
      if (currentField === 'fullName') {
        setStep('username');
        speak("Great! Now " + FIELD_PROMPTS.username);
      } else if (currentField === 'username') {
        setStep('password');
        speak("Good. " + FIELD_PROMPTS.password);
      } else if (currentField === 'password') {
        setStep('email');
        speak(FIELD_PROMPTS.email);
      } else if (currentField === 'email') {
        setStep('');
        submitForm(currentFields);
      }
    }
  };

  // ── Submit form ───────────────────────────────────────────────────────
  const submitForm = async (formFields) => {
    setLoading(true);
    setVoiceOn(false);
    setStatus('Processing...');
    speak("Please wait while I process your request.");

    try {
      let res;
      if (mode === 'login') {
        res = await axios.post('/api/auth/login', {
          username: formFields.username,
          password: formFields.password,
        });
      } else {
        res = await axios.post('/api/auth/register', {
          username:  formFields.username,
          password:  formFields.password,
          fullName:  formFields.fullName,
          email:     formFields.email,
        });
      }

      if (res.data.token) {
        setToken(res.data.token);
        localStorage.setItem('vl_user', JSON.stringify(res.data.user));
        setStatus('Success!');

        if (res.data.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
          audio.play().catch(() => speak(res.data.message));
          audio.onended = () => navigate('/');
        } else {
          speak(res.data.message, { onEnd: () => navigate('/') });
        }
      }
    } catch (err) {
      setLoading(false);
      setVoiceOn(true);
      const msg = err.response?.data?.error || "Something went wrong. Please try again.";
      setStatus('');

      if (err.response?.data?.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${err.response.data.audio}`);
        audio.play().catch(() => speak(msg));
        audio.onended = () => {
          if (mode === 'login') startLogin();
          else startRegister();
        };
      } else {
        speak(msg, {
          onEnd: () => {
            if (mode === 'login') startLogin();
            else startRegister();
          }
        });
      }
    }
  };

  // ── Manual keyboard submit ─────────────────────────────────────────────
  const handleKeyboardSubmit = (e) => {
    e.preventDefault();
    setStep('');
    submitForm(fields);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const loginSteps    = ['username','password'];
  const registerSteps = ['fullName','username','password','email'];
  const steps         = mode === 'login' ? loginSteps : registerSteps;
  const currentIdx    = steps.indexOf(step);
  const progress      = step ? ((currentIdx + 1) / steps.length) * 100 : 0;

  return (
    <div className="login-page">
      {/* Background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
      </div>

      <div className="login-container">

        {/* Logo */}
        <div className="login-logo" aria-label="VoiceLearn">
          <WaveIcon />
          <span>VoiceLearn</span>
        </div>

        {/* Mic status indicator */}
        <div className={`login-mic-status ${listening ? 'active' : ''}`}
             role="status" aria-live="polite">
          <div className={`mic-dot ${listening ? 'listening' : ''}`} aria-hidden="true" />
          <span>{listening ? '🎤 Listening — speak now...' : '🔇 Microphone ready'}</span>
        </div>

        {voiceError && (
          <div className="login-voice-error" role="alert">
            ⚠️ {voiceError}
          </div>
        )}

        {/* Main card */}
        <div className="login-card" role="main">

          {/* Welcome screen */}
          {mode === 'welcome' && (
            <div className="login-welcome" aria-labelledby="welcome-heading">
              <h1 id="welcome-heading" className="login-title">
                Welcome to<br />
                <span className="login-title-em">VoiceLearn</span>
              </h1>
              <p className="login-subtitle">
                Your audio-first learning platform. Use your voice or keyboard to continue.
              </p>
              <div className="login-voice-hint" aria-live="polite">
                {listening
                  ? 'Say "login" or "register" — I am listening'
                  : 'Say "login" or "register"'}
              </div>
              <div className="login-btn-row">
                <button
                  className="btn btn-primary login-btn"
                  onClick={startLogin}
                  aria-label="Log in to your existing account"
                >
                  <span>🔑</span> Login
                </button>
                <button
                  className="btn btn-outline login-btn"
                  onClick={startRegister}
                  aria-label="Create a new account"
                >
                  <span>✨</span> Register
                </button>
              </div>
              <button
                className="login-replay-btn"
                onClick={() => speak("Say login to sign in, or say register to create a new account.")}
                aria-label="Replay instructions"
              >
                🔊 Replay Instructions
              </button>
            </div>
          )}

          {/* Login / Register form */}
          {mode !== 'welcome' && (
            <div className="login-form-section" aria-labelledby="form-heading">
              <h2 id="form-heading" className="login-form-title">
                {mode === 'login' ? '🔑 Sign In' : '✨ Create Account'}
              </h2>

              {/* Progress */}
              {step && (
                <div className="login-progress" role="progressbar"
                     aria-valuenow={currentIdx + 1} aria-valuemax={steps.length}
                     aria-label={`Step ${currentIdx + 1} of ${steps.length}`}>
                  <div className="login-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              )}

              {/* Current field indicator */}
              {step && (
                <div className="login-step-label" aria-live="assertive">
                  <div className="step-field-name">
                    {step === 'fullName' ? 'Full Name' :
                     step === 'username' ? 'Username' :
                     step === 'password' ? 'Password' : 'Email'}
                  </div>
                  <div className="step-prompt">
                    {listening ? '🎤 Speak now or type below...' : 'Say it or type it below'}
                  </div>
                </div>
              )}

              {/* Voice waveform when listening */}
              {listening && step && (
                <div className="login-waveform waveform" aria-hidden="true">
                  {[1,2,3,4,5,6,7].map(i => <div key={i} className="bar" />)}
                </div>
              )}

              {/* Keyboard form */}
              <form onSubmit={handleKeyboardSubmit} className="login-keyboard-form"
                    aria-label={`${mode === 'login' ? 'Login' : 'Registration'} form`}>

                {mode === 'register' && (
                  <div className={`login-field ${step === 'fullName' ? 'active' : ''}`}>
                    <label htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName" type="text"
                      value={fields.fullName}
                      onChange={e => setFields(f => ({...f, fullName: e.target.value}))}
                      onFocus={() => { setStep('fullName'); speak(FIELD_PROMPTS.fullName); }}
                      placeholder="Your full name"
                      aria-label="Full name"
                      disabled={loading}
                    />
                  </div>
                )}

                <div className={`login-field ${step === 'username' ? 'active' : ''}`}>
                  <label htmlFor="username">Username</label>
                  <input
                    id="username" type="text"
                    value={fields.username}
                    onChange={e => setFields(f => ({...f, username: e.target.value}))}
                    onFocus={() => { setStep('username'); speak(FIELD_PROMPTS.username); }}
                    placeholder="Your username"
                    aria-label="Username"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className={`login-field ${step === 'password' ? 'active' : ''}`}>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password" type="password"
                    value={fields.password}
                    onChange={e => setFields(f => ({...f, password: e.target.value}))}
                    onFocus={() => { setStep('password'); speak(FIELD_PROMPTS.password); }}
                    placeholder="Your password"
                    aria-label="Password"
                    disabled={loading}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>

                {mode === 'register' && (
                  <div className={`login-field ${step === 'email' ? 'active' : ''}`}>
                    <label htmlFor="email">Email (optional)</label>
                    <input
                      id="email" type="email"
                      value={fields.email}
                      onChange={e => setFields(f => ({...f, email: e.target.value}))}
                      onFocus={() => { setStep('email'); speak(FIELD_PROMPTS.email); }}
                      placeholder="Your email (optional)"
                      aria-label="Email address, optional"
                      disabled={loading}
                    />
                  </div>
                )}

                {loading ? (
                  <div className="login-loading" role="status" aria-live="polite">
                    <div className="spinner" aria-hidden="true" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary login-submit-btn"
                    disabled={loading || (!fields.username || !fields.password ||
                              (mode === 'register' && !fields.fullName))}
                    aria-label={mode === 'login' ? 'Log in' : 'Create account'}
                  >
                    {mode === 'login' ? '🔑 Login' : '✨ Create Account'}
                  </button>
                )}
              </form>

              {/* Voice instructions */}
              <div className="login-voice-guide" aria-live="polite">
                {step ? (
                  <p>🎤 Say your {step === 'fullName' ? 'full name' :
                                   step === 'username' ? 'username' :
                                   step === 'password' ? 'password' : 'email'} aloud, or type it above.</p>
                ) : (
                  <p>Fill all fields and click the button, or use your voice.</p>
                )}
                <p className="voice-cancel-hint">Say "cancel" to go back to the welcome screen.</p>
              </div>

              <button
                className="login-switch-btn"
                onClick={() => {
                  setMode('welcome');
                  setStep('');
                  speak("Returned to welcome screen. Say login or register.");
                }}
                aria-label="Go back to welcome screen"
              >
                ← Back
              </button>
            </div>
          )}
        </div>

        {/* Status message */}
        {status && (
          <div className="login-status" role="status" aria-live="assertive">
            {status}
          </div>
        )}

        <p className="login-footer-text">
          Audio-first platform for visually impaired learners
        </p>
      </div>
    </div>
  );
}

function WaveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3"  y="10" width="3" height="8"  rx="1.5" fill="currentColor" opacity="0.6"/>
      <rect x="8"  y="6"  width="3" height="16" rx="1.5" fill="currentColor"/>
      <rect x="13" y="3"  width="3" height="22" rx="1.5" fill="currentColor"/>
      <rect x="18" y="6"  width="3" height="16" rx="1.5" fill="currentColor"/>
      <rect x="23" y="10" width="3" height="8"  rx="1.5" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}