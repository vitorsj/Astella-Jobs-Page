import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LangProvider } from './context/LangContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import JobBoardV2 from './pages/JobBoardV2.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminEditor from './pages/AdminEditor.jsx'
import AdminManualJobEditor from './pages/AdminManualJobEditor.jsx'
import AdminCompanyEditor from './pages/AdminCompanyEditor.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <ErrorBoundary>
        <Routes>
          <Route path="/"            element={<JobBoardV2 />} />
          <Route path="/admin"       element={<RequireAuth><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/edit/new" element={<RequireAuth><AdminManualJobEditor /></RequireAuth>} />
          <Route path="/admin/edit/:id" element={<RequireAuth><AdminEditor /></RequireAuth>} />
          <Route path="/admin/company/:slug" element={<RequireAuth><AdminCompanyEditor /></RequireAuth>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </LangProvider>
    </BrowserRouter>
  )
}
