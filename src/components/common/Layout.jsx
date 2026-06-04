import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import { fetchMemberCsInsightPromptMents } from '../../api/memberApi';
import MemberSubmitModal from '../member/MemberSubmitModal';
import MemberCaseListModal from '../member/MemberCaseListModal';
import MemberCaseDetailModal from '../member/MemberCaseDetailModal';
import MemberCsMentDetailModal from '../member/MemberCsMentDetailModal';
import './Layout.css';

function normalizeMentList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
}

function pickRandomIndex(length, prev = -1) {
  if (!length || length <= 0) return 0;
  if (length === 1) return 0;
  let next = prev;
  while (next === prev) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

function MemberTopbarMentBubble({ skid, onMentClick }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data } = useQuery({
    queryKey: ['member-topbar-random-ment', skid, year, month],
    queryFn: () => fetchMemberCsInsightPromptMents({ skid, year, month }),
    enabled: !!skid,
    staleTime: 60_000,
  });

  const { mentPool, mentSource } = useMemo(() => {
    const recentGoodTop5 = normalizeMentList(data?.goodMents).slice(0, 5);
    if (recentGoodTop5.length > 0) {
      return { mentPool: recentGoodTop5, mentSource: 'good' };
    }
    // Good 멘트가 비어 있을 때만 고객 제안에서 최근 5개를 보조로 사용
    return {
      mentPool: normalizeMentList(data?.badMents).slice(0, 5),
      mentSource: 'bad',
    };
  }, [data]);
  const [mentIdx, setMentIdx] = useState(0);

  useEffect(() => {
    if (mentPool.length === 0) {
      setMentIdx(0);
      return undefined;
    }
    setMentIdx((prev) => pickRandomIndex(mentPool.length, prev));
    const timer = setInterval(() => {
      setMentIdx((prev) => pickRandomIndex(mentPool.length, prev));
    }, 10_000);
    return () => clearInterval(timer);
  }, [mentPool]);

  const mentText = mentPool[mentIdx] ?? '';

  if (!mentText) {
    return (
      <div className="member-topbar-ment member-topbar-ment--empty" aria-hidden>
        <span className="member-topbar-ment-quote">“”</span>
      </div>
    );
  }

  const handleOpenDetail = () => {
    onMentClick?.({
      mentText,
      mentSource,
      windowStart: data?.mentWindowStartDate ?? null,
      windowEnd: data?.latestConsultDate ?? null,
      year,
      month,
    });
  };

  return (
    <button
      type="button"
      className="member-topbar-ment member-topbar-ment--clickable"
      onClick={handleOpenDetail}
      aria-label={`실시간 고객 만족: ${mentText}. 클릭하면 상담 상세를 확인할 수 있습니다.`}
    >
      <span className="member-topbar-ment-kicker">실시간 고객 만족</span>
      <span className="member-topbar-ment-text">
        <span className="member-topbar-ment-q" aria-hidden>“</span>
        {mentText}
        <span className="member-topbar-ment-q" aria-hidden>”</span>
      </span>
    </button>
  );
}

function MemberLayout({ children }) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const [mentModal, setMentModal] = useState(null);

  const isCsSatisfaction = pathname.startsWith('/member/cs-satisfaction');

  return (
    <div className="member-shell">
      <header className="admin-topbar admin-topbar--member" role="banner">
        <div className="member-topbar-wrap">
          <div className="member-topbar-row">
            <div className="admin-topbar-left">
              <div className="member-topbar-catblock">
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
            <div className="member-topbar-center">
              <MemberTopbarMentBubble skid={user?.skid} onMentClick={setMentModal} />
            </div>
          </div>
        </div>
      </header>
      <main className="member-main">{children}</main>
      <MemberSubmitModal />
      <MemberCaseListModal />
      <MemberCaseDetailModal />
      <MemberCsMentDetailModal
        open={!!mentModal}
        onClose={() => setMentModal(null)}
        mentText={mentModal?.mentText ?? ''}
        mentSource={mentModal?.mentSource ?? 'good'}
        windowStart={mentModal?.windowStart ?? null}
        windowEnd={mentModal?.windowEnd ?? null}
        year={mentModal?.year}
        month={mentModal?.month}
      />
    </div>
  );
}

/** 대시보드 · 검토 대기 · 팀 상세는 YOU PRO 탭으로 묶음 (만족도 경로 제외) */
function isAdminYouProActive(pathname) {
  if (pathname.startsWith('/admin/satisfaction')) return false;
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/pending') ||
    pathname.startsWith('/admin/team/')
  );
}

const ADMIN_TABS = [
  { to: '/admin', label: 'YOU PRO', Icon: Sparkles, isActive: isAdminYouProActive },
  { to: '/admin/satisfaction', label: '만족도 관리', Icon: BarChart3, exact: false },
];

function AdminLayout({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="admin-shell">
      <header className="admin-topbar admin-topbar--admin" role="banner">
        <div className="admin-topbar-wrap">
          <div className="member-topbar-row">
            <div className="admin-topbar-left">
              <div className="admin-topbar-catblock">
                <span className="admin-topbar-catblock-label">YOU PRO 관리자</span>
                <nav className="member-topbar-cats admin-topbar-cats" aria-label="관리자 메뉴">
                  {ADMIN_TABS.map(({ to, label, Icon, exact, isActive }) => {
                    const active = isActive
                      ? isActive(pathname)
                      : exact
                        ? pathname === to
                        : pathname.startsWith(to);
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
