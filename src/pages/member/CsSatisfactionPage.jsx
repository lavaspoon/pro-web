import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  TrendingUp,
  Lightbulb,
  X,
  Loader2,
  MessageSquareText,
  Target,
  BarChart2,
  ClipboardCheck,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import {
  fetchMemberSatisfaction,
  fetchMemberFocusTasks,
  fetchMemberUnsatisfiedDetails,
} from '../../api/memberApi';
import { getBusinessDaysInMonth } from '../../utils/krBusinessCalendar';
import '../admin/DashboardPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

/** 만족도(%) 추이 차트에 표시할 최근 영업일 수(날짜 오름차순 중 마지막 N개, 접수 0일·연차 포함) */
const SATISFACTION_TREND_CHART_DAYS = 7;

/** 로컬 달력 기준 오늘 이전·당일만 true (차트에 미래 일자 미표시) */
function isCalendarDayOnOrBeforeToday(y, m, d) {
  const t = new Date();
  const ty = t.getFullYear();
  const tm = t.getMonth() + 1;
  const td = t.getDate();
  if (y < ty) return true;
  if (y > ty) return false;
  if (m < tm) return true;
  if (m > tm) return false;
  return d <= td;
}

/** API 미연동 시 일별 mock (접수 0인 날은 연차 등으로 간주) */
function buildMockDailyTrend(year, month) {
  const biz = getBusinessDaysInMonth(year, month).filter((b) =>
    isCalendarDayOnOrBeforeToday(year, month, b.day),
  );
  return biz.map((b, i) => {
    if (i % 5 === 2) {
      return { day: `${month}/${b.day}`, satisfiedCount: 0, receivedCount: 0 };
    }
    const recv = 1 + (i % 4);
    const sat = Math.max(0, recv - (i % 2));
    return { day: `${month}/${b.day}`, satisfiedCount: sat, receivedCount: recv };
  });
}

