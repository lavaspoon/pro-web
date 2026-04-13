import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Sparkles,
  ThumbsUp,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
  Bot,
  TrendingUp,
  Lightbulb,
  TriangleAlert,
  CircleCheck,
  RefreshCw,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberSatisfaction } from '../../api/memberApi';
import '../admin/DashboardPage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

/* ── mock 데이터 ──────────────────────────────────────────── */
const MOCK_DATA = {
  target: 94.9,
  score: 99.2,
  achievementRate: 105.4,
  totalSamples: 47,
  satisfiedCount: 46,
  unsatisfiedCount: 1,
  cumulativeSamples: 47,
  weeklyTrend: [
    { day: '4/8',  score: 92 },
    { day: '4/9',  score: 95 },
    { day: '4/10', score: 94 },
    { day: '4/11', score: 97 },
    { day: '4/12', score: 96 },
    { day: '4/13', score: 98 },
    { day: '4/14', score: 99.2 },
  ],
  unsatisfiedCategories: [
    { label: '서비스 지식부족',         count: 0 },
    { label: '성의 없는 태도',          count: 0 },
    { label: '적절하지 않는 혜택 안내',  count: 0 },
    { label: '알아듣기 어려운 설명',     count: 0 },
    { label: '문의내용 이해 못함',       count: 1 },
  ],
  /* 고객 Good 멘트 — 추후 raw 데이터 연동 예정 */
  goodComments: [
    {
      id: 1,
      date: '2026-04-12',
      comment: '친절하고 꼼꼼하게 안내해 주셔서 궁금한 점이 모두 해결됐어요. 정말 감사합니다!',
    },
    {
      id: 2,
      date: '2026-04-10',
      comment: '빠르게 처리해 주셨고 설명도 이해하기 쉬웠습니다. 덕분에 바로 해결됐어요.',
    },
    {
      id: 3,
      date: '2026-04-07',
      comment: '처음 문의했는데 끝까지 친절하게 도와주셨어요. 최고입니다!',
    },
  ],
};

