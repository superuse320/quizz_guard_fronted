import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import LandingPage from './pages/LandingPage.jsx'
import Home from './pages/Home.jsx'
import SessionGate from './components/SessionGate.jsx'
import { store } from './redux/store'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedPage from './pages/ProtectedPage'
import FormBuilderPage from './FormBuilderPage.jsx'
import FormPublicView from './components/FormPublicView.jsx'
import FormAnswersPage from './pages/FormAnswersPage.jsx'
import FormAnswerDetailPage from './pages/FormAnswerDetailPage.jsx'
import JoinQuizPage from './pages/JoinQuizPage.jsx'
import QuizWaitingRoomPage from './pages/QuizWaitingRoomPage.jsx'
import QuizPlayPage from './pages/QuizPlayPage.jsx'
import QuizControlPage from './pages/QuizControlPage.jsx'
import StrictControlPage from './pages/StrictControlPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas solo para no logueados */}
          <Route element={<SessionGate requireAuth={false} redirectTo="/main" />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<LandingPage />} />
          </Route>
          {/* Rutas privadas solo para logueados */}
          <Route element={<SessionGate requireAuth={true} redirectTo="/home" />}>
            <Route path="/main" element={<Home />} />
          </Route>
          <Route path="/formulario/:public_id" element={<FormPublicView />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedPage />} />
            <Route path="/form" element={<FormBuilderPage />} />
            <Route path="/form/:public_id/edit" element={<FormBuilderPage editMode={true} />} />
            <Route path="/form/:public_id/respuestas" element={<FormAnswersPage />} />
            <Route path="/form/:public_id/respuestas/:submission_id" element={<FormAnswerDetailPage />} />
            <Route path="/form/:public_id/quiz-control" element={<QuizControlPage />} />
            <Route path="/form/:public_id/strict-control" element={<StrictControlPage />} />
          </Route>
          {/* Rutas públicas para quiz */}
          <Route path="/join-quiz" element={<JoinQuizPage />} />
          <Route path="/quiz/waiting-room" element={<QuizWaitingRoomPage />} />
          <Route path="/quiz/play" element={<QuizPlayPage />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