/* ── mock 데이터 ──────────────────────────────────────────── */
const MOCK_DATA = {
  /** 관리자 화면에서 설정한 당월 해당 구성원 스킬 목표 % */
  monthlyTargetPct: 94.9,
  /** 차트 목표선·호환용 (monthlyTargetPct 와 동일 권장) */
  target: 94.9,
  /** 엑셀 업로드 접수 건수(해당 구성원 ID) — 실적 분모 */
  receivedCount: 47,
  score: 99.2,
  totalSamples: 47,
  satisfiedCount: 46,
  unsatisfiedCount: 1,
  cumulativeSamples: 47,
  unsatisfiedCategories: [
    { label: '서비스 지식부족', dissatisfactionType: 1, count: 0 },
    { label: '성의 없는 태도', dissatisfactionType: 2, count: 0 },
    { label: '적절하지 않는 혜택 안내', dissatisfactionType: 3, count: 0 },
    { label: '알아듣기 어려운 설명', dissatisfactionType: 4, count: 0 },
    { label: '문의내용 이해 못함', dissatisfactionType: 5, count: 1 },
  ],
  /** API 미연동 시 상세 모달 예시 (유형 코드 → 레코드 배열) */
  unsatisfiedDetailSamples: {
    5: [
      {
        id: 9001,
        evalDate: '2026-04-10',
        consultTime: '143052',
        subsidiaryType: '자회사A',
        centerName: '서부',
        groupName: '고객응대',
        roomName: '1실',
        consultType1: '요금',
        consultType2: '변경',
        consultType3: '해지',
        skill: '일반',
        satisfiedYn: 'N',
        goodMent: null,
        badMent: '설명이 길어 처음 의도를 파악하지 못했습니다.',
        fiveMajorCitiesYn: 'N',
        gen5060Yn: 'Y',
        problemResolvedYn: 'Y',
      },
    ],
  },
  /* 고객 Good 멘트 — 추후 raw 데이터 연동 예정 */
  fiveMajorCitiesCount: 4,
  gen5060Count: 6,
  problemResolvedCount: 3,
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

/** 당월 실적 % = (만족 Y 건 / 접수 건) × 100 */
function computeMonthlyActualPct(d) {
  const recv = Number(d.receivedCount ?? d.totalSamples ?? 0);
  const sat = Number(d.satisfiedCount ?? 0);
  if (!Number.isFinite(recv) || recv <= 0) return null;
  return (sat / recv) * 100;
}

/** 당월 달성율 % = 목표 대비 (실적 ÷ 목표) × 100, 소수 첫째 자리 */
function computeMonthlyAchievementVsTargetPct(d) {
  const tgt = Number(d.monthlyTargetPct ?? d.target ?? 0);
  const act = computeMonthlyActualPct(d);
  if (!Number.isFinite(tgt) || tgt <= 0 || act == null) return null;
  return (act / tgt) * 100;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatCsEvalDate(iso) {
  if (iso == null) return '—';
  if (Array.isArray(iso) && iso.length >= 3) {
    const [y, m, d] = iso;
    return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  }
  const s = typeof iso === 'string' ? iso.slice(0, 10) : String(iso);
  const parts = s.split('-');
  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return s;
}

function ynLabel(yn) {
  if (yn == null || yn === '') return '—';
  const u = String(yn).trim().toUpperCase();
  if (u === 'Y') return 'Y';
  if (u === 'N') return 'N';
  return String(yn);
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const sat = row?.satisfiedCount;
  const recv = row?.receivedCount;
  const excluded = row?.trendExcluded;
  const val = payload[0]?.value;
  const hasPct = val != null && !Number.isNaN(Number(val)) && !excluded;
  return (
    <div className="cs-sat-tooltip">
      <span className="cs-sat-tooltip-label">{label}</span>
      <span className="cs-sat-tooltip-val">{hasPct ? `${Number(val).toFixed(1)}%` : '—'}</span>
      {excluded ? (
        <span className="cs-sat-tooltip-meta">접수 0건</span>
      ) : recv != null && sat != null ? (
        <span className="cs-sat-tooltip-meta">
          만족 {sat}건 / 접수 {recv}건
        </span>
      ) : null}
    </div>
  );
}

/** "4/8" 형태 라벨 파싱 */
function parseTrendDayLabel(s) {
  if (s == null || s === '') return null;
  const str = String(s).trim();
  const parts = str.split('/');
  if (parts.length < 2) return null;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { month: m, day: d };
}

/** 연차(접수 0) 구간: 선만 이어 보이게 이전·이후 실측 %로 채움. trendExcluded는 점·툴팁 %용. */
function fillTrendLineCarryContinuity(points) {
  const out = points.map((p) => ({ ...p }));
  let last = null;
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i].trendExcluded) {
      last = out[i].satisfactionPct;
    } else if (last != null) {
      out[i].satisfactionPct = last;
    }
  }
  let next = null;
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (!out[i].trendExcluded) {
      next = out[i].satisfactionPct;
    } else if (out[i].trendExcluded && out[i].satisfactionPct == null && next != null) {
      out[i].satisfactionPct = next;
    }
  }
  return out;
}

