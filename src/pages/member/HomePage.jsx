import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import {
  Plus, ChevronRight, Medal, Zap, Trophy, Check, X, BadgeCheck, Sparkles,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import { fetchRecentSubmissionTrendInsight } from '../../api/lmStudioClient';
import Skeleton from '../../components/common/Skeleton';
import { analyzeMyWeakScoreInsight, analyzeTopScoreTrendInsight } from '../../utils/caseEvaluation';
import {
  buildFallbackRecentTrend,
  formatTopSubmissionTrendSentence,
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
  <>매년 <strong>1~9월</strong> 프로그램 기간, <strong>다음 달 5일 09:00</strong>에 전월 실적이 반영됩니다.</>,
  <>부서 스킬 <strong>만족도 목표 달성</strong> 월에만 그달 인증 건이 누적되며, 반영 건이 <strong>1건 이상</strong>일 때만 해당 월 등급 단가가 지급됩니다.</>,
  <>만족도만 달성하고 인증 건이 없으면 그달 지급은 없고, 누적·등급은 그대로 유지됩니다.</>,
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

function formatYearSatisfactionPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** 만족도 달성률(%) = 실적율 ÷ 목표(%) × 100 */
function resolveMonthlyAchievementRate(actualPct, targetPct, fromApi) {
  const api = Number(fromApi);
  if (Number.isFinite(api)) return Math.round(api * 10) / 10;
  const actual = Number(actualPct);
  const target = Number(targetPct);
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return Math.round((actual / target) * 1000) / 10;
}

function formatMonthlyAchievementRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  const rounded = Math.round(rate * 10) / 10;
  const pct = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${pct}%`;
}

function formatMyCertRank(rank, total) {
  const r = Number(rank);
  if (!Number.isFinite(r) || r < 1) return '—';
  return String(Math.round(r));
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
  return `인증 ${Number(raw)}건`;
}

function getReflectState(row) {
  if (row.csTargetMet == null) return 'na';
  return row.csTargetMet === true ? 'met' : 'no';
}

const HOME_SLOGAN = '오늘의 사례가 내일의 인증이 됩니다';
const BOARD_REFETCH_MS = 30000;

function RecentSubmissionTrend({ trendSummary, scoreInsight, weakInsight, aiPending }) {
  const hasTrendSummary = Boolean(trendSummary);
  const hasScoreLine = Boolean(scoreInsight?.label);
  const hasWeakLine = Boolean(weakInsight?.label);
  const trendLoading = aiPending && !hasTrendSummary;

  if (trendLoading && !hasScoreLine && !hasWeakLine) {
    return (
      <div className="hp-top-trend hp-top-trend--loading" aria-busy="true">
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="82%" height={12} />
      </div>
    );
  }

  if (!hasTrendSummary && !hasScoreLine && !hasWeakLine && !aiPending) {
    return (
      <div className="hp-top-trend">
        <p className="hp-top-trend-empty">트렌드 데이터를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className={`hp-top-trend${aiPending ? ' hp-top-trend--loading' : ''}`}>
      {trendLoading ? (
        <div className="hp-top-trend-loading">
          <Skeleton variant="text" width="100%" height={14} />
          <Skeleton variant="text" width="78%" height={12} />
        </div>
      ) : hasTrendSummary ? (
        <p className="hp-top-trend-summary">{trendSummary}</p>
      ) : null}

      {(hasScoreLine || hasWeakLine) ? (
        <div className="hp-top-trend-notes">
          {hasScoreLine ? (
            <p className="hp-top-trend-score-note">
              상위자들은{' '}
              <mark className="hp-top-trend-score-hl">{scoreInsight.label}</mark>
              {' '}점수에서 가장 높은 점수를 취득했습니다.
              {scoreInsight.avgScore != null && scoreInsight.maxScore != null ? (
                <span className="hp-top-trend-score-meta">
                  {' '}
                  (평균 {scoreInsight.avgScore}/{scoreInsight.maxScore}점)
                </span>
              ) : null}
            </p>
          ) : null}
          {hasWeakLine ? (
            <p className="hp-top-trend-weak-note">
              나는{' '}
              <mark className="hp-top-trend-weak-hl">{weakInsight.label}</mark>
              {' '}항목에서{' '}
              {weakInsight.comparedToTop ? '상위자 대비 ' : ''}
              취약합니다.
              {weakInsight.avgScore != null && weakInsight.maxScore != null ? (
                <span className="hp-top-trend-score-meta">
                  {' '}
                  (내 평균 {weakInsight.avgScore}/{weakInsight.maxScore}점)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const TREND_INSIGHT_LIMIT = 10;

function useRecentSubmissionTrendInsight(cases) {
  const trendCases = useMemo(
    () => (cases ?? []).slice(0, TREND_INSIGHT_LIMIT),
    [cases],
  );
  const canFetchAi = trendCases.length > 0;

  const scoreInsight = useMemo(
    () => analyzeTopScoreTrendInsight(trendCases),
    [trendCases],
  );

  const aiQuery = useQuery({
    queryKey: [
      'home-recent-submission-trend',
      trendCases.map((it) => [
        it.rank,
        it.title,
        it.description?.slice(0, 80),
        it.judgmentReason?.slice(0, 60),
      ]),
    ],
    queryFn: async ({ signal }) => {
      const raw = await fetchRecentSubmissionTrendInsight({ items: trendCases, signal });
      const parsed = parseTopMembersInsight(raw);
      if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다.');
      return parsed;
    },
    enabled: canFetchAi,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const trendSummary = useMemo(() => {
    const summary = aiQuery.data?.recentTrend?.summary;
    if (summary) return formatTopSubmissionTrendSentence(summary);
    return buildFallbackRecentTrend(trendCases).summary;
  }, [aiQuery.data, trendCases]);

  const aiPending = canFetchAi && (aiQuery.isPending || aiQuery.isFetching);

  return {
    trendCases,
    trendSummary,
    scoreInsight,
    aiPending,
  };
}

/** 나의 접수 — 최근 접수 아래 트렌드 */
function SubmissionSuggestionPanel({ insightCases, myCases }) {
  const {
    trendCases,
    trendSummary,
    scoreInsight,
    aiPending,
  } = useRecentSubmissionTrendInsight(insightCases);

  const weakInsight = useMemo(
    () => analyzeMyWeakScoreInsight(myCases, trendCases),
    [myCases, trendCases],
  );

  if (!trendCases.length && !weakInsight) return null;

  return (
    <section
      className="csx-ai-insight-trend-wrap hp-top-suggest-trend hp-mine-suggest"
      aria-label="상위자 최근 접수 트렌드"
    >
      <p className="csx-ai-insight-trend-kicker">
        <span className="csx-ai-insight-trend-kicker__ai" aria-hidden>
          <Sparkles size={12} strokeWidth={2.25} />
        </span>
        상위자 최근 접수 트렌드
      </p>
      <div className="csx-toss-insight">
        <RecentSubmissionTrend
          trendSummary={trendSummary}
          scoreInsight={scoreInsight}
          weakInsight={weakInsight}
          aiPending={aiPending}
        />
        <footer className="csx-toss-foot">
          <p className="csx-toss-ai-source">YOU PRO AI 분석</p>
        </footer>
      </div>
    </section>
  );
}

function getTopRankRowClass(rank) {
  if (rank === 1) return 'hp-top-rank-row--first';
  if (rank === 2) return 'hp-top-rank-row--second';
  if (rank === 3) return 'hp-top-rank-row--third';
  return '';
}

/** YOU 프로 상위 구성원 — 1~10위 전체 표시 */
function TopMembersSpotlightPanel({ items }) {
  const ranked = useMemo(() => (items ?? []).slice(0, 10), [items]);

  if (!ranked.length) return null;

  return (
    <div className="hp-top-panel" role="region" aria-label="YOU 프로 상위 구성원">
      <div className="hp-top-rank-zone">
        <div className="hp-top-rank-head">
          <p className="csx-ai-insight-trend-kicker hp-top-rank-kicker">YOU 프로 마스터</p>
          <span className="hp-top-rank-range">1~10위</span>
        </div>
        <div className="hp-top-rank-table-wrap">
          <table className="hp-top-rank-table">
            <caption className="hp-top-rank-table-caption">YOU프로 마스터 1~10위</caption>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">센터</th>
                <th scope="col">이름</th>
                <th scope="col">당월 만족도</th>
                <th scope="col">인증</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr
                  key={row.rank}
                  className={`hp-top-rank-row ${getTopRankRowClass(row.rank)}`.trim()}
                >
                  <td className="hp-top-rank-cell hp-top-rank-cell--rank">
                    <span
                      className={`hp-top-rank-num${row.rank <= 3 ? ` hp-top-rank-num--top hp-top-rank-num--r${row.rank}` : ''}`}
                    >
                      {row.rank}
                    </span>
                    <span className="hp-top-rank-suffix">위</span>
                  </td>
                  <td className="hp-top-rank-cell hp-top-rank-cell--center" title={row.centerName || ''}>
                    {row.centerName?.trim() ? row.centerName : '—'}
                  </td>
                  <td className="hp-top-rank-cell hp-top-rank-cell--name" title={row.memberName || ''}>
                    {row.memberName?.trim() ? row.memberName : '—'}
                  </td>
                  <td className="hp-top-rank-cell hp-top-rank-cell--sat">
                    {formatYearSatisfactionPct(row.monthSatisfactionPct)}
                  </td>
                  <td className="hp-top-rank-cell hp-top-rank-cell--cert">
                    <strong>{Number(row.cumulativeCount ?? 0)}</strong>
                    <span className="hp-top-rank-unit">건</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
              viewBox="0 0 190 56"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-hidden="true"
            >
              <title>YOU 프로</title>
              <defs>
                <linearGradient id="hp-logo-you-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F4A3E" />
                  <stop offset="100%" stopColor="#0D9488" />
                </linearGradient>
                <linearGradient id="hp-logo-pro-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#14B8A6" />
                  <stop offset="100%" stopColor="#0F766E" />
                </linearGradient>
                <filter id="hp-logo-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g className="hp-intro-logo-spark hp-intro-logo-spark--lead" transform="translate(2 12)">
                <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
              </g>
              <text
                className="hp-intro-logo-you"
                x="20"
                y="34"
                dominantBaseline="middle"
                fill="url(#hp-logo-you-grad)"
                filter="url(#hp-logo-glow)"
              >
                YOU
              </text>
              <text
                className="hp-intro-logo-pro"
                x="98"
                y="34"
                dominantBaseline="middle"
                fill="url(#hp-logo-pro-grad)"
                filter="url(#hp-logo-glow)"
              >
                프로
              </text>
              <g className="hp-intro-logo-spark hp-intro-logo-spark--trail" transform="translate(176 12)">
                <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
              </g>
              <path
                className="hp-intro-logo-line-brand"
                d="M20 50 L150 50"
              />
              <path
                className="hp-intro-logo-line-accent"
                d="M154 50 L186 50"
              />
              <circle className="hp-intro-logo-line-dot" cx="152" cy="50" r="1.8" />
            </svg>
            <span className="hp-intro-verify" aria-label="공식 인증">
              <svg
                className="hp-intro-verify-svg"
                viewBox="0 0 44 58"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-hidden="true"
              >
                <title>YOU PRO 공식 인증</title>
                <g className="hp-intro-verify-ribbon hp-intro-verify-ribbon--left">
                  <polygon
                    points="11,32 19,32 16,55 11,50 6,54"
                    fill="#0F766E"
                  />
                  <polygon
                    points="11,32 14,32 11,50 6,54"
                    fill="#0B5E57"
                    opacity="0.55"
                  />
                </g>
                <g className="hp-intro-verify-ribbon hp-intro-verify-ribbon--right">
                  <polygon
                    points="25,32 33,32 38,54 33,50 28,55"
                    fill="#0F766E"
                  />
                  <polygon
                    points="30,32 33,32 38,54 33,50"
                    fill="#0B5E57"
                    opacity="0.55"
                  />
                </g>
                <polygon
                  className="hp-intro-verify-hex"
                  points="22,3 37.5,12 37.5,33 22,42 6.5,33 6.5,12"
                  fill="#0D9488"
                />
                <polygon
                  className="hp-intro-verify-hex-inner"
                  points="22,6.5 34.5,13.7 34.5,31.3 22,38.5 9.5,31.3 9.5,13.7"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="0.8"
                />
                <path
                  className="hp-intro-verify-check"
                  d="M14 22.5 L19.5 28 L30 17.5"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="hp-intro-verify-star"
                  d="M22 1 L23.1 3.3 L25.5 3.7 L23.8 5.4 L24.2 7.8 L22 6.6 L19.8 7.8 L20.2 5.4 L18.5 3.7 L20.9 3.3 Z"
                  fill="#FCD34D"
                />
              </svg>
            </span>
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
            className="hp-intro-cta hp-intro-cta--keycap"
            onClick={onSubmit}
            aria-label="사례 접수하기"
          >
            <span className="hp-intro-cta-keytop">
              <span className="hp-intro-cta-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.75} />
              </span>
              <span className="hp-intro-cta-label">접수하기</span>
              <span className="hp-intro-cta-kbd" aria-hidden>↵</span>
            </span>
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
          <span className="hp-tier-summary-label">현재 금액</span>
          <span className="hp-tier-summary-val hp-tier-summary-val--money">
            {formatWon(totalReflectedWon)}
          </span>
        </div>
        <span className="hp-tier-summary-arrow" aria-hidden>
          <ChevronRight size={16} strokeWidth={2.5} />
        </span>
        <div className="hp-tier-summary-item hp-tier-summary-item--cert">
          <span className="hp-tier-summary-label">올해 인증 건</span>
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
                  {it.state === 'met' && '만족도 달성'}
                  {it.state === 'no' && '무효 · 만족도 미달성'}
                  {it.state === 'done' && '종료'}
                  {it.state === 'na' && '대기'}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ol>
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
    const thisMonthCases = [];
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      thisMonthCases.push(c);
      if (c.status === 'selected') selected++;
      else if (c.status === 'pending') pending++;
    });
    thisMonthCases.sort((a, b) => {
      const ta = new Date(a.submittedAt || 0).getTime();
      const tb = new Date(b.submittedAt || 0).getTime();
      return tb - ta;
    });
    return {
      monthStats: { selected, pending },
      monthPreviewCases: thisMonthCases.slice(0, 3),
    };
  }, [cases]);

  if (isLoading || !data) return <HomeSkeleton userName={user?.name} />;
  if (isError) return <div className="hp-error">오류: {error?.message}</div>;

  const {
    totalReflectedWon = 0,
    currentMonthCsTargetMet = null,
    csSkillTargetPercent = null,
    csActualPercent = null,
    csMonthlyAchievementRate = null,
    yearReflectCumulativeCount = 0,
    reflectMonthsJanSep = [],
    certificationBoard = null,
    myIndividualRank = null,
    individualRankTotal = null,
  } = data;

  const csHasTarget =
    csSkillTargetPercent != null && Number(csSkillTargetPercent) > 0;

  const monthlyAchievementRate = resolveMonthlyAchievementRate(
    csActualPercent,
    csSkillTargetPercent,
    csMonthlyAchievementRate,
  );

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
              <TopMembersSpotlightPanel items={certificationBoard.items} />
            </aside>
          )}

          <div className="hp-month-split-col hp-month-split-col--mine" aria-label="나의 접수 현황">
            <div className="hp-month-split-col-head hp-month-split-col-head--main">
              <h2 className="hp-month-split-col-title hp-month-split-col-title--main">
                <span className="hp-month-split-col-month">{currentMonthNum}월</span>
                <span className="hp-month-split-col-title-text">나의 접수 현황</span>
              </h2>
              {currentMonthCsTargetMet === true && (
                <span className="hp-month-cs hp-month-cs--met hp-month-cs--seal hp-month-cs--seal-sm">
                  <BadgeCheck size={12} strokeWidth={2.5} aria-hidden />
                  만족도 달성
                </span>
              )}
              {currentMonthCsTargetMet === false && csHasTarget && (
                <span className="hp-month-cs hp-month-cs--achievement hp-month-cs--seal hp-month-cs--seal-sm">
                  당월 만족도 달성률 {formatMonthlyAchievementRate(monthlyAchievementRate)}
                </span>
              )}
            </div>

            <div className="hp-month-block-grid hp-month-block-grid--compact">
              <button
                type="button"
                className="hp-month-block-item hp-month-block-item--selected hp-month-block-item--btn hp-month-block-item--compact"
                onClick={() => openCaseList('인증')}
                aria-label="인증 사례만 보기"
              >
                <span className="hp-month-block-item-label-top">인증</span>
                <div className="hp-month-block-num-row">
                  <span className="hp-month-block-val">{monthStats.selected}</span>
                  <span className="hp-month-block-unit">건</span>
                </div>
              </button>
              <button
                type="button"
                className="hp-month-block-item hp-month-block-item--pending hp-month-block-item--btn hp-month-block-item--compact"
                onClick={() => openCaseList('청취 예정중')}
                aria-label="청취 예정 사례만 보기"
              >
                <span className="hp-month-block-item-label-top">청취 예정</span>
                <div className="hp-month-block-num-row">
                  <span className="hp-month-block-val">{monthStats.pending}</span>
                  <span className="hp-month-block-unit">건</span>
                </div>
              </button>
              <div
                className="hp-month-block-item hp-month-block-item--rank hp-month-block-item--compact"
                role="status"
                aria-label={
                  myIndividualRank != null && individualRankTotal != null
                    ? `YOU 프로 평가대상자 ${individualRankTotal}명 중 인증 건수 기준 ${myIndividualRank}위`
                    : '나의 순위 정보 없음'
                }
              >
                <span className="hp-month-block-item-label-top">나의 순위</span>
                <div className="hp-month-block-num-row">
                  <span className="hp-month-block-val">{formatMyCertRank(myIndividualRank)}</span>
                  <span className="hp-month-block-unit">위</span>
                </div>
              </div>
            </div>

            <div className="hp-month-preview hp-month-preview--compact hp-month-preview--fixed">
              <div className="hp-month-preview-head">
                <span className="hp-month-preview-label">최근 접수</span>
                <Link to="/member/cases" className="hp-month-block-link">
                  전체 <ChevronRight size={12} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="hp-month-preview-body">
                {monthPreviewCases.length === 0 ? (
                  <p className="hp-month-preview-empty">이번 달 접수 내역이 없습니다.</p>
                ) : (
                  <ul className="hp-month-preview-list hp-month-preview-list--fixed">
                    {monthPreviewCases.map((c) => (
                      <li key={c.id} className="hp-month-preview-slot">
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

            <SubmissionSuggestionPanel
              insightCases={certificationBoard?.insightCases}
              myCases={cases}
            />
          </div>
        </div>
      </section>

      <section className="hp-tier-block" aria-label="등급과 인센티브">
        <span className="hp-corner-tr" aria-hidden />
        <span className="hp-corner-bl" aria-hidden />
        <div className="hp-tier-block-header">
          <span className="hp-tier-block-title">YOU프로 Reward</span>
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
                openCaseList('인증', `${now.getFullYear()}-${String(m).padStart(2, '0')}`)
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