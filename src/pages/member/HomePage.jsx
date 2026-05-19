import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import {
  Plus, ChevronRight, Medal, Zap, Trophy, Check, X, BadgeCheck, ShieldAlert, HelpCircle,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import { fetchTopMembersSpotlightInsight } from '../../api/lmStudioClient';
import Skeleton from '../../components/common/Skeleton';
import {
  buildFallbackRecentTrend,
  formatReadableText,
  mapTopMembersInsightByRank,
  parseTopMembersInsight,
} from '../../utils/parseTopMembersInsight';
import StatusBadge from '../../components/common/StatusBadge';
import '../admin/DashboardPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentMonthNum = now.getMonth() + 1;

/** 월별 반영 시점·조건 (백엔드 스케줄러와 동일 개념) */
const PAYOUT_POLICY_LINES = [
  <>매년 <strong>1~9월</strong> 프로그램 기간, <strong>다음 달 1일 18시</strong>에 전월 실적이 반영됩니다.</>,
  <>부서 스킬 <strong>만족도 목표 달성</strong> 월에만 그달 선정 건이 인증·누적되며, 반영 건이 <strong>1건 이상</strong>일 때만 해당 월 등급 단가가 지급됩니다.</>,
  <>만족도만 달성하고 선정이 없으면 그달 지급은 없고, 누적·등급은 그대로 유지됩니다.</>,
];

const TIERS = [
  { id: 'mangju', name: 'YOU 망주', range: '1건 이상', minCases: 1, rateWon: 30000 },
  { id: 'player', name: 'YOU 플레이어', range: '10건 이상', minCases: 10, rateWon: 50000 },
  { id: 'topia', name: 'YOU 토피아', range: '19건 이상', minCases: 19, rateWon: 70000 },
];

const TIER_ICONS = {
  mangju: Medal,
  player: Zap,
  topia: Trophy,
};

function getTierIdx(n) {
  if (n >= 19) return 2;
  if (n >= 10) return 1;
  if (n >= 1) return 0;
  return -1;
}

function getTierNameByCumulative(count) {
  const idx = getTierIdx(Number(count) || 0);
  return idx >= 0 ? TIERS[idx].name : null;
}

function formatPreviewDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatWon(won) {
  const n = Number(won);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ko-KR')}원`;
}

function reflectCsDotClass(met) {
  if (met === true) return 'hp-reflect-dot hp-reflect-dot--met';
  if (met === false) return 'hp-reflect-dot hp-reflect-dot--no';
  return 'hp-reflect-dot hp-reflect-dot--na';
}

function reflectRawRowClass(raw) {
  if (raw == null) return 'hp-reflect-raw hp-reflect-raw--na';
  if (Number(raw) > 0) return 'hp-reflect-raw hp-reflect-raw--hit';
  return 'hp-reflect-raw hp-reflect-raw--zero';
}

function reflectPickSegText(raw) {
  if (raw == null) return '—';
  return String(Number(raw));
}

function reflectCsTitle(met) {
  if (met === true) return '만족도 달성';
  if (met === false) return '만족도 미달';
  return '반영 전';
}

function reflectPickTitle(raw) {
  if (raw == null) return '반영 전';
  return `선정 raw ${Number(raw)}건`;
}

function getReflectState(row) {
  if (row.csTargetMet == null) return 'na';
  return row.csTargetMet === true ? 'met' : 'no';
}

const HOME_SLOGAN = '오늘의 사례가 내일의 인증이 됩니다';
const BOARD_REFETCH_MS = 30000;
const RANK_ROTATE_MS = 5000;

function TopRankEntryCard({ item, aiPending }) {
  const title = item.title?.trim() ? item.title.trim() : '제목 없음';
  const tierName = item.tierName || getTierNameByCumulative(item.cumulativeCount);
  const metaLabel = [
    `${item.rank}위`,
    tierName,
    `누적 ${item.cumulativeCount}건`,
  ].filter(Boolean).join(' ');

  return (
    <article
      className={`hp-top-entry${item.rank === 1 ? ' hp-top-entry--first' : ''}`}
      aria-label={metaLabel}
    >
      <p className="hp-top-entry-meta">
        <span className="hp-top-entry-rank">{item.rank}위</span>
        {tierName ? (
            <span className="hp-top-entry-tier">{tierName}</span>
        ) : null}
        <span className="hp-top-entry-cert">
          누적 <strong>{item.cumulativeCount}</strong>건
        </span>
      </p>
      <h3 className="hp-top-entry-title" title={title}>{title}</h3>
      <div className="hp-top-entry-point-slot">
        {aiPending ? (
            <div className="hp-top-entry-point hp-top-entry-point--loading" aria-busy="true">
              <span className="hp-top-entry-point-label">선정 포인트</span>
              <Skeleton variant="text" width="100%" height={11} />
              <Skeleton variant="text" width="88%" height={11} />
            </div>
        ) : (
            <p className="hp-top-entry-point">
              <span className="hp-top-entry-point-label">선정 포인트</span>
              <span className="hp-top-entry-point-text">
                {formatReadableText(item.selectionReason)}
              </span>
            </p>
        )}
      </div>
    </article>
  );
}

function RecentSubmissionTrend({ trend, pending }) {
  if (pending) {
    return (
        <div className="hp-top-trend hp-top-trend--loading" aria-busy="true">
          <Skeleton variant="text" width="72%" height={11} />
          <Skeleton variant="text" width="100%" height={12} />
          <Skeleton variant="text" width="88%" height={11} />
        </div>
    );
  }

  const { summary, bullets } = trend ?? {};

  return (
      <div className="hp-top-trend">
        <p className="hp-top-trend-label">최근 접수 트렌드</p>
        {summary ? (
            <p className="hp-top-trend-summary">{summary}</p>
        ) : null}
        {bullets?.length ? (
            <ul className="hp-top-trend-bullets csx-toss-bullets">
              {bullets.map((line) => (
                  <li key={line.slice(0, 24)} className="csx-toss-bullet hp-top-trend-bullet">
                    {line}
                  </li>
              ))}
            </ul>
        ) : null}
      </div>
  );
}

/** YOU 프로 상위 구성원 — 랭킹 1~3위 로테이션 + 접수 제안 */
function TopMembersSpotlightPanel({ items }) {
  const top3 = useMemo(() => (items ?? []).slice(0, 3), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const canFetchAi = top3.length > 0;

  const aiQuery = useQuery({
    queryKey: [
      'home-top-members-ai',
      top3.map((it) => [
        it.rank,
        it.title,
        it.description?.slice(0, 80),
        it.judgmentReason?.slice(0, 60),
      ]),
    ],
    queryFn: async ({ signal }) => {
      const raw = await fetchTopMembersSpotlightInsight({ items: top3, signal });
      const parsed = parseTopMembersInsight(raw);
      if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다.');
      return parsed;
    },
    enabled: canFetchAi,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const insight = useMemo(
    () => mapTopMembersInsightByRank(top3, aiQuery.data),
    [top3, aiQuery.data],
  );

  const ranked = insight.ranked;

  useEffect(() => {
    setActiveIndex(0);
    setSlideKey(0);
  }, [ranked]);

  useEffect(() => {
    if (ranked.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ranked.length);
      setSlideKey((k) => k + 1);
    }, RANK_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [ranked]);

  const aiPending = canFetchAi && (aiQuery.isPending || aiQuery.isFetching);
  const aiUsedFallback = canFetchAi && aiQuery.isError && !aiQuery.data;
  const recentTrend = insight.recentTrend?.summary
    ? insight.recentTrend
    : buildFallbackRecentTrend(top3);

  if (!top3.length) return null;

  const safeIndex = Math.min(activeIndex, ranked.length - 1);
  const activeItem = ranked[safeIndex];

  return (
      <div className="hp-top-panel" role="region" aria-label="YOU 프로 상위 구성원 AI 인사이트">
        <div className="hp-top-rank-zone">
          <p className="csx-ai-insight-trend-kicker hp-top-rank-kicker">랭킹 1~3위 · 최근 선정</p>
          <div className="hp-top-rank-ticker" aria-live="polite" aria-atomic="true">
            {activeItem ? (
                <div
                    key={`${safeIndex}-${slideKey}`}
                    className="hp-top-rank-ticker-slide"
                >
                  <TopRankEntryCard item={activeItem} aiPending={aiPending} />
                </div>
            ) : null}
            {ranked.length > 1 ? (
                <div className="hp-top-rank-dots" aria-hidden>
                  {ranked.map((it, idx) => (
                      <span
                          key={it.rank}
                          className={`hp-top-rank-dot${idx === safeIndex ? ' is-active' : ''}`}
                      />
                  ))}
                </div>
            ) : null}
          </div>
        </div>

        <section
            className="csx-ai-insight-trend-wrap hp-top-suggest-trend"
            aria-label="최근 선정 사례 접수 제안"
        >
          <p className="csx-ai-insight-trend-kicker">접수 제안</p>
          <div className="csx-toss-insight">
            <section
                className="hp-top-suggest-why csx-toss-why"
                aria-labelledby="hp-top-suggest-why-title"
            >
              <h4 id="hp-top-suggest-why-title" className="hp-top-suggest-why-title">
                <span className="hp-top-suggest-why-main">이렇게 접수해 보세요</span>
                <HelpCircle size={14} strokeWidth={2.2} className="csx-toss-why-ico" aria-hidden />
              </h4>
              <RecentSubmissionTrend trend={recentTrend} pending={aiPending} />
              {aiUsedFallback ? (
                  <p className="csx-toss-ai-fallback" role="status">
                    AI 연결 실패 — 기본 분석을 표시합니다.
                  </p>
              ) : null}
            </section>
            <footer className="csx-toss-foot">
              <span className="csx-toss-ai-badge">YOU PRO AI 분석</span>
            </footer>
          </div>
        </section>
      </div>
  );
}



function HomeIntro({ userName, onSubmit, loading = false }) {
  const displayName = userName?.trim() ? userName.trim() : '구성원';

  return (
      <header className={`hp-intro${loading ? ' hp-intro--loading' : ''}`}>
        <div className="hp-intro-main">
          <div className="hp-intro-text">
            <h1 className="hp-intro-title" aria-label="YOU 프로">
              <svg
                  className="hp-intro-logo"
                  viewBox="0 0 200 50"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-hidden="true"
              >
                <title>YOU 프로</title>
                <text
                    className="hp-intro-logo-you"
                    x="2"
                    y="32"
                    dominantBaseline="middle"
                >
                  YOU
                </text>
                <text
                    className="hp-intro-logo-pro"
                    x="78"
                    y="32"
                    dominantBaseline="middle"
                >
                  프로
                </text>
                <path
                    className="hp-intro-logo-line-brand"
                    d="M2 46 L132 46"
                />
                <path
                    className="hp-intro-logo-line-accent"
                    d="M136 46 L186 46"
                />
              </svg>
            </h1>
            <p className="hp-intro-line">
              <strong className="hp-intro-name">{displayName}</strong>님
              <span className="hp-intro-sep" aria-hidden>
              ·
            </span>
              <span className="hp-intro-slogan">{HOME_SLOGAN}</span>
            </p>
          </div>
          {loading ? (
              <Skeleton width={140} height={56} radius={16} />
          ) : (
              <button
                  type="button"
                  className="hp-intro-cta"
                  onClick={onSubmit}
                  aria-label="사례 접수하기"
              >
            <span className="hp-intro-cta-icon" aria-hidden>
              <Plus size={20} strokeWidth={3} />
            </span>
                <span className="hp-intro-cta-label">접수하기</span>
              </button>
          )}
        </div>
      </header>
  );
}

function ReflectTimeline({ rows, cumulative, totalReflectedWon, onPickMonth }) {
  const items = rows.map((row) => {
    const baseState = getReflectState(row);
    const raw = row.selectedCountRaw == null ? 0 : Number(row.selectedCountRaw);
    const certified = baseState === 'met' ? (raw > 0 ? raw : 0) : 0;
    const isPast = row.month < currentMonthNum;
    const state = baseState === 'na' && isPast ? 'done' : baseState;
    return { month: row.month, raw, certified, state };
  });

  return (
      <section className="hp-rfx" role="group" aria-label="연간 적립 현황 요약">
        <div className="hp-tier-summary">
          <div className="hp-tier-summary-item">
            <span className="hp-tier-summary-label">현재 누적 금액</span>
            <span className="hp-tier-summary-val hp-tier-summary-val--money">
            {formatWon(totalReflectedWon)}
          </span>
          </div>
          <span className="hp-tier-summary-arrow" aria-hidden>
          <ChevronRight size={16} strokeWidth={2.5} />
        </span>
          <div className="hp-tier-summary-item hp-tier-summary-item--cert">
            <span className="hp-tier-summary-label">올해 인증 누적</span>
            <span className="hp-tier-summary-val">
            <strong>{cumulative}</strong>
            <span className="hp-tier-summary-unit">건</span>
          </span>
          </div>
        </div>

        <header className="hp-rfx-hd">
          <h3 className="hp-rfx-title">월별 반영 현황</h3>
          <span className="hp-rfx-sub">1월 – 9월</span>
        </header>

        <ol className="hp-rfx-track">
          {items.map((it) => (
              <li key={it.month} className={`hp-rfx-cell hp-rfx-cell--${it.state}`}>
                <button
                    type="button"
                    className="hp-rfx-cell-btn"
                    onClick={() => onPickMonth?.(it.month)}
                    aria-label={`${it.month}월 사례 보기`}
                >
                  <div className="hp-rfx-cell-head">
                    <span className="hp-rfx-cell-month">{it.month}월</span>
                    <span className="hp-rfx-cell-glyph" aria-hidden>
                  {it.state === 'met' && <Check size={9} strokeWidth={3.5} />}
                      {it.state === 'no' && <X size={9} strokeWidth={3.5} />}
                </span>
                  </div>
                  <div className="hp-rfx-cell-body">
                    <span className="hp-rfx-cell-num">{it.raw}건</span>
                    <span className="hp-rfx-cell-cap">
                  {it.state === 'met' && `인증 · 만족도 달성`}
                      {it.state === 'no' && '무효 · 만족도 미달성'}
                      {it.state === 'done' && '종료'}
                      {it.state === 'na' && '대기'}
                </span>
                  </div>
                </button>
              </li>
          ))}
        </ol>

        <p className="hp-rfx-help">
          만족도 달성한 달의 선정 건수만 인증으로 누적됩니다
        </p>
      </section>
  );
}

function HomeSkeleton({ userName }) {
  return (
      <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">
        <HomeIntro userName={userName} loading />

        <aside className="hp-program-note">
          <Skeleton variant="text" width={140} height={13} />
          <Skeleton variant="text" width="100%" height={36} />
        </aside>

        <section className="hp-hero hp-hero--month-unified">
          <div className="hp-month-split">
            <div className="hp-month-split-col hp-month-split-col--board">
              <Skeleton variant="text" width={160} height={14} />
              <Skeleton height={100} radius={14} />
            </div>
            <div className="hp-month-split-col hp-month-split-col--mine">
              <Skeleton variant="text" width={120} height={14} />
              <div className="hp-month-block-grid hp-month-block-grid--compact">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={52} radius={8} />
                ))}
              </div>
              {[0, 1].map((i) => (
                  <Skeleton key={`pv-${i}`} height={34} radius={8} />
              ))}
            </div>
          </div>
        </section>

        <section className="hp-tier-block hp-tier-block--loading">
          <div className="hp-tier-block-header">
            <Skeleton variant="text" width={120} height={14} />
          </div>
          <div className="hp-tier-main">
            <div className="hp-tier-main-left">
              <Skeleton height={220} radius={12} />
            </div>
            <aside className="hp-tier-rank-aside-v2">
              <div className="hp-tier-rank-rows">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={56} radius={10} />
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmit = useMemberModalStore((s) => s.openSubmit);
  const openCaseList = useMemberModalStore((s) => s.openCaseList);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['member-home', user?.skid],
    queryFn: () => fetchMemberHome(user.skid),
    enabled: !!user?.skid,
    refetchInterval: BOARD_REFETCH_MS,
    refetchIntervalInBackground: true,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['my-cases', user?.skid],
    queryFn: () => fetchMyCases(user.skid),
    enabled: !!user?.skid,
  });

  const { monthStats, monthPreviewCases } = useMemo(() => {
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let selected = 0;
    let pending = 0;
    let rejected = 0;
    const thisMonthCases = [];
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      thisMonthCases.push(c);
      if (c.status === 'selected') selected++;
      else if (c.status === 'pending') pending++;
      else if (c.status === 'rejected') rejected++;
    });
    thisMonthCases.sort((a, b) => {
      const ta = new Date(a.submittedAt || 0).getTime();
      const tb = new Date(b.submittedAt || 0).getTime();
      return tb - ta;
    });
    return {
      monthStats: { selected, pending, rejected },
      monthPreviewCases: thisMonthCases.slice(0, 3),
    };
  }, [cases]);

  if (isLoading || !data) return <HomeSkeleton userName={user?.name} />;
  if (isError) return <div className="hp-error">오류: {error?.message}</div>;

  const {
    totalReflectedWon = 0,
    currentMonthCsTargetMet = null,
    csSkillTargetPercent = null,
    yearReflectCumulativeCount = 0,
    reflectMonthsJanSep = [],
    certificationBoard = null,
  } = data;

  const csHasTarget =
      csSkillTargetPercent != null && Number(csSkillTargetPercent) > 0;

  const cumulative = yearReflectCumulativeCount;
  const tierIdx = getTierIdx(cumulative);

  const reflectRows =
      reflectMonthsJanSep.length >= 9
          ? reflectMonthsJanSep
          : Array.from({ length: 9 }, (_, i) => {
            const m = i + 1;
            const hit = reflectMonthsJanSep.find((r) => r.month === m);
            return hit ?? { month: m, csTargetMet: null, selectedCountRaw: null };
          });

  return (
      <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">

        <HomeIntro userName={user?.name} onSubmit={openSubmit} />

        <section
            className={`hp-hero hp-hero--month-unified${(certificationBoard?.items?.length ?? 0) === 0 ? ' hp-hero--month-unified-solo' : ''}`}
            aria-label={`${currentMonthNum}월 접수 현황`}
        >
          <span className="hp-corner-tr" aria-hidden />
          <span className="hp-corner-bl" aria-hidden />

          <div className="hp-month-split">
            {(certificationBoard?.items?.length ?? 0) > 0 && (
                <aside className="hp-month-split-col hp-month-split-col--board" aria-label="YOU 프로 상위 구성원 현황">
                  <div className="hp-month-split-col-head hp-month-split-col-head--sub">
                    <span className="hp-month-split-col-title hp-month-split-col-title--sub">YOU 프로 상위 구성원</span>
                  </div>
                  <TopMembersSpotlightPanel items={certificationBoard.items} />
                </aside>
            )}

            <div className="hp-month-split-col hp-month-split-col--mine" aria-label="나의 접수 현황">
              <div className="hp-month-split-col-head hp-month-split-col-head--main">
                <h2 className="hp-month-split-col-title hp-month-split-col-title--main">
                  <span className="hp-month-split-col-month">{currentMonthNum}월</span>
                  <span className="hp-month-split-col-title-text">나의 접수</span>
                </h2>
                {currentMonthCsTargetMet === true && (
                    <span className="hp-month-cs hp-month-cs--met hp-month-cs--seal hp-month-cs--seal-sm">
                  <BadgeCheck size={12} strokeWidth={2.5} aria-hidden />
                  만족도 달성
                </span>
                )}
                {currentMonthCsTargetMet === false && (
                    <span className="hp-month-cs hp-month-cs--no hp-month-cs--seal hp-month-cs--seal-sm">
                  <ShieldAlert size={12} strokeWidth={2.5} aria-hidden />
                  만족도 필요
                </span>
                )}
              </div>

              <div className="hp-month-block-grid hp-month-block-grid--compact">
                <button
                    type="button"
                    className="hp-month-block-item hp-month-block-item--selected hp-month-block-item--btn hp-month-block-item--compact"
                    onClick={() => openCaseList('선정')}
                    aria-label="선정 사례만 보기"
                >
                  <span className="hp-month-block-item-label-top">선정</span>
                  <div className="hp-month-block-num-row">
                    <span className="hp-month-block-val">{monthStats.selected}</span>
                    <span className="hp-month-block-unit">건</span>
                  </div>
                </button>
                <button
                    type="button"
                    className="hp-month-block-item hp-month-block-item--pending hp-month-block-item--btn hp-month-block-item--compact"
                    onClick={() => openCaseList('대기중')}
                    aria-label="대기 중 사례만 보기"
                >
                  <span className="hp-month-block-item-label-top">대기 중</span>
                  <div className="hp-month-block-num-row">
                    <span className="hp-month-block-val">{monthStats.pending}</span>
                    <span className="hp-month-block-unit">건</span>
                  </div>
                </button>
                <button
                    type="button"
                    className="hp-month-block-item hp-month-block-item--rejected hp-month-block-item--btn hp-month-block-item--compact"
                    onClick={() => openCaseList('비선정')}
                    aria-label="비선정 사례만 보기"
                >
                  <span className="hp-month-block-item-label-top">비선정</span>
                  <div className="hp-month-block-num-row">
                    <span className="hp-month-block-val">{monthStats.rejected}</span>
                    <span className="hp-month-block-unit">건</span>
                  </div>
                </button>
              </div>

              <div className="hp-month-preview hp-month-preview--compact">
                <div className="hp-month-preview-head">
                  <span className="hp-month-preview-label">최근 접수</span>
                  <Link to="/member/cases" className="hp-month-block-link">
                    전체 <ChevronRight size={12} strokeWidth={2.5} />
                  </Link>
                </div>
                {monthPreviewCases.length === 0 ? (
                    <p className="hp-month-preview-empty">이번 달 접수 내역이 없습니다.</p>
                ) : (
                    <ul className="hp-month-preview-list">
                      {monthPreviewCases.map((c) => (
                          <li key={c.id}>
                            <Link to="/member/cases" className="hp-month-preview-row" aria-label={`${c.title || '사례'} 상세 목록으로 이동`}>
                        <span className="hp-month-preview-badge">
                          <StatusBadge status={c.status} size="sm" />
                        </span>
                              <span className="hp-month-preview-title" title={c.title || ''}>
                          {c.title?.trim() ? c.title : '제목 없음'}
                        </span>
                              <span className="hp-month-preview-date">{formatPreviewDate(c.submittedAt)}</span>
                              <ChevronRight size={14} strokeWidth={2.25} className="hp-month-preview-chev" aria-hidden />
                            </Link>
                          </li>
                      ))}
                    </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="hp-tier-block" aria-label="등급과 인센티브">
          <span className="hp-corner-tr" aria-hidden />
          <span className="hp-corner-bl" aria-hidden />
          <div className="hp-tier-block-header">
            <span className="hp-tier-block-title">YOU니버스 적립식 적금</span>
            {currentMonthCsTargetMet === true && csHasTarget && (
                <span className="hp-month-cs hp-month-cs--met">{currentMonthNum}월 만족도 달성</span>
            )}
            {!csHasTarget && (
                <span className="hp-month-cs hp-month-cs--muted">만족도 목표 없음</span>
            )}
          </div>

          <div className="hp-tier-main">
            <div className="hp-tier-main-left">
              <ReflectTimeline
                  rows={reflectRows}
                  cumulative={cumulative}
                  totalReflectedWon={totalReflectedWon}
                  onPickMonth={(m) =>
                      openCaseList('선정', `${now.getFullYear()}-${String(m).padStart(2, '0')}`)
                  }
              />
            </div>

            <aside className="hp-tier-rank-aside-v2" aria-label="등급표">
              <div className="hp-tier-rank-rows">
                {TIERS.map((tier, i) => {
                  const TierIcon = TIER_ICONS[tier.id];
                  const isCurrent = i === tierIdx;
                  return (
                      <div
                          key={tier.id}
                          className={`hp-tier-rank-card hp-tier-rank-card--${tier.id}${isCurrent ? ' is-current' : ''}`}
                      >
                    <span className="hp-tier-rank-card-icon" aria-hidden>
                      <TierIcon size={14} strokeWidth={2.5} />
                    </span>
                        <div className="hp-tier-rank-card-body">
                          <span className="hp-tier-rank-card-name">{tier.name}</span>
                          <span className="hp-tier-rank-card-range">{tier.range}</span>
                        </div>
                        <span className="hp-tier-rank-card-rate">
                      {tier.rateWon / 10000}만원
                          {isCurrent && <span className="hp-tier-rank-card-now">현재</span>}
                    </span>
                      </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </section>

      </div>
  );
}