/** 일자별 만족건·접수건 → 만족도% = (만족/접수)×100. 접수 0(연차)은 실적 제외이나 차트 선은 끊지 않음(점만 생략). 영업일만, 미래 일 제외. 최근 SATISFACTION_TREND_CHART_DAYS영업일만. */
function buildMonthlySatisfactionPctTrend(data, year, month) {
  const biz = getBusinessDaysInMonth(year, month).filter((b) =>
    isCalendarDayOnOrBeforeToday(year, month, b.day),
  );
  if (biz.length === 0) return [];
  const bizDaySet = new Set(biz.map((b) => b.day));
  const wdByDay = new Map(biz.map((b) => [b.day, b.weekdayShort]));

  const daily = data.dailyTrend;
  if (!Array.isArray(daily) || daily.length === 0) return [];

  const points = [];
  for (const row of daily) {
    const p = parseTrendDayLabel(row.day ?? row.dateLabel);
    if (!p || p.month !== month || !bizDaySet.has(p.day)) continue;
    if (!isCalendarDayOnOrBeforeToday(year, month, p.day)) continue;

    const recv = Number(row.receivedCount ?? row.received ?? 0);
    if (!Number.isFinite(recv) || recv < 0) continue;

    const sat = Number(row.satisfiedCount ?? row.satisfied ?? 0);
    if (!Number.isFinite(sat) || sat < 0) continue;

    const wd = wdByDay.get(p.day);
    const dayStr = `${month}/${p.day}`;
    const labelBase = wd ? `${dayStr}(${wd})` : dayStr;

    if (recv > 0) {
      const pct = (sat / recv) * 100;
      points.push({
        day: dayStr,
        dayWithWeekday: labelBase,
        satisfactionPct: Math.round(pct * 10) / 10,
        weekdayShort: wd,
        satisfiedCount: sat,
        receivedCount: recv,
        trendExcluded: false,
      });
    } else {
      points.push({
        day: dayStr,
        dayWithWeekday: labelBase,
        satisfactionPct: null,
        weekdayShort: wd,
        satisfiedCount: 0,
        receivedCount: 0,
        trendExcluded: true,
      });
    }
  }

  points.sort((a, b) => {
    const pa = parseTrendDayLabel(a.day);
    const pb = parseTrendDayLabel(b.day);
    return (pa?.day ?? 0) - (pb?.day ?? 0);
  });
  const carried = fillTrendLineCarryContinuity(points);
  return carried.slice(-SATISFACTION_TREND_CHART_DAYS);
}

/* ════════════════════════════════════════════════════════════
   상단 4지표 — 게이지 없이 숫자·라벨 중심
   ════════════════════════════════════════════════════════════ */
