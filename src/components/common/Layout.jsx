import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Clock, LayoutDashboard, LogOut, Sparkles } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import MemberSubmitModal from '../member/MemberSubmitModal';
import MemberCaseListModal from '../member/MemberCaseListModal';
import MemberCaseDetailModal from '../member/MemberCaseDetailModal';
import './Layout.css';

function MemberLayout({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const isCsSatisfaction = pathname.startsWith('/member/cs-satisfaction');

  return (
    <div className="member-shell">
      <header className="admin-topbar admin-topbar--member" role="banner">
        <div className="member-topbar-wrap">
          <div className="member-topbar-row">
            <div className="admin-topbar-left">
              <div className="member-topbar-catblock">
                <span className="member-topbar-catblock-label" id="member-cat-label">
                  카테고리
                </span>
                <nav className="member-topbar-cats" aria-labelledby="member-cat-label">
                  <Link
                    to="/member"
                    className={`member-topbar-cat ${!isCsSatisfaction ? 'is-active' : ''}`}
                    aria-current={!isCsSatisfaction ? 'page' : undefined}
                  >
                    <Sparkles className="member-topbar-cat-ico" size={17} strokeWidth={2.25} aria-hidden />
                    <span className="member-topbar-cat-text">YOU PRO</span>
                  </Link>
                  <Link
                    to="/member/cs-satisfaction"
                    className={`member-topbar-cat ${isCsSatisfaction ? 'is-active' : ''}`}
                    aria-current={isCsSatisfaction ? 'page' : undefined}
                  >
                    <BarChart3 className="member-topbar-cat-ico" size={17} strokeWidth={2.25} aria-hidden />
                    <span className="member-topbar-cat-text">CS 만족도</span>
                  </Link>
                </nav>
              </div>
            </div>
            <button type="button" className="admin-topbar-logout" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} aria-hidden />
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="member-main">{children}</main>
      <MemberSubmitModal />
      <MemberCaseListModal />
      <MemberCaseDetailModal />
    </div>
  );
}

const ADMIN_TABS = [
  { to: '/admin', label: '대시보드', Icon: LayoutDashboard, exact: true },
  { to: '/admin/pending', label: '검토 대기', Icon: Clock, exact: false },
];

function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar admin-topbar--admin" role="banner">
        <div className="admin-topbar-wrap">
          <div className="admin-topbar-row">
            <div className="admin-topbar-left">
              <div className="admin-topbar-catblock">
                <span className="admin-topbar-catblock-label">YOU PRO 관리자</span>
                <nav className="member-topbar-cats admin-topbar-cats" aria-label="관리자 메뉴">
                  {ADMIN_TABS.map(({ to, label, Icon, exact }) => {
                    const active = exact ? pathname === to : pathname.startsWith(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`member-topbar-cat ${active ? 'is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="member-topbar-cat-ico" size={16} strokeWidth={2.25} aria-hidden />
                        <span className="member-topbar-cat-text">{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
            <button type="button" className="admin-topbar-logout" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} aria-hidden />
              로그아웃
            </button>
          </div>
        </div>
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
