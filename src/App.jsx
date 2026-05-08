import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LangProvider } from './context/LangContext.jsx'
import JobBoardV1 from './pages/JobBoardV1.jsx'
import JobBoardV2 from './pages/JobBoardV2.jsx'
import JobBoardV3 from './pages/JobBoardV3.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminEditor from './pages/AdminEditor.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <Routes>
          <Route path="/"            element={<JobBoardV1 />} />
          <Route path="/jobs/v2"     element={<JobBoardV2 />} />
          <Route path="/jobs/v3"     element={<JobBoardV3 />} />
          <Route path="/admin"       element={<AdminDashboard />} />
          <Route path="/admin/edit/:id" element={<AdminEditor />} />
          {/* stub routes for nav links */}
          <Route path="/companies"   element={<Navigate to="/" replace />} />
          <Route path="/about"       element={<Navigate to="/" replace />} />
          <Route path="/contact"     element={<Navigate to="/" replace />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </LangProvider>
    </BrowserRouter>
  )
}
