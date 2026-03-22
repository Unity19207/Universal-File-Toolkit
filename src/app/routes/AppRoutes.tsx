import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from '../../components/dashboard/DashboardPage'
import { WorkspacePage } from '../../components/workspace/WorkspacePage'
import { CategoryPage } from '../../components/category/CategoryPage'
import { AppLayout } from '../../components/layout/AppLayout'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/tools/:toolId" element={<WorkspacePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
