import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import Navbar from './components/Navbar';
import AudioStatusBar from './components/AudioStatusBar';
import VoiceAssistant from './components/VoiceAssistant';
import LandingPage from './pages/LandingPage';
import CoursesPage from './pages/CoursesPage';
import CoursePage from './pages/CoursePage';
import QuizPage from './pages/QuizPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('vl_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AudioProvider>
      <BrowserRouter>
        <div className="grain-overlay" aria-hidden="true" />
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />

        <a href="#main-content" className="skip-link">Skip to main content</a>

        <Routes>
          {/* Login — no navbar */}
          <Route path="/login" element={<LoginPage />} />

          {/* All other pages — with navbar */}
          <Route path="/*" element={
            <>
              <Navbar />
              <AudioStatusBar />
              <main id="main-content" tabIndex="-1">
                <Routes>
                  <Route path="/"            element={<LandingPage />} />
                  <Route path="/courses"     element={<CoursesPage />} />
                  <Route path="/courses/:id" element={<CoursePage />} />
                  <Route path="/quiz/:id"    element={<QuizPage />} />
                  <Route path="/about"       element={<AboutPage />} />
                  <Route path="/dashboard"   element={
                    <PrivateRoute><DashboardPage /></PrivateRoute>
                  } />
                </Routes>
              </main>
              <VoiceAssistant />
            </>
          } />
        </Routes>
      </BrowserRouter>
    </AudioProvider>
  );
}