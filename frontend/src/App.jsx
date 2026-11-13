
import { Navigate, Route, Routes } from 'react-router'
import DashboardLayout from './layouts/DashboardLayout'
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import StudentDashboard from './pages/student/StudentDashboard'

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student" replace />} />

      <Route element={<DashboardLayout />}>
        <Route path="/faculty" element={<FacultyDashboard />} />
        <Route path="/faculty/courses" element={<ComingSoon />} />
        <Route path="/faculty/students" element={<ComingSoon />} />
        <Route path="/faculty/assessments" element={<ComingSoon />} />
        <Route path="/faculty/results" element={<ComingSoon />} />

        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/courses" element={<ComingSoon />} />
        <Route path="/student/vivas" element={<ComingSoon />} />
        <Route path="/student/quizzes" element={<ComingSoon />} />
        <Route path="/student/progress" element={<ComingSoon />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
