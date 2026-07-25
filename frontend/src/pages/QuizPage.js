import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuiz, getQuizAudio } from '../services/api';
import { useAudio } from '../context/AudioContext';
import './QuizPage.css';

export default function QuizPage() {
  const { id } = useParams();
  const { speak, stop } = useAudio();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const questionAudioRef = useRef(null);
  const optionRefs = useRef([]);

  // Load quiz
  useEffect(() => {
    document.title = 'Audio Quiz — VoiceLearn';
    getQuiz(id)
      .then(res => {
        setQuestions(res.data.questions);
        setLoading(false);
        speak(`Audio Quiz started. This quiz has ${res.data.total} questions. Each question and all answer choices will be read aloud automatically. Press 1, 2, 3, or 4 on your keyboard to select an answer.`);
      })
      .catch(() => {
        setLoading(false);
        speak('Sorry, I could not load the quiz. Please go back and try again.');
      });

    return () => {
      stop();
      if (questionAudioRef.current) questionAudioRef.current.pause();
    };
  }, [id, speak, stop]);

  // Auto-read question when it changes
  const readQuestion = useCallback(async (q) => {
    stop();
    if (questionAudioRef.current) {
      questionAudioRef.current.pause();
      questionAudioRef.current = null;
    }
    setAudioLoading(true);

    try {
      const res = await getQuizAudio(q.question, q.options);
      setAudioLoading(false);
      if (res.data.audio) {
        const audioEl = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        questionAudioRef.current = audioEl;
        audioEl.play().catch(() => {
          const txt = `Question: ${q.question}. Your options are: Option A: ${q.options[0]}. Option B: ${q.options[1]}. Option C: ${q.options[2]}. Option D: ${q.options[3]}.`;
          speak(txt);
        });
      } else {
        const txt = `Question: ${q.question}. Your options are: Option A: ${q.options[0]}. Option B: ${q.options[1]}. Option C: ${q.options[2]}. Option D: ${q.options[3]}.`;
        speak(txt);
      }
    } catch {
      setAudioLoading(false);
      const txt = `Question: ${q.question}. Option A: ${q.options[0]}. Option B: ${q.options[1]}. Option C: ${q.options[2]}. Option D: ${q.options[3]}.`;
      speak(txt);
    }
  }, [speak, stop]);

  useEffect(() => {
    if (questions.length > 0 && !finished) {
      setSelected(null);
      setAnswered(false);
      setTimeout(() => readQuestion(questions[currentQ]), 400);
    }
  }, [currentQ, questions, finished, readQuestion]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (finished) return;
      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') handleNext();
        return;
      }
      const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined) handleSelect(idx);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [answered, finished, currentQ, questions]); // eslint-disable-line

  const handleSelect = (idx) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const q = questions[currentQ];
    const isCorrect = idx === q.answer;
    if (isCorrect) setScore(s => s + 1);
    setResults(r => [...r, { question: q.question, selected: idx, correct: q.answer, isCorrect }]);

    const optionLabel = String.fromCharCode(65 + idx);
    const feedback = isCorrect
      ? `Correct! You selected Option ${optionLabel}: ${q.options[idx]}. ${q.explanation}`
      : `Not quite. You selected Option ${optionLabel}: ${q.options[idx]}. The correct answer is Option ${String.fromCharCode(65 + q.answer)}: ${q.options[q.answer]}. ${q.explanation}`;

    setTimeout(() => speak(feedback), 300);
  };

  const handleNext = () => {
    if (!answered) return;
    stop();
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      setFinished(true);
      const pct = Math.round((score / questions.length) * 100);
      const actualScore = results.filter(r => r.isCorrect).length + (selected === questions[currentQ].answer ? 1 : 0);
      const actualPct = Math.round((actualScore / questions.length) * 100);
      const msg = actualPct >= 80
        ? `Quiz complete! Outstanding work! You scored ${actualScore} out of ${questions.length}, that's ${actualPct} percent. You've mastered this material!`
        : actualPct >= 60
        ? `Quiz complete! Good effort! You scored ${actualScore} out of ${questions.length}, that's ${actualPct} percent. Review the topics you missed and try again.`
        : `Quiz complete. You scored ${actualScore} out of ${questions.length}, that's ${actualPct} percent. I recommend revisiting the course lessons and trying the quiz again. You'll improve with practice!`;
      setTimeout(() => speak(msg), 400);
    }
  };

  const handleReplay = () => {
    if (questions.length > 0) readQuestion(questions[currentQ]);
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setResults([]);
    speak('Quiz restarted. Let\'s try again from the beginning.');
  };

  if (loading) {
    return (
      <div className="quiz-loading" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Preparing your audio quiz…</p>
      </div>
    );
  }

  if (finished) {
    const finalScore = results.filter(r => r.isCorrect).length;
    const pct = Math.round((finalScore / questions.length) * 100);
    const grade = pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : 'needs-work';

    return (
      <div className="quiz-page">
        <div className="container">
          <div className="quiz-results" role="main" aria-labelledby="results-heading">
            <div className={`results-header grade-${grade}`}>
              <div className="results-icon" aria-hidden="true">
                {pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}
              </div>
              <h1 id="results-heading" className="results-title">Quiz Complete!</h1>

              <div className="results-score" aria-label={`Score: ${finalScore} out of ${questions.length}, ${pct} percent`}>
                <div className="score-circle">
                  <span className="score-num">{finalScore}</span>
                  <span className="score-denom">/{questions.length}</span>
                </div>
                <div className="score-pct">{pct}%</div>
              </div>

              <p className="results-msg">
                {pct >= 80 ? 'Excellent! You have a strong grasp of this material.' :
                 pct >= 60 ? 'Good work! Review the missed questions and try again.' :
                 'Keep practicing! Every attempt brings improvement.'}
              </p>
            </div>

            {/* Result breakdown */}
            <div className="results-breakdown" role="list" aria-label="Question results">
              <h2 className="breakdown-title">Question Review</h2>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`result-item ${r.isCorrect ? 'correct' : 'incorrect'}`}
                  role="listitem"
                  aria-label={`Question ${i + 1}: ${r.isCorrect ? 'Correct' : 'Incorrect'}`}
                >
                  <div className="result-status" aria-hidden="true">
                    {r.isCorrect ? '✓' : '✗'}
                  </div>
                  <div className="result-details">
                    <p className="result-question">{r.question}</p>
                    {!r.isCorrect && (
                      <p className="result-answer">
                        Correct: {questions[i].options[r.correct]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="results-actions">
              <button
                className="btn btn-ghost"
                onClick={handleRestart}
                aria-label="Restart the quiz from the beginning"
              >
                <RefreshIcon />
                Retake Quiz
              </button>
              <Link
                to={`/courses/${id}`}
                className="btn btn-ghost"
                aria-label="Go back to the course lessons"
              >
                ← Back to Course
              </Link>
              <Link
                to="/courses"
                className="btn btn-primary"
                aria-label="Browse other courses"
              >
                Browse Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;
  const progress = ((currentQ) / questions.length) * 100;

  return (
    <div className="quiz-page">
      <div className="container">

        {/* Quiz header */}
        <header className="quiz-header">
          <Link to={`/courses/${id}`} className="btn btn-ghost quiz-back-btn" aria-label="Exit quiz and return to course">
            ← Exit Quiz
          </Link>
          <div className="quiz-progress-info">
            <span className="quiz-counter" aria-label={`Question ${currentQ + 1} of ${questions.length}`}>
              Question {currentQ + 1} of {questions.length}
            </span>
            <span className="quiz-score-live" aria-label={`Current score: ${score} correct`}>
              Score: {score}
            </span>
          </div>
        </header>

        {/* Progress bar */}
        <div
          className="quiz-progress-bar progress-bar"
          role="progressbar"
          aria-valuenow={currentQ}
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-label={`Quiz progress: question ${currentQ + 1} of ${questions.length}`}
        >
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Main quiz card */}
        <div className="quiz-card" aria-live="polite">

          {/* Audio status */}
          <div className="quiz-audio-strip">
            {audioLoading ? (
              <div className="quiz-audio-loading">
                <div className="spinner" aria-hidden="true" />
                <span>Generating audio question…</span>
              </div>
            ) : (
              <>
                <div className="waveform quiz-wave" aria-hidden="true">
                  {[1,2,3,4,5,6,7].map(i => <div key={i} className="bar" />)}
                </div>
                <span className="quiz-audio-label">Listen carefully to the question</span>
                <button
                  className="btn btn-ghost quiz-replay-btn"
                  onClick={handleReplay}
                  aria-label="Replay question audio"
                >
                  <ReplayIcon />
                  Replay Question
                </button>
              </>
            )}
          </div>

          {/* Question */}
          <div className="quiz-question-block">
            <div className="quiz-q-num" aria-hidden="true">Q{currentQ + 1}</div>
            <h2 className="quiz-question" id="quiz-question">
              {q.question}
            </h2>
          </div>

          {/* Options */}
          <div
            className="quiz-options"
            role="group"
            aria-labelledby="quiz-question"
            aria-label="Answer options — press 1, 2, 3, or 4 to select"
          >
            {q.options.map((opt, i) => {
              const label = String.fromCharCode(65 + i);
              let state = '';
              if (answered) {
                if (i === q.answer) state = 'correct';
                else if (i === selected) state = 'incorrect';
                else state = 'dimmed';
              } else if (selected === i) {
                state = 'selected';
              }

              return (
                <button
                  key={i}
                  ref={el => optionRefs.current[i] = el}
                  className={`quiz-option ${state}`}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                  aria-label={`Option ${label}: ${opt}${answered ? (i === q.answer ? ' — Correct answer' : i === selected ? ' — Your incorrect answer' : '') : ''}`}
                  aria-pressed={selected === i}
                >
                  <span className="option-label" aria-hidden="true">{label}</span>
                  <span className="option-text">{opt}</span>
                  {answered && i === q.answer && (
                    <span className="option-icon correct-icon" aria-hidden="true">✓</span>
                  )}
                  {answered && i === selected && i !== q.answer && (
                    <span className="option-icon wrong-icon" aria-hidden="true">✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Keyboard hint */}
          {!answered && (
            <p className="quiz-keyboard-hint" aria-live="polite">
              Press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> to select, or tap an option above
            </p>
          )}

          {/* Explanation */}
          {answered && (
            <div
              className={`quiz-explanation ${selected === q.answer ? 'correct-bg' : 'incorrect-bg'}`}
              role="alert"
              aria-live="assertive"
            >
              <div className="explanation-status">
                {selected === q.answer ? '✓ Correct!' : '✗ Incorrect'}
              </div>
              <p className="explanation-text">{q.explanation}</p>
            </div>
          )}

          {/* Next button */}
          {answered && (
            <button
              className="btn btn-primary quiz-next-btn"
              onClick={handleNext}
              aria-label={currentQ < questions.length - 1 ? 'Next question' : 'See quiz results'}
              autoFocus
            >
              {currentQ < questions.length - 1 ? 'Next Question →' : 'See Results →'}
            </button>
          )}
        </div>
      </div>
    </div>
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

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-.49-3.54"/>
    </svg>
  );
}