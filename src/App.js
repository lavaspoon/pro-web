import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/member/HomePage';
import CaseListPage from './pages/member/CaseListPage';
import SubmitCasePage from './pages/member/SubmitCasePage';
import CaseDetailPage from './pages/member/CaseDetailPage';
import CsSatisfactionPage from './pages/member/CsSatisfactionPage';
import DashboardPage from './pages/admin/DashboardPage';
import TeamDetailPage from './pages/admin/TeamDetailPage';
import PendingCasesPage from './pages/admin/PendingCasesPage';
import AdminSatisfactionPage from './pages/admin/AdminSatisfactionPage';
import AdminSatisfactionSetupPage from './pages/admin/AdminSatisfactionSetupPage';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />;
  }
  return children;
}

function MemberLayout() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cases" element={<CaseListPage />} />
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/submit" element={<SubmitCasePage />} />
        <Route path="/cs-satisfaction" element={<CsSatisfactionPage />} />
      </Routes>
    </Layout>
  );
}

function AdminLayout() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/team/:teamId" element={<TeamDetailPage />} />
        <Route path="/pending" element={<PendingCasesPage />} />
        <Route path="/satisfaction" element={<AdminSatisfactionPage />} />
        <Route path="/satisfaction/setup" element={<AdminSatisfactionSetupPage />} />
        <Route path="/satisfaction/upload" element={<Navigate to="/admin/satisfaction/setup" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/member/*"
            element={
              <ProtectedRoute requiredRole="member">
                <MemberLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
