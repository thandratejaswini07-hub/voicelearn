import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import './Navbar.css';

export default function Navbar() {
  const { speak, stop, isPlaying } = useAudio();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const navLinks = [
    { to: '/',        label: 'Home' },
    { to: '/courses', label: 'Courses' },
    { to: '/about',   label: 'About' },
  ];

  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`} role="banner">
      <div className="navbar-inner container">

        <Link
          to="/"
          className="navbar-logo"
          aria-label="VoiceLearn home"
        >
          <div className="logo-icon" aria-hidden="true">
            <WaveIcon />
          </div>
          <span className="logo-text">VoiceLearn</span>
        </Link>

        <nav className="navbar-links" aria-label="Main navigation">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
              aria-current={location.pathname === link.to ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {isPlaying && (
          <button
            className="btn btn-ghost nav-stop-btn"
            onClick={stop}
            aria-label="Stop audio playback"
          >
            <StopIcon />
            Stop Audio
          </button>
        )}

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span className={`hamburger ${menuOpen ? 'open' : ''}`} aria-hidden="true">
            <span /><span /><span />
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-nav-link ${location.pathname === link.to ? 'active' : ''}`}
              aria-current={location.pathname === link.to ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function WaveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3"  y="10" width="3" height="8"  rx="1.5" fill="currentColor" opacity="0.6"/>
      <rect x="8"  y="6"  width="3" height="16" rx="1.5" fill="currentColor"/>
      <rect x="13" y="3"  width="3" height="22" rx="1.5" fill="currentColor"/>
      <rect x="18" y="6"  width="3" height="16" rx="1.5" fill="currentColor"/>
      <rect x="23" y="10" width="3" height="8"  rx="1.5" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="2"/>
    </svg>
  );
}