import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

export const getCourses    = ()               => api.get('/courses');
export const getCourse     = (id)             => api.get(`/courses/${id}`);
export const getQuiz       = (courseId)       => api.get(`/quiz/${courseId}`);
export const getTTS        = (text, slow)     => api.post('/tts', { text, slow });
export const getLessonAudio= (courseId, topic)=> api.post('/lesson-audio', { courseId, topic });
export const getQuizAudio  = (question, opts) => api.post('/quiz-audio', { question, options: opts });

export const sendChat = (message, context = {}, history = []) =>
  api.post('/chat', { message, context, history });

export default api;