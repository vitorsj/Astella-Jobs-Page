import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LangProvider } from './context/LangContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import JobBoardV2 from './pages/JobBoardV2.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminEditor from './pages/AdminEditor.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <Routes>
          <Route path="/"            element={<JobBoardV2 />} />
          <Route path="/admin"       element={<RequireAuth><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/edit/:id" element={<RequireAuth><AdminEditor /></RequireAuth>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </LangProvider>
    </BrowserRouter>
  )
}
