import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import MemberSubmitModal from '../member/MemberSubmitModal';
import MemberCaseListModal from '../member/MemberCaseListModal';
import MemberCaseDetailModal from '../member/MemberCaseDetailModal';
import './Layout.css';

function MemberLayout({ children }) {
  return (
    <div className="member-shell">
      <main className="member-main">{children}</main>
      <MemberSubmitModal />
      <MemberCaseListModal />
      <MemberCaseDetailModal />
    </div>
  );
}

function AdminLayout({ children }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar" role="banner">
        <span className="admin-topbar-brand">YOU PRO 관리자</span>
        <button
          type="button"
          className="admin-topbar-logout"
          onClick={handleLogout}
        >
          <LogOut size={16} strokeWidth={2} aria-hidden />
          로그아웃
        </button>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

export default function Layout({ children }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? (
    <AdminLayout>{children}</AdminLayout>
  ) : (
    <MemberLayout>{children}</MemberLayout>
  );
}
