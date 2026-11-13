
import { Navigate, Route, Routes } from 'react-router'
import DashboardLayout from './layouts/DashboardLayout'
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import FacultyCourses from './pages/faculty/FacultyCourses'
import FacultyStudents from './pages/faculty/FacultyStudents'
import FacultyResults from './pages/faculty/FacultyResults'
import QuestionGenerator from './pages/faculty/QuestionGenerator'
import VivaScheduling from './pages/faculty/VivaScheduling'
import StudentVivas from './pages/student/StudentVivas'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentCourses from './pages/student/StudentCourses'
import StudentResults from './pages/student/StudentResults'
import VoiceViva from './pages/student/VoiceViva'
import AuthPage from './pages/AuthPage'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'

function ComingSoon() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <h1 className="text-2xl font-bold">Coming Soon</h1>
      <p className="mt-3 text-muted">
        We're building this feature next.
      </p>
    </div>
  )
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="p-8 text-muted">Loading...</div>
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  return (
    <Navigate
      to={profile.role === 'faculty' ? '/faculty' : '/student'}
      replace
    />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage />} />

      <Route element={<ProtectedRoute role="faculty" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/faculty/courses" element={<FacultyCourses />} />
          <Route path="/faculty/students" element={<FacultyStudents />} />
          <Route path="/faculty/assessments" element={<QuestionGenerator />} />
          <Route path="/faculty/schedule" element={<VivaScheduling />} />
          <Route path="/faculty/results" element={<FacultyResults />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="student" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/courses" element={<StudentCourses />} />
          <Route path="/student/vivas" element={<StudentVivas />} />
          <Route path="/student/vivas/:assignmentId" element={<VoiceViva />} />
          <Route path="/student/results" element={<StudentResults />} />
          <Route path="/student/quizzes" element={<ComingSoon />} />
          <Route path="/student/progress" element={<ComingSoon />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
