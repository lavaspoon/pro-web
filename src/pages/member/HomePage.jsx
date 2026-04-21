import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import { Sparkles, ChevronRight, FileText } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import Skeleton from '../../components/common/Skeleton';
import '../admin/DashboardPage.css';
import './HomePage.css';

const now = new Date();
const currentMonth = now.toLocaleDateString('ko-KR', { month: 'long' });
const currentYear = now.getFullYear();
const currentMonthNum = now.getMonth() + 1;

const PROGRAM_END_MONTH = 9;

const TIERS = [
  { id: 'mangju', name: 'YOU 망주',     range: '1~9건',  minCases: 1,  rateWon: 30000 },
  { id: 'player', name: 'YOU 플레이어', range: '10~18건', minCases: 10, rateWon: 50000 },
  { id: 'topia',  name: 'YOU 토피아',   range: '19건~',  minCases: 19, rateWon: 70000 },
];

function getTierIdx(n) {
  if (n >= 19) return 2;
  if (n >= 10) return 1;
  if (n >= 1)  return 0;
  return -1;
}

function HomeSkeleton({ userName }) {
  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">
      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 YOU PRO</h1>
          <p className="hp-header-sub">{userName ?? '구성원'}님</p>
        </div>
        <div className="hp-header-actions">
          <Skeleton width={96} height={34} radius={10} />
          <Skeleton width={96} height={34} radius={10} />
        </div>
      </header>

      <section className="hp-hero">
        <div className="hp-hero-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Skeleton variant="text" width={120} height={12} />
          <Skeleton width={200} height={40} radius={10} />
          <Skeleton variant="text" width={160} height={12} />
        </div>
        <div className="hp-breakdown">
          {[0, 1].map((i) => (
            <div key={i} className="hp-breakdown-row">
              <Skeleton variant="text" width={70} height={12} />
              <Skeleton variant="text" width={60} height={12} />
            </div>
          ))}
          <div className="hp-breakdown-divider" />
          <div className="hp-breakdown-row hp-breakdown-row--total">
            <Skeleton variant="text" width={90} height={13} />
            <Skeleton variant="text" width={90} height={14} />
          </div>
        </div>
        <Skeleton height={48} radius={12} />
      </section>

      <section className="hp-card hp-tier-card">
        <div className="hp-tier-now">
          <div className="hp-tier-now-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Skeleton width={74} height={22} radius={999} />
            <Skeleton variant="text" width={80} height={13} />
          </div>
          <Skeleton variant="text" width={110} height={12} />
        </div>
        <div className="hp-tier-body">
          <div className="hp-prog">
            <Skeleton height={10} radius={999} />
            <div style={{ marginTop: 10 }}>
              <Skeleton variant="text" width={'100%'} height={10} />
            </div>
            <div style={{ marginTop: 14 }}>
              <Skeleton variant="text" width={140} height={12} />
            </div>
          </div>
          <div className="hp-tier-table">
            {[0, 1, 2].map((i) => (
              <div key={i} className="hp-tier-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton variant="circle" width={8} height={8} />
                <Skeleton variant="text" width={48} height={12} />
                <Skeleton variant="text" width={56} height={12} />
                <Skeleton variant="text" width={40} height={12} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmit = useMemberModalStore((s) => s.openSubmit);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['member-home', user?.skid],
    queryFn: () => fetchMemberHome(user.skid),
    enabled: !!user?.skid,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['my-cases', user?.skid],
    queryFn: () => fetchMyCases(user.skid),
    enabled: !!user?.skid,
  });

  const monthStats = useMemo(() => {
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let selected = 0, pending = 0, rejected = 0;
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      if (c.status === 'selected') selected++;
      else if (c.status === 'pending') pending++;
      else if (c.status === 'rejected') rejected++;
    });
    return { selected, pending, rejected };
  }, [cases]);

  if (isLoading || !data) return <HomeSkeleton userName={user?.name} />;
  if (isError) return <div className="hp-error">오류: {error?.message}</div>;

  const {
    myTotalSelected = 0,
    monthlySelected = 0,
    monthlyLimit = 3,
    myIndividualRank,
    individualRankTotal = 0,
    topSelected = 0,
  } = data;

  const tierIdx     = getTierIdx(myTotalSelected);
  const currentTier = tierIdx >= 0 ? TIERS[tierIdx] : null;
  const nextTier    = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;

  const estimatedWon = currentTier ? myTotalSelected * currentTier.rateWon : 0;
  const casesToNext  = nextTier ? nextTier.minCases - myTotalSelected : 0;
  const boostWon     = nextTier ? (nextTier.minCases * nextTier.rateWon) - estimatedWon : 0;

  // 프로그레스 스케일 (0 ~ 25건 기준 — 토피아 이상 커버)
  const SCALE_MAX = 25;
  const clampPct = (n) => Math.max(0, Math.min(100, (n / SCALE_MAX) * 100));
  const myPct    = clampPct(myTotalSelected);
  const topPct   = clampPct(topSelected);

  const tierStops = TIERS.map((t) => ({ ...t, pct: clampPct(t.minCases) }));

  const isInProgram = currentMonthNum >= 1 && currentMonthNum <= PROGRAM_END_MONTH;
  const remainLeft  = isInProgram ? Math.max(0, monthlyLimit - monthlySelected) : 0;

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">

      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 YOU PRO</h1>
          <p className="hp-header-sub">{user?.name ?? '구성원'}님</p>
        </div>
        <div className="hp-header-actions">
          <Link to="/member/cases" className="hp-btn hp-btn--ghost">
            <FileText size={15} strokeWidth={2.25} />
            접수 내역
          </Link>
          <button type="button" className="hp-btn hp-btn--primary" onClick={openSubmit}>
            <Sparkles size={15} strokeWidth={2.25} />
            사례 접수
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════
          ① 금액 중심 히어로 — 토스 스타일
         ═══════════════════════════════════════════════════════ */}
      <section className="hp-hero">
        {/* 상단 중앙: 금액 */}
        <div className="hp-hero-top">
          <p className="hp-hero-label">올해 예상 인센티브</p>
          <div className="hp-hero-amount">
            {estimatedWon > 0 ? (
              <>
                <span className="hp-hero-num">{estimatedWon.toLocaleString('ko-KR')}</span>
                <span className="hp-hero-won">원</span>
              </>
            ) : (
              <span className="hp-hero-num hp-hero-num--zero">0원</span>
            )}
          </div>
          {currentTier ? (
            <p className="hp-hero-sub">
              <span className="hp-hero-tier">{currentTier.name}</span>
              <span className="hp-hero-dot" />
              건당 {currentTier.rateWon.toLocaleString('ko-KR')}원
            </p>
          ) : (
            <p className="hp-hero-sub">선정 1건부터 인센티브가 시작됩니다</p>
          )}
        </div>

        {/* 금액 형성 내역 — 영수증 느낌 */}
        <div className="hp-breakdown">
          <div className="hp-breakdown-row">
            <span className="hp-breakdown-label">선정 건수</span>
            <span className="hp-breakdown-value">
              <strong>{myTotalSelected}</strong>건
            </span>
          </div>
          <div className="hp-breakdown-row">
            <span className="hp-breakdown-label">건당 단가</span>
            <span className="hp-breakdown-value">
              {currentTier ? (
                <><strong>{currentTier.rateWon.toLocaleString('ko-KR')}</strong>원</>
              ) : (
                <span className="hp-breakdown-muted">등급 미달</span>
              )}
            </span>
          </div>
          <div className="hp-breakdown-divider" />
          <div className="hp-breakdown-row hp-breakdown-row--total">
            <span className="hp-breakdown-label">예상 지급액</span>
            <span className="hp-breakdown-value">
              <strong>{estimatedWon.toLocaleString('ko-KR')}</strong>원
            </span>
          </div>

          {nextTier && isInProgram && (
            <div className="hp-breakdown-hint">
              <span className="hp-breakdown-hint-dot" />
              <strong>{casesToNext}건</strong> 더 선정되면 <strong>{nextTier.name}</strong> 등급으로
              <span className="hp-breakdown-boost"> +{boostWon.toLocaleString('ko-KR')}원</span>
            </div>
          )}
        </div>

        {/* 이번 달 접수 현황 — 통합 칩 */}
        <Link to="/member/cases" className="hp-month-strip">
          <span className="hp-month-strip-title">{currentMonth} 접수</span>
          <span className="hp-month-chips">
            <span className="hp-month-chip hp-month-chip--selected">
              선정 <strong>{monthStats.selected}</strong>
            </span>
            <span className="hp-month-chip hp-month-chip--pending">
              심사 <strong>{monthStats.pending}</strong>
            </span>
            <span className="hp-month-chip hp-month-chip--rejected">
              비선정 <strong>{monthStats.rejected}</strong>
            </span>
          </span>
          <ChevronRight size={15} strokeWidth={2.5} className="hp-month-strip-arrow" />
        </Link>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ② 나의 등급 — 심플 버전
         ═══════════════════════════════════════════════════════ */}
      <section className="hp-card hp-tier-card">
        {/* 현재 내 상태 요약 한 줄 */}
        <div className="hp-tier-now">
          <div className="hp-tier-now-main">
            <span className="hp-tier-now-badge">{currentTier?.name ?? '등급 전'}</span>
            <span className="hp-tier-now-cases">
              <strong>{myTotalSelected}</strong>건 선정
            </span>
          </div>
          {myIndividualRank != null && individualRankTotal > 0 && (
            <span className="hp-tier-now-rank">
              {individualRankTotal}명 중 <strong>{myIndividualRank}위</strong>
            </span>
          )}
        </div>

        {/* 좌: 프로그레스 바 + 마커  |  우: 컴팩트 등급표 */}
        <div className="hp-tier-body">
          {/* 좌측 — 프로그레스 */}
          <div className="hp-prog">
            <div className="hp-prog-track">
              <div className="hp-prog-seg hp-prog-seg--1" style={{ left: `${tierStops[0].pct}%`, width: `${tierStops[1].pct - tierStops[0].pct}%` }} />
              <div className="hp-prog-seg hp-prog-seg--2" style={{ left: `${tierStops[1].pct}%`, width: `${tierStops[2].pct - tierStops[1].pct}%` }} />
              <div className="hp-prog-seg hp-prog-seg--3" style={{ left: `${tierStops[2].pct}%`, width: `${100 - tierStops[2].pct}%` }} />

              {topSelected > 0 && (
                <div className="hp-prog-marker hp-prog-marker--top" style={{ left: `${topPct}%` }}>
                  <div className="hp-prog-pin hp-prog-pin--top">1위 {topSelected}</div>
                  <div className="hp-prog-stem hp-prog-stem--top" />
                  <div className="hp-prog-dot hp-prog-dot--top" />
                </div>
              )}

              <div className="hp-prog-marker hp-prog-marker--me" style={{ left: `${myPct}%` }}>
                <div className="hp-prog-dot hp-prog-dot--me" />
                <div className="hp-prog-stem hp-prog-stem--me" />
                <div className="hp-prog-pin hp-prog-pin--me">나 {myTotalSelected}</div>
              </div>
            </div>

            {/* 하단 숫자 눈금 */}
            <div className="hp-prog-scale">
              <span>0</span>
              <span>10</span>
              <span>19</span>
              <span>{SCALE_MAX}건</span>
            </div>

            {/* 다음 등급까지 */}
            {nextTier ? (
              <div className="hp-tier-next">
                <strong>{nextTier.name}</strong>까지 <strong>{casesToNext}건</strong>
              </div>
            ) : currentTier ? (
              <div className="hp-tier-next hp-tier-next--max">최고 등급 달성 중</div>
            ) : null}
          </div>

          {/* 우측 — 컴팩트 등급표 */}
          <div className="hp-tier-table">
            {TIERS.map((tier, i) => {
              const isActive = i === tierIdx;
              return (
                <div key={tier.id}
                  className={`hp-tier-row hp-tier-row--${tier.id}${isActive ? ' is-active' : ''}`}>
                  <span className="hp-tier-row-dot" />
                  <span className="hp-tier-row-name">{tier.name.replace('YOU ', '')}</span>
                  <span className="hp-tier-row-range">{tier.range}</span>
                  <span className="hp-tier-row-rate">{tier.rateWon / 10000}만</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
