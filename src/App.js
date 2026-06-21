import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import useViewAsStore from './store/viewAsStore';
import { canAccessPendingCases } from './utils/youProRole';
import Layout from './components/common/Layout';
import AuthPage from './pages/AuthPage';
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
  const { viewAsSkid } = useViewAsStore();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  // 관리자·CE실장이 대리 보기 모드일 때 /member/* 접근 허용
  if (requiredRole === 'member' && user?.role === 'admin' && viewAsSkid) {
    return children;
  }
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />;
  }
  return children;
}

function PendingCasesRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== 'admin') {
    return <Navigate to="/member" replace />;
  }
  if (!canAccessPendingCases(user)) {
    return <Navigate to="/admin" replace />;
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
        <Route
          path="/pending"
          element={
            <PendingCasesRoute>
              <PendingCasesPage />
            </PendingCasesRoute>
          }
        />
        <Route path="/satisfaction" element={<AdminSatisfactionPage />} />
        <Route path="/satisfaction/setup" element={<AdminSatisfactionSetupPage />} />
        <Route path="/satisfaction/upload" element={<Navigate to="/admin/satisfaction?setup=1" replace />} />
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
          {/* /auth/login 은 백엔드 API(GET /auth/login)와 경로 충돌 — 배포 환경에서 SPA 대신 API가 응답함 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />
              ) : (
                <Navigate to="/auth" replace />
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
          <Route path="*" element={<Navigate to={isAuthenticated ? (user?.role === 'admin' ? '/admin' : '/member') : '/auth'} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
