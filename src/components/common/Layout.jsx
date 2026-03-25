import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import MemberSubmitModal from '../member/MemberSubmitModal';
import MemberCaseListModal from '../member/MemberCaseListModal';
import MemberCaseDetailModal from '../member/MemberCaseDetailModal';
import './Layout.css';

const memberPageTitles = {
  '/member': null,
};

/* ── 구성원 레이아웃 (사이드바 없음 — 상단 바만) ─────────────── */
function MemberLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/member';
  const isCaseDetail = /^\/member\/cases\/[^/]+$/.test(location.pathname);
  const pageTitle = isCaseDetail
    ? '사례 상세'
    : Object.entries(memberPageTitles).find(([k]) => {
        if (k === '/member' && location.pathname.startsWith('/member/cases/')) {
          return false;
        }
        return k === location.pathname || location.pathname.startsWith(`${k}/`);
      })?.[1];

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="member-shell">
      <header className="member-topbar">
        <div className="topbar-left">
          {!isHome && (
            <button className="topbar-back" onClick={() => navigate(-1)}>
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="topbar-title">
            {isHome ? 'YouPro' : pageTitle ?? 'YouPro'}
          </span>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{user?.name}</span>
          <button className="topbar-logout" onClick={handleLogout}>
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <main className="member-main">{children}</main>
      <MemberSubmitModal />
      <MemberCaseListModal />
      <MemberCaseDetailModal />
    </div>
  );
}

/* ── 관리자 레이아웃 (사이드바 없음 — 상단 바 + 풀폭 콘텐츠) ─ */
function AdminLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/'); };

  const isPending = location.pathname.includes('/pending');
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/';

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button type="button" className="admin-brand" onClick={() => navigate('/admin')}>
            YouPro
          </button>
          <span className="admin-topbar-kicker">관리자</span>
        </div>
        <div className="admin-topbar-right">
          <button
            type="button"
            className={`admin-topbar-nav ${isDashboard ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            대시보드
          </button>
          <button
            type="button"
            className={`admin-topbar-nav ${isPending ? 'active' : ''}`}
            onClick={() => navigate('/admin/pending')}
          >
            검토 대기
          </button>
          <span className="admin-topbar-user">{user?.name}</span>
          <button type="button" className="admin-topbar-logout" onClick={handleLogout} aria-label="로그아웃">
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

export default function Layout({ children }) {
  const { user } = useAuthStore();
  return user?.role === 'admin'
    ? <AdminLayout>{children}</AdminLayout>
    : <MemberLayout>{children}</MemberLayout>;
}
