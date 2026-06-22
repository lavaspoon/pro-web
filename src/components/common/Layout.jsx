import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Sparkles, Eye, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import useViewAsStore from '../../store/viewAsStore';
import { isYouProAdmin, isYouProCeDirector } from '../../utils/youProRole';
import { fetchMemberCsInsightPromptMents, fetchMemberEligibility } from '../../api/memberApi';
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { viewAsSkid, clearViewAs } = useViewAsStore();
  const [mentModal, setMentModal] = useState(null);

  const isCsSatisfaction = pathname.startsWith('/member/cs-satisfaction');
  const effectiveSkid = viewAsSkid || user?.skid;

  const handleReturnToAdmin = () => {
    clearViewAs();
    navigate('/admin');
  };

  return (
    <div className="member-shell">
      {viewAsSkid && (
        <div className="view-as-banner" role="status" aria-live="polite">
          <Eye className="view-as-banner__icon" size={15} strokeWidth={2.25} aria-hidden />
          <span className="view-as-banner__text">
            <strong>{viewAsSkid}</strong> 구성원 화면 대리 보기 중
          </span>
          <button
            type="button"
            className="view-as-banner__return-btn"
            onClick={handleReturnToAdmin}
          >
            <ArrowLeft size={14} strokeWidth={2.25} aria-hidden />
            내 화면으로 돌아가기
          </button>
        </div>
      )}
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
              <MemberTopbarMentBubble skid={effectiveSkid} onMentClick={setMentModal} />
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
  {
    adminTo: '/admin',
    memberTo: '/member',
    label: 'YOU PRO',
    Icon: Sparkles,
    isAdminActive: isAdminYouProActive,
    isMemberActive: (p) => p === '/member' || (p.startsWith('/member/') && !p.startsWith('/member/cs-satisfaction')),
  },
  {
    adminTo: '/admin/satisfaction',
    memberTo: '/member/cs-satisfaction',
    label: '만족도 관리',
    Icon: BarChart3,
    isAdminActive: (p) => p.startsWith('/admin/satisfaction'),
    isMemberActive: (p) => p.startsWith('/member/cs-satisfaction'),
  },
];

function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { viewAsSkid, setViewAs, clearViewAs } = useViewAsStore();
  const [skidInput, setSkidInput] = useState('');
  const skidInputRef = useRef(null);

  const canViewAs = isYouProAdmin(user) || isYouProCeDirector(user);
  const isViewAsMode = !!viewAsSkid;
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  /** 평가대상자 확인 후 구성원 페이지로 이동 */
  const navigateAsViewAs = async (skid, memberTo) => {
    if (isCheckingEligibility) return;
    setIsCheckingEligibility(true);
    try {
      const result = await fetchMemberEligibility(skid);
      if (!result.found) {
        alert('해당 사번의 구성원을 찾을 수 없습니다.');
        return;
      }
      if (!result.eligible) {
        alert('해당 구성원은 평가대상자가 아닙니다.');
        return;
      }
      setViewAs(skid);
      setSkidInput('');
      navigate(memberTo);
    } catch {
      alert('구성원 정보를 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleTabClick = (adminTo, memberTo) => {
    const trimmed = skidInput.trim();
    if (trimmed && !isViewAsMode) {
      navigateAsViewAs(trimmed, memberTo);
    } else if (isViewAsMode) {
      navigate(memberTo);
    } else {
      navigate(adminTo);
    }
  };

  const handleReturnToAdmin = () => {
    clearViewAs();
    setSkidInput('');
    navigate('/admin');
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar admin-topbar--admin" role="banner">
        <div className="admin-topbar-wrap">
          <div className="member-topbar-row">
            <div className="admin-topbar-left">
              <div className="admin-topbar-catblock">
                <nav className="member-topbar-cats admin-topbar-cats" aria-label="관리자 메뉴">
                  {ADMIN_TABS.map(({ adminTo, memberTo, label, Icon, isAdminActive, isMemberActive }) => {
                    const active = isViewAsMode
                      ? isMemberActive(pathname)
                      : isAdminActive(pathname);
                    return (
                      <button
                        key={adminTo}
                        type="button"
                        className={`member-topbar-cat ${active ? 'is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        disabled={isCheckingEligibility && !isViewAsMode}
                        onClick={() => handleTabClick(adminTo, memberTo)}
                      >
                        <Icon className="member-topbar-cat-ico" size={16} strokeWidth={2.25} aria-hidden />
                        <span className="member-topbar-cat-text">{label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
            {canViewAs && (
              <div
                className="admin-view-as-form"
                aria-label="구성원 화면 대리 보기"
                style={{ marginLeft: 'auto' }}
              >
                <label
                  className="admin-view-as-label"
                  htmlFor={isViewAsMode ? undefined : 'admin-view-as-skid'}
                >
                  <Eye size={14} strokeWidth={2.25} aria-hidden />
                  구성원 보기
                </label>
                {isViewAsMode ? (
                  <button
                    type="button"
                    className="admin-view-as-btn admin-view-as-btn--return"
                    onClick={handleReturnToAdmin}
                    aria-label="내 페이지로 돌아가기"
                  >
                    <ArrowLeft size={13} strokeWidth={2.25} aria-hidden />
                    내 페이지로 돌아가기
                  </button>
                ) : (
                  <input
                    id="admin-view-as-skid"
                    ref={skidInputRef}
                    type="text"
                    className="admin-view-as-input"
                    placeholder={isCheckingEligibility ? '확인 중…' : '사번 입력 후 탭 클릭'}
                    value={skidInput}
                    onChange={(e) => setSkidInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = skidInput.trim();
                        if (trimmed) navigateAsViewAs(trimmed, '/member');
                      }
                    }}
                    disabled={isCheckingEligibility}
                    autoComplete="off"
                    maxLength={20}
                    aria-label="구성원 사번"
                  />
                )}
              </div>
            )}
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