function fmt(v, decimals = 1) {
  if (v == null) return '—';
  return Number(v).toFixed(decimals);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cs-sat-tooltip">
      <span className="cs-sat-tooltip-label">{label}</span>
      <span className="cs-sat-tooltip-val">{Number(payload[0]?.value).toFixed(1)}점</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 A — 당월 누적 만족도 (좌상단)
   ════════════════════════════════════════════════════════════ */
function MonthlyAccumulatedPanel({ data, year, month }) {
  const d = data ?? MOCK_DATA;
  const isAboveTarget = d.score >= d.target;
  const isRateAbove = d.achievementRate >= 100;

  return (
    <div className="cs-sat-card csm-card">

      {/* ── 헤더 ── */}
      <div className="cs-sat-card-header">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">당월 누적 만족도</span>
        </div>
        <span className="cs-sat-period-badge">{year}년 {month}월</span>
      </div>

      {/* ── KPI 3대 지표 스트립 ── */}
      <div className="csm-kpi-strip">

        {/* 목표 */}
        <div className="csm-kpi csm-kpi--target">
          <span className="csm-kpi-eyebrow">목표</span>
          <div className="csm-kpi-val">
            {fmt(d.target)}<span className="csm-kpi-unit">%</span>
          </div>
        </div>

        {/* 중앙 구분선 */}
        <div className="csm-kpi-sep" />

        {/* 만족도 점수 — 가장 크고 강조 */}
        <div className={`csm-kpi csm-kpi--score${isAboveTarget ? ' csm-kpi--score-above' : ''}`}>
          <span className="csm-kpi-eyebrow">만족도 점수</span>
          <div className="csm-kpi-val csm-kpi-val--hero">
            {fmt(d.score)}<span className="csm-kpi-unit">점</span>
          </div>
          {isAboveTarget && (
            <span className="csm-kpi-status-dot" title="목표 초과 달성" />
          )}
        </div>

        {/* 중앙 구분선 */}
        <div className="csm-kpi-sep" />

        {/* 달성률 */}
        <div className={`csm-kpi csm-kpi--rate${isRateAbove ? ' csm-kpi--rate-above' : ''}`}>
          <span className="csm-kpi-eyebrow">달성률</span>
          <div className="csm-kpi-val">
            {fmt(d.achievementRate)}<span className="csm-kpi-unit">%</span>
          </div>
          {isRateAbove && <span className="csm-rate-arrow">▲</span>}
        </div>

      </div>

      {/* ── 샘플 통계 인라인 ── */}
      <div className="csm-stat-strip">
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--total" />
          <span className="csm-stat-label">총 샘플</span>
          <span className="csm-stat-val">{d.totalSamples}<em>건</em></span>
        </div>
        <div className="csm-stat-sep" />
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--pos" />
          <span className="csm-stat-label">만족</span>
          <span className="csm-stat-val csm-stat-val--pos">{d.satisfiedCount}<em>건</em></span>
        </div>
        <div className="csm-stat-sep" />
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--neg" />
          <span className="csm-stat-label">불만족</span>
          <span className={`csm-stat-val${d.unsatisfiedCount > 0 ? ' csm-stat-val--neg' : ''}`}>
            {d.unsatisfiedCount}<em>건</em>
          </span>
        </div>
      </div>

      {/* ── 미니 추이 차트 ── */}
      <div className="csm-chart-wrap">
        <div className="csm-chart-header">
          <span className="csm-chart-title">최근 7일 만족도 추이</span>
          <div className="cs-sat-chart-legend">
            <span className="cs-sat-legend-item">
              <span className="cs-sat-legend-line" />
              누적 {d.cumulativeSamples}건
            </span>
            <span className="cs-sat-legend-item">
              <span className="cs-sat-legend-dash" />
              목표선
            </span>
          </div>
        </div>
        <div className="csm-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.weeklyTrend} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[85, 100]}
                tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine
                y={d.target}
                stroke="var(--warning)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--yp-accent-bright)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--yp-accent-bright)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--yp-accent-bright)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 C — 불만족 원인 건수 (좌하단)
   ════════════════════════════════════════════════════════════ */
function UnsatisfiedCategoriesPanel({ categories = [], year, month }) {
  const list = categories.length > 0 ? categories : MOCK_DATA.unsatisfiedCategories;
  const total = list.reduce((s, c) => s + c.count, 0);
  const maxCount = Math.max(...list.map((c) => c.count), 1);
  const isAllClear = total === 0;

  return (
    <div className="cs-sat-card cs-sat-card--unsat">

      {/* 헤더 */}
      <div className="cs-sat-card-header">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">불만족 원인 건수</span>
        </div>
        <span className="cs-sat-period-badge">{year}년 {month}월</span>
      </div>

      {/* 요약 배너 */}
      {isAllClear ? (
        <div className="cs-sat-unsat-banner cs-sat-unsat-banner--clear">
          <CheckCircle2 size={16} strokeWidth={2.2} />
          <span>이번 달 불만족 원인 없음 — 모든 항목 클리어!</span>
        </div>
      ) : (
        <div className="cs-sat-unsat-banner cs-sat-unsat-banner--alert">
          <ShieldAlert size={16} strokeWidth={2.2} />
          <span>총 <strong>{total}건</strong>의 불만족 원인이 기록되었습니다.</span>
        </div>
      )}

      {/* 카테고리 리스트 */}
      <ul className="cs-sat-ucat-list">
        {list.map((cat, idx) => {
          const barWidth = cat.count === 0 ? 0 : Math.max((cat.count / maxCount) * 100, 8);
          const hasIssue = cat.count > 0;
          return (
            <li key={cat.label} className={`cs-sat-ucat-item${hasIssue ? ' cs-sat-ucat-item--alert' : ''}`}>
              {/* 좌: 순번 + 라벨 */}
              <div className="cs-sat-ucat-left">
                <span className={`cs-sat-ucat-rank${hasIssue ? ' cs-sat-ucat-rank--alert' : ''}`}>
                  {idx + 1}
                </span>
                <span className="cs-sat-ucat-label">{cat.label}</span>
              </div>

              {/* 우: 바 + 건수 */}
              <div className="cs-sat-ucat-right">
                <div className="cs-sat-ucat-bar-track">
                  <div
                    className={`cs-sat-ucat-bar-fill${hasIssue ? ' cs-sat-ucat-bar-fill--alert' : ''}`}
                    style={{ width: hasIssue ? `${barWidth}%` : '0%' }}
                  />
                </div>
                <span className={`cs-sat-ucat-count${hasIssue ? ' cs-sat-ucat-count--alert' : ''}`}>
                  {hasIssue ? (
                    <>{cat.count}<em>건</em></>
                  ) : (
                    <CheckCircle2 size={14} strokeWidth={2.2} className="cs-sat-ucat-clear-icon" />
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 하단 메모 */}
      <p className="cs-sat-ucat-footnote">
        * 고객이 선택한 불만족 원인 유형별 집계입니다.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 B — Good 멘트 사례 (우상단) ← 신규
   ════════════════════════════════════════════════════════════ */
function GoodCommentsPanel({ comments = [] }) {
  const list = comments.length > 0 ? comments : MOCK_DATA.goodComments;

  return (
    <div className="cs-sat-card cs-sat-card--good">

      {/* 헤더 */}
      <div className="cs-sat-card-header">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">Good 멘트 사례</span>
        </div>
        <span className="cs-sat-good-count-badge">
          <ThumbsUp size={11} strokeWidth={2.2} />
          {list.length}건
        </span>
      </div>

      {/* 안내 문구 */}
      <div className="cs-sat-good-desc">
        <Sparkles size={13} strokeWidth={2} className="cs-sat-good-desc-icon" />
        <span>고객이 직접 남긴 긍정 평가 멘트입니다. 추후 raw 데이터와 자동 연동됩니다.</span>
      </div>

      {/* 멘트 카드 목록 */}
      <ul className="cs-sat-good-list">
        {list.map((item, idx) => (
          <li key={item.id ?? idx} className="cs-sat-good-item">
            {/* 데코 따옴표 */}
            <span className="cs-sat-good-quote-mark" aria-hidden="true">"</span>
            <div className="cs-sat-good-content">
              <p className="cs-sat-good-text">{item.comment}</p>
              <div className="cs-sat-good-footer">
                <span className="cs-sat-good-date">
                  <CalendarDays size={11} strokeWidth={2} />
                  {formatDate(item.date)}
                </span>
                <span className="cs-sat-good-like-icon">
                  <ThumbsUp size={11} strokeWidth={2} />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 하단 안내 */}
      <div className="cs-sat-good-notice">
        실제 고객 원문 데이터가 연동되면 자동으로 업데이트됩니다.
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AI Insight 데이터 헬퍼
   ════════════════════════════════════════════════════════════ */
const FEEDBACK_MAP = {
  '서비스 지식부족':         '최신 상품 정보를 주기적으로 학습하고 FAQ를 미리 숙지하세요.',
  '성의 없는 태도':          '공감 표현("잘 이해했습니다")을 적극 활용해 보세요.',
  '적절하지 않는 혜택 안내': '상담 전 고객 이용 내역을 확인 후 맞춤 옵션을 제안하세요.',
  '알아듣기 어려운 설명':    '전문 용어 대신 쉬운 표현으로 단계별 설명을 시도하세요.',
  '문의내용 이해 못함':      '"말씀하신 내용이 ~이 맞나요?" 재확인으로 오해를 예방하세요.',
};

function buildFeed(categories = [], score = 0, achievementRate = 0, totalSamples = 0) {
  const unsatTotal = categories.reduce((s, c) => s + c.count, 0);
  const issues     = categories.filter((c) => c.count > 0);
  const diffPp     = (achievementRate - 100).toFixed(1);
  const isOver     = achievementRate >= 100;

  return [
    /* 1. 달성 현황 */
    {
      type:  isOver ? 'success' : 'warning',
      tag:   isOver ? '달성 초과' : '목표 미달',
      body:  isOver
        ? `${totalSamples}건 중 ${score.toFixed(1)}점 · 목표 +${diffPp}%p 초과 달성`
        : `${score.toFixed(1)}점 · 목표 달성률 ${achievementRate.toFixed(1)}% (미달)`,
    },
    /* 2. 개선 포인트 */
    unsatTotal === 0
      ? { type: 'success', tag: '개선 포인트', body: '불만족 원인 0건 · 모든 항목 클리어' }
      : {
          type: 'warning',
          tag:  '개선 포인트',
          body: issues.map((c) => `"${c.label}" ${c.count}건 — ${FEEDBACK_MAP[c.label] ?? '상담 방식 검토 권장'}`).join(' / '),
        },
    /* 3. 품질 팁 */
    {
      type: 'tip',
      tag:  '품질 팁',
      body: '마무리 멘트("추가 도움이 필요하신가요?") 활용 시 만족도 +2~3점 향상',
    },
    /* 4. 추이 */
    {
      type: 'trend',
      tag:  '추이 분석',
      body: '최근 7일 꾸준한 상승세 · 현재 상담 방식 유지 권장',
    },
  ];
}

const FEED_STYLE = {
  success: { color: '#059669', chipBg: 'rgba(16, 185, 129, 0.1)',  icon: CircleCheck   },
  warning: { color: '#b45309', chipBg: 'rgba(245, 158, 11, 0.12)', icon: TriangleAlert },
  tip:     { color: '#6d28d9', chipBg: 'rgba(109, 40, 217, 0.1)',  icon: Lightbulb     },
  trend:   { color: '#0369a1', chipBg: 'rgba(3, 105, 161, 0.1)',   icon: TrendingUp    },
};

/* ════════════════════════════════════════════════════════════
   패널 B — AI Insight (우상단)
   ════════════════════════════════════════════════════════════ */
function AiInsightPanel({ data }) {
  const d      = data ?? MOCK_DATA;
  const feed   = buildFeed(d.unsatisfiedCategories, d.score, d.achievementRate, d.totalSamples);
  const isOver = d.achievementRate >= 100;
  const delta  = Math.abs(d.achievementRate - 100).toFixed(1);
  const generatedAt = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

  return (
    <div className="cs-sat-card ai-card">

      {/* ── 헤더 ── */}
      <div className="ai-header">
        <div className="ai-title-wrap">
          <div className="ai-icon-badge">
            <Sparkles size={13} strokeWidth={2} />
          </div>
          <span className="ai-title">AI Insight</span>
        </div>
        <div className="ai-meta">
          <RefreshCw size={9} strokeWidth={2.5} />
          <span>{generatedAt} 기준</span>
        </div>
      </div>

      {/* ── 요약 바 ── */}
      <div className={`ai-summary-bar${isOver ? ' ai-summary-bar--over' : ' ai-summary-bar--under'}`}>
        <span className="ai-sum-status">{isOver ? '✓ 목표 초과' : '⚠ 목표 미달'}</span>
        <span className="ai-sum-divider" />
        <span className="ai-sum-score">{d.score.toFixed(1)}<em>점</em></span>
        <span className="ai-sum-divider" />
        <span className="ai-sum-rate">{isOver ? '+' : '-'}{delta}%p</span>
        <span className="ai-sum-sample">{d.totalSamples}건 분석</span>
      </div>

      {/* ── Insight 피드 ── */}
      <ul className="ai-feed-list">
        {feed.map((item, idx) => {
          const s = FEED_STYLE[item.type] ?? FEED_STYLE.tip;
          const Icon = s.icon;
          return (
            <li
              key={idx}
              className="ai-feed-item"
              style={{ '--chip-color': s.color, '--chip-bg': s.chipBg }}
            >
              <div className="ai-feed-icon-chip">
                <Icon size={11} strokeWidth={2.5} />
              </div>
              <div className="ai-feed-content">
                <span className="ai-feed-label">{item.tag}</span>
                <p className="ai-feed-body">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="ai-disclaimer">* AI 분석 결과이며 참고용입니다.</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   메인 페이지
   ════════════════════════════════════════════════════════════ */
export default function CsSatisfactionPage() {
  const { user } = useAuthStore();
  const [year] = useState(currentYear);
  const [month] = useState(currentMonth);

  const { data, isError } = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = isError || !data ? MOCK_DATA : data;

  return (
    <div className="page-container cs-sat-page adm-dashboard--yp fade-in">

      <header className="adm-header adm-header--yp cs-sat-page-header">
        <div className="adm-header-text">
          <h1 className="adm-title">만족도</h1>
          <p className="adm-sub">나의 CS 만족도 현황과 추이를 한눈에 확인하세요.</p>
        </div>
      </header>

      <div className="cs-sat-grid">
        {/* 좌상단: 당월 누적 만족도 */}
        <MonthlyAccumulatedPanel data={satData} year={year} month={month} />

        {/* 우상단: AI Insight */}
        <AiInsightPanel data={satData} />

        {/* 좌하단: 불만족 원인 건수 */}
        <UnsatisfiedCategoriesPanel
          categories={satData?.unsatisfiedCategories}
          year={year}
          month={month}
        />

        {/* 우하단: Good 멘트 사례 */}
        <GoodCommentsPanel comments={satData?.goodComments} />
      </div>
    </div>
  );
}
