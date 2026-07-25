import React from 'react';
import { useAudio } from '../context/AudioContext';
import './AudioStatusBar.css';

export default function AudioStatusBar() {
  const { isPlaying, isLoading, currentText, stop } = useAudio();

  if (!isPlaying && !isLoading) return null;

  return (
    <div
      className="audio-status-bar"
      role="status"
      aria-live="polite"
      aria-label={isLoading ? 'Loading audio...' : 'Now playing audio'}
    >
      <div className="asb-inner container">
        <div className="asb-left">
          {isLoading ? (
            <div className="asb-loading">
              <div className="spinner" aria-hidden="true" />
              <span>Generating audio…</span>
            </div>
          ) : (
            <>
              <div className="waveform" aria-hidden="true">
                {[1,2,3,4,5,6,7].map(i => <div key={i} className="bar" />)}
              </div>
              <span className="asb-label">Now Speaking</span>
            </>
          )}
        </div>

        {currentText && (
          <p className="asb-text" aria-hidden="true">
            {currentText.length > 80 ? currentText.slice(0, 80) + '…' : currentText}
          </p>
        )}

        <button
          className="asb-stop"
          onClick={stop}
          aria-label="Stop audio"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="2" y="2" width="10" height="10" rx="1.5"/>
          </svg>
          Stop
        </button>
      </div>
    </div>
  );
}