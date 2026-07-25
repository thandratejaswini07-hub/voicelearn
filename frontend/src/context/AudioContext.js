import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const AudioCtx = createContext(null);

// ── Shared token helper ───────────────────────────────────────────────────────
export const getToken  = ()      => localStorage.getItem('vl_token') || '';
export const setToken  = (t)     => localStorage.setItem('vl_token', t);
export const clearToken= ()      => localStorage.removeItem('vl_token');
export const authHeaders = ()    => ({ Authorization: `Bearer ${getToken()}` });

export function AudioProvider({ children }) {
  const audioRef     = useRef(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [currentText,setCurrentText]= useState('');

  // ── Stop all audio ──────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentText('');
  }, []);

  // ── Play base64 MP3 ─────────────────────────────────────────────────────
  const playBase64 = useCallback((b64, onEnd) => {
    stop();
    const audio = new Audio(`data:audio/mp3;base64,${b64}`);
    audioRef.current = audio;
    audio.onplay  = () => setIsPlaying(true);
    audio.onended = () => { setIsPlaying(false); setCurrentText(''); if (onEnd) onEnd(); };
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
    return audio;
  }, [stop]);

  // ── Browser TTS (best available voice) ─────────────────────────────────
  const speakBrowser = useCallback((text, onEnd) => {
    stop();
    if (!window.speechSynthesis) return;
    const doSpeak = () => {
      const utter   = new SpeechSynthesisUtterance(text);
      utter.rate    = 0.92;
      utter.pitch   = 1.0;
      utter.volume  = 1.0;
      utter.lang    = 'en-US';
      const voices  = window.speechSynthesis.getVoices();
      const best    = voices.find(v => v.name === 'Google US English')
        || voices.find(v => v.name.includes('Aria Online'))
        || voices.find(v => v.name.includes('Jenny Online'))
        || voices.find(v => v.name.includes('Natural'))
        || voices.find(v => v.lang === 'en-US')
        || voices[0];
      if (best) utter.voice = best;
      utter.onstart = () => { setIsPlaying(true); setCurrentText(text); };
      utter.onend   = () => { setIsPlaying(false); setCurrentText(''); if (onEnd) onEnd(); };
      utter.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utter);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = doSpeak;
    } else {
      doSpeak();
    }
  }, [stop]);

  // ── Main speak — backend TTS first, browser fallback ───────────────────
  const speak = useCallback(async (text, { onEnd } = {}) => {
    if (!text) return;
    stop();
    setCurrentText(text);
    try {
      setIsLoading(true);
      const res = await axios.post('/api/tts', { text },
        { headers: authHeaders() });
      setIsLoading(false);
      if (res.data.audio) {
        playBase64(res.data.audio, onEnd);
      } else {
        speakBrowser(text, onEnd);
      }
    } catch {
      setIsLoading(false);
      speakBrowser(text, onEnd);
    }
  }, [stop, playBase64, speakBrowser]);

  return (
    <AudioCtx.Provider value={{
      speak, stop, playBase64, speakBrowser,
      isPlaying, isLoading, currentText
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be inside AudioProvider');
  return ctx;
}

// ── Auto Voice Recognition hook ───────────────────────────────────────────────
// Call this on any page to get continuous voice commands
export function useAutoVoice({ onTranscript, enabled = true, pauseWhileSpeaking = true }) {
  const { isPlaying, stop } = useAudio();
  const recRef  = useRef(null);
  const [listening, setListening] = useState(false);
  const [error,     setError]     = useState('');
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !enabledRef.current) return;
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
    }
    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart  = () => { setListening(true); setError(''); };
    rec.onend    = () => {
      setListening(false);
      // Auto-restart after a short delay if enabled
      if (enabledRef.current) {
        setTimeout(() => startListening(), 1500);
      }
    };
    rec.onerror  = (e) => {
      setListening(false);
      if (e.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone in browser settings.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Voice error: ${e.error}`);
      }
    };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript && onTranscript) onTranscript(transcript);
    };

    recRef.current = rec;
    // If audio is playing and we're set to pause, wait
    if (pauseWhileSpeaking && isPlaying) {
      const wait = setInterval(() => {
        if (!isPlaying) {
          clearInterval(wait);
          try { rec.start(); } catch {}
        }
      }, 500);
    } else {
      try { rec.start(); } catch {}
    }
  }, [isPlaying, onTranscript, pauseWhileSpeaking]);

  const stopListening = useCallback(() => {
    enabledRef.current = false;
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      // Small delay before auto-starting
      const t = setTimeout(() => startListening(), 1000);
      return () => clearTimeout(t);
    } else {
      stopListening();
    }
  }, [enabled]); // eslint-disable-line

  useEffect(() => {
    return () => {
      enabledRef.current = false;
      if (recRef.current) try { recRef.current.stop(); } catch {}
    };
  }, []);

  return { listening, error, startListening, stopListening };
}