function CsSatisfactionKpiRow({ data, year, month }) {
  const d = data ?? MOCK_DATA;
  const monthlyTarget = Number(d.monthlyTargetPct ?? d.target ?? 0);
  const actualPct = computeMonthlyActualPct(d);
  const achievementVsTarget = computeMonthlyAchievementVsTargetPct(d);
  const rate = achievementVsTarget != null ? Number(achievementVsTarget) : 0;
  const achievementBand =
    rate >= 100 ? 'met' : rate >= 90 ? 'near' : 'below';

  const rateIcoClass =
    achievementBand === 'met'
      ? 'yp-kpi-ico--green'
      : achievementBand === 'near'
        ? 'yp-kpi-ico--blue'
        : '';

  const monthlyRecv = Number(d.receivedCount ?? d.totalSamples ?? 0);
  const monthlySat = Number(d.satisfiedCount ?? 0);

  return (
    <div className="yp-kpi-row yp-kpi-row--4" aria-label="당월 핵심 지표">
      <div className="yp-kpi-card yp-kpi-card--data">
        <div className="yp-kpi-head">
          <span className="yp-kpi-label">당월 목표</span>
          <div className="yp-kpi-ico yp-kpi-ico--amber" aria-hidden>
            <Target size={18} strokeWidth={2} />
          </div>
        </div>
        <div className="yp-kpi-values">
          <span className="yp-kpi-big">{fmt(monthlyTarget)}</span>
          <span className="yp-kpi-unit">%</span>
        </div>
      </div>

      <div className="yp-kpi-card yp-kpi-card--monthly">
        <div className="yp-kpi-head">
          <span className="yp-kpi-label">당월 실적</span>
          <div className="yp-kpi-ico yp-kpi-ico--blue" aria-hidden>
            <BarChart2 size={18} strokeWidth={2} />
          </div>
        </div>
        <div className="yp-kpi-values">
          <span className="yp-kpi-big">{actualPct != null ? fmt(actualPct) : '—'}</span>
          <span className="yp-kpi-unit">%</span>
        </div>
        <div className="yp-kpi-monthly-detail" aria-label="당월 만족 및 접수 건수">
          당월 만족 <span className="yp-kpi-monthly-detail-num">{monthlySat}</span>건 / 당월 접수{' '}
          <span className="yp-kpi-monthly-detail-num">{monthlyRecv}</span>건
        </div>
      </div>

      <div
        className={`yp-kpi-card yp-kpi-card--cert cs-sat-kpi-achievement cs-sat-kpi-rate cs-sat-kpi-rate--${achievementBand}`}
      >
        <div className="yp-kpi-head">
          <span className="yp-kpi-label">당월 달성율</span>
          <div className={`yp-kpi-ico cs-sat-kpi-achievement-ico ${rateIcoClass}`.trim()} aria-hidden>
            <TrendingUp size={20} strokeWidth={2.25} />
          </div>
        </div>
        <div className="yp-kpi-values">
          <span className="yp-kpi-big">{achievementVsTarget != null ? fmt(achievementVsTarget) : '—'}</span>
          <span className="yp-kpi-unit">%</span>
        </div>
      </div>

      <div className="yp-kpi-card yp-kpi-card--rank">
        <div className="yp-kpi-head">
          <span className="yp-kpi-label">중점추진과제</span>
          <div className="yp-kpi-ico yp-kpi-ico--violet" aria-hidden>
            <ClipboardCheck size={18} strokeWidth={2} />
          </div>
        </div>
        <div className="cs-sat-kpi-focus-grid" role="list">
          <div className="cs-sat-kpi-focus-cell" role="listitem">
            <span className="cs-sat-kpi-focus-cell-label">5대도시</span>
            <span className="cs-sat-kpi-focus-cell-num">
              <strong>{Number(d.fiveMajorCitiesCount ?? 0)}</strong>
              <span className="cs-sat-kpi-focus-cell-unit">건</span>
            </span>
          </div>
          <div className="cs-sat-kpi-focus-cell" role="listitem">
            <span className="cs-sat-kpi-focus-cell-label">5060</span>
            <span className="cs-sat-kpi-focus-cell-num">
              <strong>{Number(d.gen5060Count ?? 0)}</strong>
              <span className="cs-sat-kpi-focus-cell-unit">건</span>
            </span>
          </div>
          <div className="cs-sat-kpi-focus-cell" role="listitem">
            <span className="cs-sat-kpi-focus-cell-label">문제해결</span>
            <span className="cs-sat-kpi-focus-cell-num">
              <strong>{Number(d.problemResolvedCount ?? 0)}</strong>
              <span className="cs-sat-kpi-focus-cell-unit">건</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 A — 당월 누적 만족도 (좌측 메인) · 샘플·차트·불만족
   ════════════════════════════════════════════════════════════ */
function MonthlyAccumulatedPanel({ data, year, month, children }) {
  const d = data ?? MOCK_DATA;
  const satisfactionPctTrend = useMemo(
    () => buildMonthlySatisfactionPctTrend(d, year, month),
    [d, year, month],
  );
  const plottedDayCount = satisfactionPctTrend.length;
  /** 이달 전체 영업일 수(미래 포함) — 주말·공휴일만 제외 */
  const monthBizDayCount = useMemo(
    () => getBusinessDaysInMonth(year, month).length,
    [year, month],
  );

  return (
    <div className="cs-sat-card csm-card cs-sat-monthly-compact">

      {/* ── 헤더 ── */}
      <div className="cs-sat-card-header">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">당월 누적 만족도</span>
        </div>
        <span className="cs-sat-period-badge">{year}년 {month}월</span>
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

      {/* ── 만족도(%) 추이 (연차일은 선만 이어지고 점은 생략) ── */}
      <div className="csm-chart-wrap csm-chart-wrap--bizdays">
        <div className="csm-chart-header">
          <span className="csm-chart-title">만족도(%) 추이</span>
          <div className="cs-sat-chart-legend">
            <span className="cs-sat-legend-item cs-sat-legend-item--biz">
              이달 영업일 <strong>{monthBizDayCount}</strong>일
            </span>
            <span className="cs-sat-legend-item">
              <span className="cs-sat-legend-dash" />
              목표선
            </span>
          </div>
        </div>
        <div className="csm-chart-body csm-chart-body--bizdays">
          {plottedDayCount === 0 ? (
            <p className="cs-sat-chart-empty">접수가 있는 영업일이 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={satisfactionPctTrend}
                margin={{ top: 6, right: 8, bottom: 30, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis
                  dataKey="dayWithWeekday"
                  interval={0}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'var(--text-secondary)',
                    letterSpacing: '-0.02em',
                  }}
                  tickLine={false}
                  axisLine={false}
                  angle={-38}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  domain={[85, 100]}
                  tick={{
                    fontSize: 11,
                    fontWeight: 700,
                    fill: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => `${v}%`}
                  ticks={[85, 90, 95, 100]}
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
                  dataKey="satisfactionPct"
                  name="만족도"
                  stroke="var(--yp-accent-bright)"
                  strokeWidth={2}
                  dot={(dotProps) => {
                    if (dotProps.payload?.trendExcluded) return null;
                    const r = plottedDayCount > 18 ? 2 : 2.5;
                    return (
                      <circle
                        cx={dotProps.cx}
                        cy={dotProps.cy}
                        r={r}
                        fill="var(--yp-accent-bright)"
                        strokeWidth={0}
                      />
                    );
                  }}
                  activeDot={(adProps) =>
                    adProps.payload?.trendExcluded ? null : (
                      <circle cx={adProps.cx} cy={adProps.cy} r={4} fill="var(--yp-accent-bright)" />
                    )
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {children}

    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 C — 불만족 원인 건수 (좌하단)
   ════════════════════════════════════════════════════════════ */
function UnsatisfiedCategoriesPanel({
  categories = [],
  year,
  month,
  skid,
  detailFallbackByType = MOCK_DATA.unsatisfiedDetailSamples,
  embedded = false,
}) {
  const list = categories.length > 0 ? categories : MOCK_DATA.unsatisfiedCategories;
  const total = list.reduce((s, c) => s + c.count, 0);
  const maxCount = Math.max(...list.map((c) => c.count), 1);
  const isAllClear = total === 0;

  const [selected, setSelected] = useState(null);

  const { data: detailRes, isLoading, isError } = useQuery({
    queryKey: ['member-unsat-detail', skid, year, month, selected?.dissatisfactionType],
    queryFn: () =>
      fetchMemberUnsatisfiedDetails({
        skid,
        year,
        month,
        dissatisfactionType: selected.dissatisfactionType,
      }),
    enabled: !!skid && !!selected,
    retry: false,
  });

  const detailRecords = useMemo(() => {
    if (!selected) return [];
    if (isError) {
      const fb = detailFallbackByType?.[selected.dissatisfactionType];
      return Array.isArray(fb) ? fb : [];
    }
    const fromApi = detailRes?.records;
    return Array.isArray(fromApi) ? fromApi : [];
  }, [detailRes, isError, selected, detailFallbackByType]);

  const showFallbackHint = Boolean(selected && isError && detailRecords.length > 0);
  const showLoadError = Boolean(selected && isError && detailRecords.length === 0 && !isLoading);

  useEffect(() => {
    if (!selected) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const headerBlock = embedded ? (
    <div className="cs-sat-ucat-embed-head">
      <span className="cs-sat-ucat-embed-title">불만족 원인 건수</span>
    </div>
  ) : (
    <div className="cs-sat-card-header">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <span className="section-title">불만족 원인 건수</span>
      </div>
      <span className="cs-sat-period-badge">{year}년 {month}월</span>
    </div>
  );

  const body = (
    <>
      {headerBlock}

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
          const dissType = cat.dissatisfactionType ?? idx + 1;
          return (
            <li
              key={cat.label}
              className={`cs-sat-ucat-item${hasIssue ? ' cs-sat-ucat-item--alert cs-sat-ucat-item--clickable' : ''}`}
            >
              <button
                type="button"
                className="cs-sat-ucat-row-btn"
                disabled={!hasIssue || !skid}
                onClick={() => {
                  if (!hasIssue || !skid) return;
                  setSelected({ dissatisfactionType: dissType, label: cat.label });
                }}
                aria-label={hasIssue ? `${cat.label} 상세 보기` : undefined}
              >
                <div className="cs-sat-ucat-left">
                  <span className={`cs-sat-ucat-rank${hasIssue ? ' cs-sat-ucat-rank--alert' : ''}`}>
                    {idx + 1}
                  </span>
                  <span className="cs-sat-ucat-label">{cat.label}</span>
                </div>
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
              </button>
            </li>
          );
        })}
      </ul>

      <p className="cs-sat-ucat-footnote">
        * 건수가 있는 항목을 누르면 해당 상담 상세를 볼 수 있습니다.
      </p>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="cs-sat-ucat-embedded">{body}</div>
      ) : (
        <div className="cs-sat-card cs-sat-card--unsat">{body}</div>
      )}

      {selected && createPortal(
        <div
          className="cs-ucat-detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cs-ucat-detail-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="cs-ucat-detail-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cs-ucat-detail-head">
              <div>
                <h2 id="cs-ucat-detail-title" className="cs-ucat-detail-title">
                  {selected.label}
                </h2>
                <p className="cs-ucat-detail-sub">
                  {year}년 {month}월 · 유형 코드 {selected.dissatisfactionType}
                </p>
              </div>
              <button
                type="button"
                className="cs-ucat-detail-close"
                onClick={() => setSelected(null)}
                aria-label="닫기"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            {showFallbackHint && (
              <p className="cs-ucat-detail-fallback-hint">API 연결 전 예시 데이터입니다.</p>
            )}

            {isLoading && (
              <div className="cs-ucat-detail-loading">
                <Loader2 className="cs-ucat-detail-spin" size={22} />
                <span>불러오는 중…</span>
              </div>
            )}

            {showLoadError && (
              <p className="cs-ucat-detail-empty cs-ucat-detail-empty--error">
                상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
              </p>
            )}

            {!isLoading && !showLoadError && detailRecords.length === 0 && (
              <p className="cs-ucat-detail-empty">해당 유형의 상세 상담 기록이 없습니다.</p>
            )}

            {!isLoading && !showLoadError && detailRecords.length > 0 && (
              <ul className="cs-ucat-detail-list">
                {detailRecords.map((rec, ridx) => (
                  <li key={rec.id != null ? String(rec.id) : `rec-${ridx}`} className="cs-ucat-detail-card">
                    <div className="cs-ucat-detail-card-head">
                      <span className="cs-ucat-detail-date">
                        <CalendarDays size={14} strokeWidth={2} aria-hidden />
                        {formatCsEvalDate(rec.evalDate)}
                        {rec.consultTime ? (
                          <span className="cs-ucat-detail-time"> · {rec.consultTime}</span>
                        ) : null}
                      </span>
                      <span
                        className={`cs-ucat-detail-sat-badge${
                          String(rec.satisfiedYn).toUpperCase() === 'N'
                            ? ' cs-ucat-detail-sat-badge--neg'
                            : ''
                        }`}
                      >
                        만족 {ynLabel(rec.satisfiedYn)}
                      </span>
                    </div>

                    <dl className="cs-ucat-detail-dl">
                      {rec.subsidiaryType && (
                        <>
                          <dt>자회사</dt>
                          <dd>{rec.subsidiaryType}</dd>
                        </>
                      )}
                      <dt>센터</dt>
                      <dd>{rec.centerName || '—'}</dd>
                      <dt>그룹</dt>
                      <dd>{rec.groupName || '—'}</dd>
                      <dt>실</dt>
                      <dd>{rec.roomName || '—'}</dd>
                      <dt>상담유형</dt>
                      <dd>
                        {[rec.consultType1, rec.consultType2, rec.consultType3]
                          .filter(Boolean)
                          .join(' › ') || '—'}
                      </dd>
                      <dt>스킬</dt>
                      <dd>{rec.skill || '—'}</dd>
                      <dt>중점과제</dt>
                      <dd className="cs-ucat-detail-yn-row">
                        <span>5대도시 {ynLabel(rec.fiveMajorCitiesYn)}</span>
                        <span>5060 {ynLabel(rec.gen5060Yn)}</span>
                        <span>문제해결 {ynLabel(rec.problemResolvedYn)}</span>
                      </dd>
                    </dl>

                    {(rec.goodMent || rec.badMent) && (
                      <div className="cs-ucat-detail-ments">
                        {rec.goodMent ? (
                          <div className="cs-ucat-detail-ment cs-ucat-detail-ment--pos">
                            <MessageSquareText size={14} strokeWidth={2} aria-hidden />
                            <div>
                              <span className="cs-ucat-detail-ment-label">긍정 코멘트</span>
                              <p>{rec.goodMent}</p>
                            </div>
                          </div>
                        ) : null}
                        {rec.badMent ? (
                          <div className="cs-ucat-detail-ment cs-ucat-detail-ment--neg">
                            <MessageSquareText size={14} strokeWidth={2} aria-hidden />
                            <div>
                              <span className="cs-ucat-detail-ment-label">부정 코멘트</span>
                              <p>{rec.badMent}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
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

const AI_INSIGHT_ICONS = {
  improve: ClipboardCheck,
  tip: Lightbulb,
  trend: TrendingUp,
};

function buildFeed(categories = []) {
  const unsatTotal = categories.reduce((s, c) => s + c.count, 0);
  const issues = categories.filter((c) => c.count > 0);

  const improveBullets =
    unsatTotal === 0
      ? null
      : issues.map((c, idx) => ({
          key: `${c.label}-${idx}`,
          label: c.label,
          count: c.count,
          hint: FEEDBACK_MAP[c.label] ?? '한 번 상담 흐름을 점검해 보시면 어떨까요?',
        }));

  return [
    {
      kind: 'improve',
      tag: '개선 포인트',
      bullets: improveBullets,
      bodyFallback: '불만족으로 잡힌 원인이 없어요. 지금 흐름 그대로 가도 좋아 보여요.',
    },
    {
      kind: 'tip',
      tag: '품질 팁',
      paragraphs: [
        '마무리할 때 이렇게 한마디만 더해도 좋아요.',
        '「추가로 도움이 필요하신가요?」 같은 문장이 만족도에 +2~3점 정도 기여한다는 사례가 많아요.',
      ],
    },
    {
      kind: 'trend',
      tag: '추이',
      paragraphs: [
        '최근 일주일 보면 점수가 꾸준히 올라가고 있어요.',
        '지금 상담 습관을 유지하는 게 가장 안전해 보여요.',
      ],
    },
  ];
}

/* ════════════════════════════════════════════════════════════
   패널 B — 인사이트 (우상단)
   ════════════════════════════════════════════════════════════ */
function AiInsightPanel({ data }) {
  const d = data ?? MOCK_DATA;
  const feed = buildFeed(d.unsatisfiedCategories);
  const goodList =
    Array.isArray(d.goodComments) && d.goodComments.length > 0
      ? d.goodComments
      : MOCK_DATA.goodComments;

  return (
    <div className="cs-sat-card ai-card ai-card--hero ai-card--insight-good">

      <div className="ai-hero-top ai-hero-top--insight-only">
        <div className="ai-hero-title-block">
          <span className="ai-hero-icon" aria-hidden>
            <Sparkles size={18} strokeWidth={1.85} />
          </span>
          <h2 className="ai-hero-title">AI 인사이트</h2>
        </div>
      </div>

      <div className="cs-sat-ai-insight-block" aria-label="AI 인사이트 요약">
        <p className="cs-sat-ai-insight-lead">
          <Sparkles size={11} strokeWidth={2} className="cs-sat-ai-insight-lead-ico" aria-hidden />
          이번 달 데이터를 바탕으로 한 요약이에요.
        </p>
        <ul className="cs-sat-ai-insight-list">
          {feed.map((item) => {
            const Ico = AI_INSIGHT_ICONS[item.kind] ?? Sparkles;
            return (
              <li
                key={item.tag}
                className={`cs-sat-ai-insight-item cs-sat-ai-insight-item--${item.kind}`}
              >
                <div className="cs-sat-ai-insight-item-head">
                  <span className="cs-sat-ai-insight-item-ico" aria-hidden>
                    <Ico size={14} strokeWidth={2.1} />
                  </span>
                  <span className="cs-sat-ai-insight-item-title">{item.tag}</span>
                </div>
                {item.kind === 'improve' && item.bullets?.length ? (
                  <ul className="cs-sat-ai-insight-bullets">
                    {item.bullets.map((b) => (
                      <li key={b.key} className="cs-sat-ai-insight-bullet">
                        <span className="cs-sat-ai-insight-bullet-title">
                          {b.label} <em>{b.count}건</em>
                        </span>
                        <p className="cs-sat-ai-insight-bullet-hint">{b.hint}</p>
                      </li>
                    ))}
                  </ul>
                ) : item.kind === 'improve' ? (
                  <p className="cs-sat-ai-insight-body cs-sat-ai-insight-body--single">{item.bodyFallback}</p>
                ) : (
                  <div className="cs-sat-ai-insight-body-stack">
                    {item.paragraphs.map((para, i) => (
                      <p key={i} className="cs-sat-ai-insight-body">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="cs-sat-monthly-good cs-sat-monthly-good--in-ai" aria-label="Good 멘트 사례">
        <div className="cs-sat-monthly-good-head">
          <span className="cs-sat-monthly-good-icon-wrap" aria-hidden>
            <ThumbsUp size={16} strokeWidth={2.2} />
          </span>
          <span className="cs-sat-monthly-good-title">Good 멘트 사례</span>
          <span className="cs-sat-monthly-good-badge">{goodList.length}건</span>
        </div>
        <p className="cs-sat-monthly-good-lead">
          <Sparkles size={12} strokeWidth={2} className="cs-sat-monthly-good-lead-ico" aria-hidden />
          고객이 남긴 긍정 평가 멘트입니다.
        </p>
        <ul className="cs-sat-monthly-good-list">
          {goodList.map((item, idx) => (
            <li key={item.id ?? idx} className="cs-sat-monthly-good-item">
              <span className="cs-sat-monthly-good-quote" aria-hidden>
                {'\u201c'}
              </span>
              <div className="cs-sat-monthly-good-body">
                <p className="cs-sat-monthly-good-text">{item.comment}</p>
                <span className="cs-sat-monthly-good-date">
                  <CalendarDays size={11} strokeWidth={2} aria-hidden />
                  {formatDate(item.date)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
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

  const { data: satRaw, isError } = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const { data: focusRaw } = useQuery({
    queryKey: ['member-focus-tasks', user?.skid, year, month],
    queryFn: () => fetchMemberFocusTasks({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = useMemo(() => {
    const isMock = isError || !satRaw;
    const base = isMock ? { ...MOCK_DATA } : satRaw;
    const f = focusRaw ?? {};
    const merged = {
      ...base,
      fiveMajorCitiesCount: f.fiveMajorCitiesCount ?? base.fiveMajorCitiesCount ?? 0,
      gen5060Count: f.gen5060Count ?? base.gen5060Count ?? 0,
      problemResolvedCount: f.problemResolvedCount ?? base.problemResolvedCount ?? 0,
      monthlyTargetPct: base.monthlyTargetPct ?? base.target,
      receivedCount: base.receivedCount ?? base.totalSamples,
      dailyTrend:
        !isMock && Array.isArray(base.dailyTrend) && base.dailyTrend.length > 0
          ? base.dailyTrend
          : buildMockDailyTrend(year, month),
    };
    const achievementVsTarget = computeMonthlyAchievementVsTargetPct(merged);
    return {
      ...merged,
      achievementRate: achievementVsTarget ?? merged.achievementRate ?? 0,
    };
  }, [satRaw, isError, focusRaw, year, month]);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp cs-sat-page yp-home fade-in">

      <header className="adm-header adm-header--yp">
        <div className="adm-header-text">
          <h1 className="adm-title">만족도</h1>
          <p className="adm-sub">나의 CS 만족도 현황과 추이를 한눈에 확인하세요.</p>
        </div>
      </header>

      <CsSatisfactionKpiRow data={satData} year={year} month={month} />

      <div className="cs-sat-hero-layout">
        <div className="cs-sat-hero-left">
          <MonthlyAccumulatedPanel data={satData} year={year} month={month}>
            <UnsatisfiedCategoriesPanel
              embedded
              categories={satData?.unsatisfiedCategories}
              year={year}
              month={month}
              skid={user?.skid}
              detailFallbackByType={MOCK_DATA.unsatisfiedDetailSamples}
            />
          </MonthlyAccumulatedPanel>
        </div>
        <div className="cs-sat-hero-ai">
          <AiInsightPanel data={satData} />
        </div>
      </div>
    </div>
  );
}
