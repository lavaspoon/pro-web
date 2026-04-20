import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import { Sparkles, ChevronRight, Flame, Zap, Crown, ArrowRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import '../admin/DashboardPage.css';
import './HomePage.css';

const now = new Date();
const currentMonth = now.toLocaleDateString('ko-KR', { month: 'long' });
const currentYear = now.getFullYear();
const currentMonthNum = now.getMonth() + 1;

const PROGRAM_END_MONTH = 9;

const TIERS = [
  { id: 'mangju', name: 'YOU 망주', range: '1~9건', minCases: 1, maxCases: 9, rateWon: 30000, Icon: Flame },
  { id: 'player', name: 'YOU 플레이어', range: '10~18건', minCases: 10, maxCases: 18, rateWon: 50000, Icon: Zap },
  { id: 'topia', name: 'YOU 토피아', range: '19건~', minCases: 19, maxCases: Infinity, rateWon: 70000, Icon: Crown },
];

function getTierIdx(n) {
  if (n >= 19) return 2;
  if (n >= 10) return 1;
  if (n >= 1) return 0;
  return -1;
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
    return { selected, pending, rejected, total: selected + pending + rejected };
  }, [cases]);

  if (isLoading || !data) return (
    <div className="loading-screen"><div className="spinner" /><p>데이터를 불러오는 중...</p></div>
  );
  if (isError) return <div className="home-error">오류: {error?.message}</div>;

  const {
    myTotalSelected = 0,
    monthlySelected = 0,
    monthlyLimit = 3,
    myIndividualRank,
    individualRankTotal = 0,
    topSelected = 0,
  } = data;

  const isInProgram = currentMonthNum >= 1 && currentMonthNum <= PROGRAM_END_MONTH;
  const monthsLeft = isInProgram ? Math.max(0, PROGRAM_END_MONTH - currentMonthNum) : 0;
  const remainLeft = isInProgram ? Math.max(0, monthlyLimit - monthlySelected) : 0;
  const maxAdditional = monthsLeft * monthlyLimit + remainLeft;

  const tierIdx = getTierIdx(myTotalSelected);
  const currentTier = tierIdx >= 0 ? TIERS[tierIdx] : null;
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;

  const estimatedWon = currentTier ? myTotalSelected * currentTier.rateWon : 0;
  const casesToNext = nextTier ? nextTier.minCases - myTotalSelected : 0;
  const boost = nextTier ? Math.max(0, nextTier.minCases * nextTier.rateWon - estimatedWon) : 0;
  const isAchievable = nextTier !== null && casesToNext <= maxAdditional;

  const PROG_MAX = PROGRAM_END_MONTH * monthlyLimit;
  const myPct = PROG_MAX > 0 ? Math.min((myTotalSelected / PROG_MAX) * 100, 100) : 0;
  const topPct = PROG_MAX > 0 ? Math.min((topSelected / PROG_MAX) * 100, 100) : 0;
  const monthlyPct = Math.min((monthlySelected / monthlyLimit) * 100, 100);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home">

      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <h1 className="adm-title">나의 YOU PRO</h1>
            <p className="adm-sub">{user?.name ?? '구성원'}님 · 선정 건수에 따라 등급과 인센티브 단가가 올라갑니다.</p>
          </div>
          <button type="button" className="adm-header-link adm-pending-btn--cute" onClick={openSubmit}>
            <span className="adm-pending-shine" aria-hidden />
            <span className="adm-pending-btn__inner">
              <Sparkles size={16} strokeWidth={2.25} aria-hidden />
              <span className="adm-pending-btn__label">사례 접수</span>
            </span>
            <ChevronRight className="adm-pending-btn__chev" size={16} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      {/* ── ① 인센티브 ────────────────────────────────────────── */}
      <div className="yp-card yp-inca-card">
        <div className="yp-inca-row">

          {/* 왼쪽: 예상 인센티브 */}
          <div className="yp-inca-main">
            <p className="yp-inca-eyebrow">올해 예상 인센티브</p>
            <div className="yp-inca-fig">
              {estimatedWon > 0 ? (
                <>
                  <span className="yp-inca-num">{estimatedWon.toLocaleString('ko-KR')}</span>
                  <span className="yp-inca-won">원</span>
                </>
              ) : (
                <span className="yp-inca-num yp-inca-num--zero">0원</span>
              )}
            </div>
            <p className="yp-inca-formula">
              {currentTier
                ? `선정 ${myTotalSelected}건 × ${currentTier.rateWon.toLocaleString('ko-KR')}원/건`
                : '선정 1건부터 인센티브가 시작됩니다'}
            </p>
          </div>

          <div className="yp-inca-divider" />

          {/* 오른쪽: KPI 3개 */}
          <div className="yp-inca-kpis">
            <div className="yp-inca-kpi">
              <span className="yp-inca-kpi-label">연간 선정</span>
              <div className="yp-inca-kpi-fig">
                <span className="yp-inca-kpi-num">{myTotalSelected}</span>
                <span className="yp-inca-kpi-unit">건</span>
              </div>
            </div>
            {myIndividualRank != null && individualRankTotal > 0 && (
              <div className="yp-inca-kpi">
                <span className="yp-inca-kpi-label">전체 순위</span>
                <div className="yp-inca-kpi-fig">
                  <span className="yp-inca-kpi-num">{myIndividualRank}</span>
                  <span className="yp-inca-kpi-unit">위</span>
                </div>
                <span className="yp-inca-kpi-sub">/ {individualRankTotal}명 중</span>
              </div>
            )}
            <div className="yp-inca-kpi">
              <span className="yp-inca-kpi-label">이번 달 선정</span>
              <div className="yp-inca-kpi-fig">
                <span className="yp-inca-kpi-num">{monthlySelected}</span>
                <span className="yp-inca-kpi-unit">/ {monthlyLimit}건</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── ② 등급 현황 ───────────────────────────────────────── */}
      <div className="yp-card yp-tiers-card">

        <div className="yp-tiers-head">
          <span className="yp-tiers-title">등급 현황</span>
          <span className="yp-tiers-meta">{currentYear}년 1~9월 선정 기준</span>
        </div>

        {/* 등급 업 달성/추가 지급 안내 */}
        {isInProgram && nextTier && (
          <div className="yp-tier-upgrade-banner">
            <span className="yp-tier-upgrade-dot" />
            <span className="yp-tier-upgrade-text">
              <strong>{casesToNext}건</strong> 더 달성하면 <strong>{nextTier.name}</strong> 등급 ·{' '}
              <span className="yp-tier-upgrade-boost">+{boost.toLocaleString('ko-KR')}원</span> 추가 지급
              {isAchievable && <span className="yp-tier-upgrade-ok">&nbsp;· 달성 가능</span>}
            </span>
          </div>
        )}
        {isInProgram && !nextTier && currentTier && (
          <div className="yp-tier-upgrade-banner yp-tier-upgrade-banner--max">
            <span className="yp-tier-upgrade-dot" />
            <span className="yp-tier-upgrade-text">최고 등급 <strong>YOU 토피아</strong> 달성 중 · 건당 70,000원 적용</span>
          </div>
        )}
        {!isInProgram && (
          <div className="yp-tier-upgrade-banner yp-tier-upgrade-banner--ended">
            <span className="yp-tier-upgrade-text">{currentYear}년 프로그램 종료 · 9월 말 최종 정산 완료</span>
          </div>
        )}

        {/* 등급 3열 */}
        <div className="yp-tiers-row">
          {TIERS.map((tier, i) => {
            const isActive = i === tierIdx;
            const isDone = i < tierIdx;
            const isNext = i === tierIdx + 1;
            return (
              <div key={tier.id}
                className={`yp-tier yp-tier--${tier.id}${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                <div className="yp-tier-top">
                  <span className={`yp-tier-icon yp-tier-icon--${tier.id}`}>
                    <tier.Icon size={14} strokeWidth={2.5} />
                  </span>
                  <div className="yp-tier-badges">
                    {isActive && <span className="yp-tier-badge yp-tier-badge--now">현재</span>}
                    {isDone && <span className="yp-tier-badge yp-tier-badge--done">완료</span>}
                    {isNext && <span className="yp-tier-badge yp-tier-badge--next">목표</span>}
                  </div>
                </div>
                <p className="yp-tier-name">{tier.name}</p>
                <p className="yp-tier-range">{tier.range}</p>
                <p className="yp-tier-rate">
                  {tier.rateWon.toLocaleString('ko-KR')}
                  <span className="yp-tier-rate-u">원/건</span>
                </p>
              </div>
            );
          })}
        </div>

        {/* 위치 비교 프로그레스 바 */}
        <div className="yp-prog-wrap">
          <div className="yp-prog-track">
            {TIERS.map((tier, i) => {
              const l = i === 0 ? 0 : (tier.minCases / PROG_MAX) * 100;
              const r = tier.maxCases === Infinity ? 100 : ((tier.maxCases + 1) / PROG_MAX) * 100;
              return (
                <div key={tier.id}
                  className={`yp-prog-seg yp-prog-seg--${tier.id}`}
                  style={{ left: `${l}%`, width: `${Math.min(r, 100) - l}%` }} />
              );
            })}
            {TIERS.slice(1).map((tier) => (
              <div key={`b-${tier.id}`} className="yp-prog-border"
                style={{ left: `${(tier.minCases / PROG_MAX) * 100}%` }} />
            ))}
            {topSelected > 0 && (
              <div className="yp-prog-pin yp-prog-pin--top" style={{ left: `${topPct}%` }}>
                <span className="yp-prog-pin-tag">1위 {topSelected}건</span>
                <span className="yp-prog-pin-line" />
              </div>
            )}
            <div className="yp-prog-pin yp-prog-pin--me" style={{ left: `${myPct}%` }}>
              <span className="yp-prog-pin-tag">나 {myTotalSelected}건</span>
              <span className="yp-prog-pin-line" />
            </div>
          </div>
          <div className="yp-prog-scale">
            <span>0건</span>
            {TIERS.slice(1).map((tier) => (
              <span key={tier.id} className="yp-prog-scale-mid"
                style={{ left: `${(tier.minCases / PROG_MAX) * 100}%` }}>
                {tier.minCases}건
              </span>
            ))}
            <span>{PROG_MAX}건</span>
          </div>
        </div>

      </div>

      {/* ── ③ 접수 현황 ───────────────────────────────────────── */}
      <Link className="yp-card yp-cases-card" to="/member/cases">

        <div className="yp-cases-head">
          <div className="yp-cases-head-left">
            <span className="yp-cases-title">{currentMonth} 접수 현황</span>
            {isInProgram && (
              <span className="yp-cases-period-chip">
                {monthsLeft > 0 ? `${monthsLeft}개월 남음` : '이번 달 마감'}
              </span>
            )}
          </div>
          <span className="yp-cases-link">
            전체 내역 <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </div>

        {/* 상태 행 */}
        <div className="yp-cases-stats">
          <div className="yp-cases-stat yp-cases-stat--selected">
            <span className="yp-cases-stat-val">{monthStats.selected}</span>
            <span className="yp-cases-stat-label">선정</span>
          </div>
          <div className="yp-cases-sep" />
          <div className="yp-cases-stat yp-cases-stat--pending">
            <span className="yp-cases-stat-val">{monthStats.pending}</span>
            <span className="yp-cases-stat-label">심사 중</span>
          </div>
          <div className="yp-cases-sep" />
          <div className="yp-cases-stat yp-cases-stat--rejected">
            <span className="yp-cases-stat-val">{monthStats.rejected}</span>
            <span className="yp-cases-stat-label">비선정</span>
          </div>
          <div className="yp-cases-sep" />
          <div className="yp-cases-stat yp-cases-stat--total">
            <span className="yp-cases-stat-val">{monthStats.total}</span>
            <span className="yp-cases-stat-label">총 접수</span>
          </div>
        </div>

        {/* 한도 프로그레스 */}
        <div className="yp-cases-quota">
          <div className="yp-cases-quota-top">
            <span className="yp-cases-quota-label">이번 달 선정 한도</span>
            <span className="yp-cases-quota-count">
              <strong>{monthlySelected}</strong> / {monthlyLimit}건
            </span>
          </div>
          <div className="yp-cases-quota-track">
            <div className="yp-cases-quota-fill" style={{ width: `${monthlyPct}%` }} />
          </div>
          <p className="yp-cases-quota-note">
            {remainLeft > 0
              ? `이번 달 ${remainLeft}건 더 선정 가능합니다`
              : '이번 달 선정 한도를 모두 채웠습니다'}
          </p>
        </div>

      </Link>

    </div>
  );
}
