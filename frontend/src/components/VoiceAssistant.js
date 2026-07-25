import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import axios from 'axios';
import './VoiceAssistant.css';

// Session ID persisted in sessionStorage
const getSessionId = () => {
  let id = sessionStorage.getItem('vl_session');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem('vl_session', id);
  }
  return id;
};

const WELCOME_MSG = {
  role: 'assistant',
  content: "Hello! I am your VoiceLearn voice assistant. You can talk to me using the microphone button, or type your message below. Ask me about any course, request a lesson, take a quiz, or just say hello. How can I help you today?",
};

// Voice navigation commands mapping
const VOICE_COMMANDS = {
  'go to courses': '/courses',
  'open courses': '/courses',
  'show courses': '/courses',
  'browse courses': '/courses',
  'go home': '/',
  'go to home': '/',
  'home page': '/',
  'about page': '/about',
  'go to about': '/about',
  'python course': '/courses/python-basics',
  'open python': '/courses/python-basics',
  'web development course': '/courses/web-basics',
  'open web': '/courses/web-basics',
  'data science course': '/courses/data-science-intro',
  'open data science': '/courses/data-science-intro',
  'english course': '/courses/english-communication',
  'open english': '/courses/english-communication',
  'digital literacy course': '/courses/digital-literacy',
  'open digital literacy': '/courses/digital-literacy',
  'mindfulness course': '/courses/mindfulness-wellbeing',
  'open mindfulness': '/courses/mindfulness-wellbeing',
  'python quiz': '/quiz/python-basics',
  'web quiz': '/quiz/web-basics',
  'data science quiz': '/quiz/data-science-intro',
  'english quiz': '/quiz/english-communication',
  'digital literacy quiz': '/quiz/digital-literacy',
  'mindfulness quiz': '/quiz/mindfulness-wellbeing',
};

export default function VoiceAssistant() {
  const { speak, stop, isPlaying } = useAudio();
  const location  = useLocation();
  const navigate  = useNavigate();
  const sessionId = getSessionId();

  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([WELCOME_MSG]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [hasGreeted, setHasGreeted]     = useState(false);
  const [voiceError, setVoiceError]     = useState('');

  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const recognitionRef  = useRef(null);
  const responseAudioRef= useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Focus input when opened + greet
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (!hasGreeted) {
        setHasGreeted(true);
        setTimeout(() => speak(WELCOME_MSG.content), 600);
      }
    }
  }, [open, speak, hasGreeted]);

  // Check mic availability
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicAvailable(false);
    } else {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(() => setMicAvailable(true))
        .catch(() => setMicAvailable(false));
    }
  }, []);

  // Play audio response from backend
  const playResponseAudio = useCallback((base64Audio, onEnd) => {
    if (responseAudioRef.current) {
      responseAudioRef.current.pause();
    }
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    responseAudioRef.current = audio;
    audio.onended = onEnd || null;
    audio.onerror = () => { if (onEnd) onEnd(); };
    audio.play().catch(() => { if (onEnd) onEnd(); });
  }, []);

  // Check for navigation voice commands
  const checkVoiceNavigation = useCallback((transcript) => {
    const lower = transcript.toLowerCase().trim();
    for (const [command, path] of Object.entries(VOICE_COMMANDS)) {
      if (lower.includes(command)) {
        return path;
      }
    }
    return null;
  }, []);

  // Send message to backend (works for both voice and text)
  const sendMessage = useCallback(async (text) => {
    const message = text.trim();
    if (!message || loading) return;

    setInput('');
    setVoiceError('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);

    // Check for navigation commands first
    const navPath = checkVoiceNavigation(message);

    // Build context
    const pathParts = location.pathname.split('/');
    const currentCourse = pathParts[1] === 'courses' && pathParts[2] ? pathParts[2] : null;
    const pageMap = { '/': 'home', '/courses': 'courses', '/about': 'about' };
    const currentPage = currentCourse
      ? `course:${currentCourse}`
      : (pageMap[location.pathname] || location.pathname);

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      // Use /api/voice endpoint for voice input, /api/chat for text
      const endpoint = '/api/voice';
      const res = await axios.post(endpoint, {
        transcript: message,
        sessionId,
        context: { currentCourse, currentPage },
        history,
      });

      const reply = res.data.reply;
      const audio = res.data.audio;

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Play audio response
      if (audio) {
        stop(); // Stop any current TTS
        playResponseAudio(audio, () => {
          // After response plays, navigate if command detected
          if (navPath) navigate(navPath);
        });
      } else {
        speak(reply);
        if (navPath) setTimeout(() => navigate(navPath), 2000);
      }

    } catch (err) {
      const errMsg = "I'm having trouble connecting right now. Please check that the backend server is running and try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
      speak(errMsg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, location, speak, stop, sessionId, navigate, checkVoiceNavigation, playResponseAudio]); // eslint-disable-line

  // Start voice recognition — the MAIN voice feature
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Your browser doesn't support voice input. Please use Chrome or Edge.");
      speak("Sorry, your browser does not support voice input. Please use Google Chrome or Microsoft Edge for voice features.");
      return;
    }

    // Stop any playing audio before listening
    stop();
    if (responseAudioRef.current) responseAudioRef.current.pause();

    // Stop existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults= false;
    recognition.lang          = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceError('');
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'no-speech') {
        setVoiceError("No speech detected. Please try again.");
      } else if (event.error === 'not-allowed') {
        setVoiceError("Microphone access denied. Please allow mic access in your browser.");
        setMicAvailable(false);
      } else if (event.error === 'network') {
        setVoiceError("Network error. Please check your connection.");
      } else {
        setVoiceError(`Voice error: ${event.error}. Please try again.`);
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      // Auto-send the voice input
      setTimeout(() => sendMessage(transcript), 200);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setVoiceError("Could not start microphone. Please try again.");
      setListening(false);
    }
  }, [stop, speak, sendMessage]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const replayMessage = (text) => {
    stop();
    speak(text);
  };

  const clearChat = () => {
    setMessages([WELCOME_MSG]);
    speak("Chat cleared. How can I help you?");
  };

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        className={`va-fab ${open ? 'open' : ''} ${isPlaying ? 'pulsing' : ''} ${listening ? 'listening-fab' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close voice assistant' : 'Open voice assistant — talk or type to your AI tutor'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {open ? <CloseIcon /> : <MicIcon />}
        {!open && <span className="va-fab-label" aria-hidden="true">Ask Me</span>}
        {!open && (isPlaying || listening) && (
          <div className="va-fab-wave" aria-hidden="true">
            {[1,2,3].map(i => <div key={i} className="mini-bar" />)}
          </div>
        )}
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div
          className="va-panel"
          role="dialog"
          aria-label="VoiceLearn AI Voice Assistant"
          aria-modal="false"
        >
          {/* Header */}
          <div className="va-header">
            <div className="va-header-left">
              <div className="va-avatar" aria-hidden="true">
                <div className={`waveform ${!isPlaying ? 'paused' : ''}`}>
                  {[1,2,3,4,5].map(i => <div key={i} className="bar" />)}
                </div>
              </div>
              <div>
                <div className="va-name">Voice Assistant</div>
                <div className="va-status" aria-live="polite">
                  {listening  ? '🎤 Listening — speak now...' :
                   loading    ? '🤔 Thinking...' :
                   isPlaying  ? '🔊 Speaking...' :
                                '✅ Ready — tap mic or type'}
                </div>
              </div>
            </div>
            <div className="va-header-actions">
              <button
                className="va-clear-btn"
                onClick={clearChat}
                aria-label="Clear chat history"
                title="Clear chat"
              >
                <TrashIcon />
              </button>
              <button
                className="va-close-btn"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Voice Error Banner */}
          {voiceError && (
            <div className="va-voice-error" role="alert" aria-live="assertive">
              <span>⚠️</span>
              <span>{voiceError}</span>
              <button onClick={() => setVoiceError('')} aria-label="Dismiss error">×</button>
            </div>
          )}

          {/* Mic not available warning */}
          {!micAvailable && (
            <div className="va-voice-error" role="alert">
              <span>🎤</span>
              <span>Voice input unavailable. Use Chrome/Edge and allow microphone access. You can still type below.</span>
            </div>
          )}

          {/* Messages */}
          <div
            className="va-messages"
            role="log"
            aria-live="polite"
            aria-label="Conversation history"
            aria-relevant="additions"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`va-message ${msg.role}`}>
                <div className="va-bubble">
                  <p>{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <button
                      className="va-replay"
                      onClick={() => replayMessage(msg.content)}
                      aria-label="Read this message aloud again"
                      title="Replay"
                    >
                      <SpeakerIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="va-message assistant" aria-label="Assistant is thinking">
                <div className="va-bubble va-typing" aria-hidden="true">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Voice Commands */}
          {messages.length <= 2 && (
            <div className="va-suggestions" role="group" aria-label="Quick voice commands — tap to send">
              {[
                'What courses are available?',
                'Open Python course',
                'Tell me about mindfulness',
                'Go to courses page',
              ].map(s => (
                <button
                  key={s}
                  className="va-chip"
                  onClick={() => sendMessage(s)}
                  aria-label={`Say: ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="va-input-area">
            <textarea
              ref={inputRef}
              className="va-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? 'Listening... speak now' : 'Type or tap 🎤 to speak...'}
              rows={1}
              disabled={loading || listening}
              aria-label="Type your message or use the microphone button to speak"
              aria-multiline="false"
            />
            <div className="va-actions">
              {/* MICROPHONE BUTTON — main voice input */}
              {micAvailable ? (
                <button
                  className={`va-mic-btn ${listening ? 'listening' : ''}`}
                  onClick={listening ? stopListening : startListening}
                  disabled={loading}
                  aria-label={listening ? 'Stop listening — click to stop recording' : 'Start voice input — click and speak your question'}
                  aria-pressed={listening}
                  title={listening ? 'Stop listening' : 'Speak to assistant'}
                >
                  {listening ? <StopListenIcon /> : <MicIcon />}
                </button>
              ) : (
                <button
                  className="va-mic-btn disabled"
                  disabled
                  aria-label="Microphone unavailable — use Chrome or Edge browser"
                  title="Mic unavailable"
                >
                  <MicOffIcon />
                </button>
              )}

              {/* SEND BUTTON */}
              <button
                className="va-send-btn"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          {/* Voice hint */}
          <div className="va-hint" aria-hidden="true">
            {micAvailable
              ? '🎤 Tap mic and speak — or type below. Say "open Python course" to navigate.'
              : '⌨️ Type your message and press Enter to send.'}
          </div>
        </div>
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8"  y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8"  y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function StopListenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="15" y1="5" x2="5"  y2="15"/>
      <line x1="5"  y1="5" x2="15" y2="15"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}