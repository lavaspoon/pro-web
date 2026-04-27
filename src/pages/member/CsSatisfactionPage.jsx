import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ThumbsUp,
  CheckCircle2,
  MapPinned,
  UserCircle2,
  AlertCircle,
  Inbox,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberSatisfaction, fetchMemberFocusTasks } from '../../api/memberApi';
import { fetchCsSatisfactionMemberMonthlyRows } from '../../api/adminApi';
import Skeleton from '../../components/common/Skeleton';
import '../admin/DashboardPage.css';
import '../admin/AdminSatisfactionPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const MEMBER_ROWS_PAGE_SIZE = 10;

/** Good 멘트 티커 — 한 줄씩 자동 순환 */
const GOOD_TICKER_INTERVAL_MS = 4500;

function fmt(v, decimals = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

function toNum(v, fallback = null) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numKo(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return String(dt).replace('T', ' ');
}

function dateKeyFromDateTime(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 10);
}

function yesNo(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'Y';
  if (s === 'N') return 'N';
  return '—';
}

function ynClass(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'is-yes';
  if (s === 'N') return 'is-no';
  return 'is-empty';
}

function nextYnFilter(v) {
  if (v === 'ALL') return 'Y';
  if (v === 'Y') return 'N';
  return 'ALL';
}

function matchesYnFilter(value, filterValue) {
  if (filterValue === 'ALL') return true;
  return String(value ?? '').trim().toUpperCase() === filterValue;
}

function filterToneClass(v) {
  if (v === 'Y') return 'is-filter-y';
  if (v === 'N') return 'is-filter-n';
  return 'is-filter-all';
}

function computeActualPct(d) {
  const served = d.monthlyActualPct;
  if (served != null && Number.isFinite(Number(served))) return Number(served);
  const recv = toNum(d.receivedCount ?? d.totalSamples, 0);
  const sat = toNum(d.satisfiedCount, 0);
  if (!recv || recv <= 0) return null;
  return (sat / recv) * 100;
}

function computeAchievementPct(d) {
  const served = d.monthlyAchievementRate;
  if (served != null && Number.isFinite(Number(served))) return Number(served);
  const actual = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  if (actual == null || target == null || target <= 0) return null;
  return (actual / target) * 100;
}

function computeMet(d) {
  if (d.monthlyTargetMet === true) return true;
  if (d.monthlyTargetMet === false) return false;
  const ach = computeAchievementPct(d);
  if (ach == null) return null;
  return ach >= 100;
}

/**
 * 현재 접수(received)를 분모로 고정했을 때, 목표 만족도에 도달하기 위해
 * 부족한 만족 건수를 계산한다.
 *
 *   필요 만족건수 = ceil(target% × received / 100)
 *   부족건수     = max(0, 필요 만족건수 − satisfied)
 *
 * 반환:
 *  - { status: 'noTarget' }                              : 목표가 없음
 *  - { status: 'noData' }                                : 이번 달 접수가 0건
 *  - { status: 'met' }                                   : 이미 목표 달성
 *  - { status: 'short', count, required, received }      : count건 부족
 */
function computeShortageVsTarget(d) {
  const target = toNum(d.monthlyTargetPct ?? d.target);
  if (target == null || target <= 0) return { status: 'noTarget' };

  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;
  const satisfied = toNum(d.satisfiedCount, 0) ?? 0;

  if (received <= 0) return { status: 'noData' };

  const required = Math.ceil((target * received) / 100);
  const shortage = required - satisfied;

  if (shortage <= 0) return { status: 'met' };
  return { status: 'short', count: shortage, required, received };
}

/* ════════════════════════════════════════════════════════════
   Good 멘트 티커
   ════════════════════════════════════════════════════════════ */
function GoodTicker({ comments }) {
  const list = Array.isArray(comments) ? comments : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % list.length);
    }, GOOD_TICKER_INTERVAL_MS);
    return () => clearInterval(t);
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className="csx-ticker csx-ticker--empty">
        <span className="csx-ticker-icon csx-ticker-icon--muted" aria-hidden>
          <ThumbsUp size={13} strokeWidth={2.3} />
        </span>
        <span className="csx-ticker-tag csx-ticker-tag--muted">Good 멘트</span>
        <p className="csx-ticker-text csx-ticker-text--muted">
          아직 기록된 긍정 멘트가 없어요.
        </p>
      </div>
    );
  }

  const current = list[idx] ?? list[0];
  const text = current?.comment ?? current?.goodMent ?? '';

  return (
    <div className="csx-ticker" role="status" aria-live="polite">
      <span className="csx-ticker-icon" aria-hidden>
        <ThumbsUp size={13} strokeWidth={2.3} />
      </span>
      <span className="csx-ticker-tag">Good 멘트</span>
      <p key={current.id ?? idx} className="csx-ticker-text">
        <span className="csx-ticker-quote" aria-hidden>{'“'}</span>
        {text}
        <span className="csx-ticker-quote" aria-hidden>{'”'}</span>
      </p>
      {list.length > 1 ? (
        <span className="csx-ticker-count" aria-label={`${idx + 1} / ${list.length}`}>
          {idx + 1}/{list.length}
        </span>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   히어로 스켈레톤
   ════════════════════════════════════════════════════════════ */
function HeroSkeleton() {
  return (
    <section className="csx-hero">
      <div className="csx-hero-topbar" aria-hidden>
        <Skeleton width={72} height={24} radius={999} />
        <Skeleton height={44} radius={12} style={{ flex: 1 }} />
      </div>
      <div className="csx-gauge-wrap" style={{ alignItems: 'center', justifyContent: 'center' }} aria-hidden>
        <Skeleton width={164} height={164} radius={999} />
      </div>
      <Skeleton height={40} radius={12} />
      <Skeleton height={42} radius={12} />
    </section>
  );
}

function FocusSkeleton() {
  return (
    <section className="csx-focus">
      <div className="csx-section-head">
        <Skeleton variant="text" width={110} height={16} />
        <Skeleton variant="text" width={180} height={11} />
      </div>
      <div className="csx-focus-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="csx-focus-card">
            <div className="csx-focus-card-head">
              <Skeleton width={26} height={26} radius={8} />
              <Skeleton variant="text" width={60} height={12} />
            </div>
            <Skeleton variant="text" width={50} height={26} />
            <Skeleton variant="text" width={80} height={11} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   링 게이지 SVG
   ════════════════════════════════════════════════════════════ */
const RING_R = 72;
const RING_STROKE = 10;
const RING_GAP = 4;
const RING_SIZE = (RING_R + RING_STROKE) * 2;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function GaugeRing({ actual, target, met }) {
  const clampedActual = Math.min(Math.max(actual ?? 0, 0), 100);
  const clampedTarget = target != null ? Math.min(Math.max(target, 0), 100) : null;

  const actualOffset = CIRCUMFERENCE * (1 - clampedActual / 100);
  const targetOffset = clampedTarget != null
    ? CIRCUMFERENCE * (1 - clampedTarget / 100)
    : null;

  const trackColor = '#eef1f6';
  const actualGrad = met === true
    ? 'url(#gaugeGradMet)'
    : met === false
      ? 'url(#gaugeGradNo)'
      : 'url(#gaugeGradNeutral)';

  return (
    <svg
      className="csx-gauge-svg"
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="gaugeGradMet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="gaugeGradNo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3182f6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="gaugeGradNeutral" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 트랙 */}
      <circle
        cx={RING_CX} cy={RING_CY} r={RING_R}
        fill="none"
        stroke={trackColor}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
      />

      {/* 목표 마커 */}
      {clampedTarget != null && (
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_R}
          fill="none"
          stroke="#dbeafe"
          strokeWidth={RING_STROKE + RING_GAP}
          strokeLinecap="butt"
          strokeDasharray={`2 ${CIRCUMFERENCE - 2}`}
          strokeDashoffset={CIRCUMFERENCE * 0.25 - targetOffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${RING_CX}px ${RING_CY}px` }}
        />
      )}

      {/* 실적 아크 */}
      {actual != null && (
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_R}
          fill="none"
          stroke={actualGrad}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={actualOffset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${RING_CX}px ${RING_CY}px`,
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            filter: met === true
              ? 'drop-shadow(0 0 5px rgba(16,185,129,0.5))'
              : 'drop-shadow(0 0 5px rgba(49,130,246,0.4))',
          }}
        />
      )}

      {/* 목표 눈금 점 */}
      {clampedTarget != null && (() => {
        const angle = (clampedTarget / 100) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const px = RING_CX + RING_R * Math.cos(rad);
        const py = RING_CY + RING_R * Math.sin(rad);
        return (
          <circle
            cx={px} cy={py} r={4}
            fill="#ffffff"
            stroke={met === true ? '#059669' : '#3182f6'}
            strokeWidth={2.5}
          />
        );
      })()}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════
   ① 히어로
   ════════════════════════════════════════════════════════════ */
function HeroPanel({ data, user, year, month, onShowAll }) {
  const d = data ?? {};
  const actualPct = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  const met = computeMet(d);

  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;
  const satisfied = toNum(d.satisfiedCount, 0) ?? 0;
  const unsatisfied = toNum(d.unsatisfiedCount, 0) ?? 0;

  const skillText = (d.skill ?? user?.skill ?? '').toString().trim();
  const shortage = computeShortageVsTarget(d);

  const aiMessage = (() => {
    switch (shortage.status) {
      case 'met':
        return <>이달 목표를 <strong>달성</strong>했어요. 끝까지 유지해봐요.</>;
      case 'short':
        return (
          <>만족 <strong className="csx-hero-kpi-ai-strong">{shortage.count}건</strong> 더 필요해요.</>
        );
      case 'noData':
        return <>이번 달 접수 데이터를 기다리고 있어요.</>;
      case 'noTarget':
      default:
        return <>이번 달 목표가 설정되지 않았어요.</>;
    }
  })();

  const statusMod = met === true ? 'met' : met === false ? 'no' : 'none';

  return (
    <section className="csx-hero">
      {/* 상단: 스킬 칩 + 월 현황 버튼 */}
      <div className="csx-hero-topbar">
        <span className="csx-hero-chip csx-hero-chip--skill">
          {skillText || '스킬 미지정'}
        </span>
        <button
          type="button"
          className="csx-month-strip"
          onClick={onShowAll}
          aria-label={`${month}월 접수/만족/불만족 현황 전체보기`}
        >
          <span className="csx-month-strip-title">{month}월 현황</span>
          <span className="csx-month-stats">
            <span className="csx-month-stat csx-month-stat--received">
              <span className="csx-month-stat-dot" />
              <span className="csx-month-stat-label">접수</span>
              <strong className="csx-month-stat-val">{received}</strong>
            </span>
            <span className="csx-month-stat csx-month-stat--satisfied">
              <span className="csx-month-stat-dot" />
              <span className="csx-month-stat-label">만족</span>
              <strong className="csx-month-stat-val">{satisfied}</strong>
            </span>
            <span className="csx-month-stat csx-month-stat--unsatisfied">
              <span className="csx-month-stat-dot" />
              <span className="csx-month-stat-label">불만족</span>
              <strong className="csx-month-stat-val">{unsatisfied}</strong>
            </span>
          </span>
          <span className="csx-month-strip-link">
            전체보기
            <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {/* 중앙: 링 게이지 */}
      <div className={`csx-gauge-wrap csx-gauge-wrap--${statusMod}`}>
        <GaugeRing actual={actualPct} target={target} met={met} />
        <div className="csx-gauge-center">
          <p className="csx-gauge-period">{year}.{String(month).padStart(2, '0')}</p>
          <div className="csx-gauge-value">
            <span className={`csx-gauge-num csx-gauge-num--${statusMod}`}>
              {actualPct != null ? fmt(actualPct) : '—'}
            </span>
            <span className="csx-gauge-unit">%</span>
          </div>
          {target != null && (
            <p className="csx-gauge-target">
              목표 <strong>{fmt(target)}%</strong>
            </p>
          )}
        </div>
      </div>

      {/* 하단: AI 가이드 + 달성 배지 */}
      <div className={`csx-hero-footer csx-hero-footer--${shortage.status}`}>
        <span className="csx-hero-footer-icon" aria-hidden>
          <Sparkles size={12} strokeWidth={2.4} />
        </span>
        <span className="csx-hero-footer-text" role="status" aria-live="polite">
          {aiMessage}
        </span>
        <span className={`csx-hero-chip csx-hero-chip--${statusMod}`}>
          {met === true ? '달성' : met === false ? '미달성' : '집계 전'}
        </span>
      </div>

      <GoodTicker comments={d.goodComments} />
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ② 중점추진과제 3카드
   ════════════════════════════════════════════════════════════ */
function FocusAchievementCards({ data, focusPending, focusError, onCardClick }) {
  const items = [
    {
      key: 'five',
      title: '5대 도시',
      icon: MapPinned,
      count: toNum(data?.fiveMajorCitiesCount),
      target: toNum(data?.fiveMajorCitiesTargetPct),
      filterOverride: { fiveMajorCitiesYn: 'Y' },
    },
    {
      key: 'gen',
      title: '5060',
      icon: UserCircle2,
      count: toNum(data?.gen5060Count),
      target: toNum(data?.gen5060TargetPct),
      filterOverride: { gen5060Yn: 'Y' },
    },
    {
      key: 'solve',
      title: '문제해결',
      icon: CheckCircle2,
      count: toNum(data?.problemResolvedCount),
      target: toNum(data?.problemResolvedTargetPct),
      filterOverride: { problemResolvedYn: 'Y' },
    },
  ];

  const total = items.reduce((s, it) => s + (it.count ?? 0), 0);

  const handleClick = (it) => {
    if (!onCardClick) return;
    onCardClick({
      satisfiedYn: 'ALL',
      fiveMajorCitiesYn: 'ALL',
      gen5060Yn: 'ALL',
      problemResolvedYn: 'ALL',
      ...it.filterOverride,
    });
  };

  return (
    <section className="csx-focus">
      <div className="csx-section-head">
        <span className="csx-section-title">중점추진과제</span>
        <span className="csx-section-hint">
          {focusError
            ? '데이터를 불러오지 못했습니다'
            : focusPending
              ? '불러오는 중…'
              : (
                <>
                  만족(Y)이면서 해당 중점지표도 Y인 건수 · 총 <strong>{total}건</strong>
                </>
              )}
        </span>
      </div>
      <div className="csx-focus-grid">
        {items.map((it) => {
          const Icon = it.icon;
          const hasCount = it.count != null;
          const hasTarget = it.target != null && it.target > 0;
          return (
            <div
              key={it.key}
              className={`csx-focus-card csx-focus-card--${it.key} csx-focus-card--clickable`}
              onClick={() => handleClick(it)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick(it);
                }
              }}
              aria-label={`${it.title} 접수 상세 보기`}
            >
              <div className="csx-focus-card-head">
                <span className="csx-focus-card-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className="csx-focus-card-title">{it.title}</span>
                <span className="csx-focus-card-arrow" aria-hidden>
                  <ChevronRight size={13} strokeWidth={2.5} />
                </span>
              </div>
              <div className="csx-focus-card-body">
                <span className="csx-focus-card-num">{hasCount ? it.count : '—'}</span>
                <span className="csx-focus-card-unit">건</span>
              </div>
              <div className="csx-focus-card-foot">
                {hasTarget ? (
                  <>목표 <strong>{fmt(it.target)}%</strong></>
                ) : (
                  <span className="csx-focus-card-foot--muted">개인 목표 미설정</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   메인 페이지
   ════════════════════════════════════════════════════════════ */
export default function CsSatisfactionPage() {
  const { user } = useAuthStore();
  const [year] = useState(currentYear);
  const [month] = useState(currentMonth);

  /* ── 모달 상태 ── */
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [modalYnFilters, setModalYnFilters] = useState({
    satisfiedYn: 'ALL',
    fiveMajorCitiesYn: 'ALL',
    gen5060Yn: 'ALL',
    problemResolvedYn: 'ALL',
  });

  const satQuery = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const focusQuery = useQuery({
    queryKey: ['member-focus-tasks', user?.skid, year, month],
    queryFn: () => fetchMemberFocusTasks({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const memberRowsQuery = useQuery({
    queryKey: ['member-sat-rows', user?.skid, year],
    queryFn: () => fetchCsSatisfactionMemberMonthlyRows(user.skid, year),
    enabled: showModal && !!user?.skid,
  });

  const satData = useMemo(() => {
    const base = satQuery.data ?? null;
    const f = focusQuery.data ?? null;
    if (!base && !f) return null;
    return {
      ...(base ?? {}),
      fiveMajorCitiesCount: f?.fiveMajorCitiesCount ?? base?.fiveMajorCitiesCount,
      gen5060Count: f?.gen5060Count ?? base?.gen5060Count,
      problemResolvedCount: f?.problemResolvedCount ?? base?.problemResolvedCount,
      fiveMajorCitiesTargetPct: base?.fiveMajorCitiesTargetPct,
      gen5060TargetPct: base?.gen5060TargetPct,
      problemResolvedTargetPct: base?.problemResolvedTargetPct,
    };
  }, [satQuery.data, focusQuery.data]);

  /* ── 모달 파생 데이터 ── */
  const modalDateBuckets = useMemo(() => {
    const months = memberRowsQuery.data?.months ?? [];
    const allRows = months.flatMap((m) => m.rows ?? []);
    const grouped = new Map();
    for (const row of allRows) {
      const k = dateKeyFromDateTime(row?.consultDateTime);
      if (!k) continue;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(row);
    }
    return [...grouped.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0]), 'ko'))
      .map(([date, rowsInDate]) => ({ date, rows: rowsInDate, count: rowsInDate.length }));
  }, [memberRowsQuery.data]);

  const modalDateIndex = useMemo(
    () => modalDateBuckets.findIndex((b) => String(b.date) === String(modalDate)),
    [modalDateBuckets, modalDate],
  );
  const modalSelectedBucket = modalDateIndex >= 0 ? modalDateBuckets[modalDateIndex] : null;

  const modalFilteredRows = useMemo(() => {
    const rowsInDate = modalSelectedBucket?.rows ?? [];
    return rowsInDate.filter((r) => {
      if (!matchesYnFilter(r?.satisfiedYn, modalYnFilters.satisfiedYn)) return false;
      if (!matchesYnFilter(r?.fiveMajorCitiesYn, modalYnFilters.fiveMajorCitiesYn)) return false;
      if (!matchesYnFilter(r?.gen5060Yn, modalYnFilters.gen5060Yn)) return false;
      if (!matchesYnFilter(r?.problemResolvedYn, modalYnFilters.problemResolvedYn)) return false;
      return true;
    });
  }, [modalSelectedBucket, modalYnFilters]);

  const modalTotalPages = useMemo(
    () => Math.max(1, Math.ceil(modalFilteredRows.length / MEMBER_ROWS_PAGE_SIZE)),
    [modalFilteredRows],
  );
  const modalPagedRows = useMemo(() => {
    const start = (modalPage - 1) * MEMBER_ROWS_PAGE_SIZE;
    return modalFilteredRows.slice(start, start + MEMBER_ROWS_PAGE_SIZE);
  }, [modalFilteredRows, modalPage]);

  useEffect(() => {
    if (!showModal) {
      setModalDate(null);
      setModalPage(1);
      setModalYnFilters({ satisfiedYn: 'ALL', fiveMajorCitiesYn: 'ALL', gen5060Yn: 'ALL', problemResolvedYn: 'ALL' });
      return;
    }
    if (modalDateBuckets.length === 0) return;
    const exists = modalDateBuckets.some((b) => String(b.date) === String(modalDate));
    if (!exists) setModalDate(modalDateBuckets[0].date);
  }, [showModal, modalDateBuckets, modalDate]);

  useEffect(() => { setModalPage(1); }, [modalDate, modalYnFilters]);
  useEffect(() => { setModalPage((p) => Math.min(p, modalTotalPages)); }, [modalTotalPages]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const isLoading = satQuery.isPending;
  const isError = satQuery.isError;

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp cs-sat-page yp-home hp-home fade-in csx-page">
      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 CS 만족도</h1>
          <p className="hp-header-sub">현황을 한눈에 확인하세요.</p>
        </div>
      </header>

      {isLoading ? (
        <>
          <HeroSkeleton />
          <FocusSkeleton />
        </>
      ) : isError ? (
        <div className="csx-error">
          <AlertCircle size={20} strokeWidth={2.2} />
          <div>
            <p className="csx-error-title">데이터를 불러오지 못했습니다</p>
            <p className="csx-error-sub">
              {satQuery.error?.message ?? '잠시 후 다시 시도해 주세요.'}
            </p>
          </div>
        </div>
      ) : !satData ? (
        <div className="csx-empty">
          <Inbox size={22} strokeWidth={2.1} />
          <p className="csx-empty-title">아직 집계된 데이터가 없어요</p>
          <p className="csx-empty-sub">{year}년 {month}월 기준으로 표시할 만족도 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          <HeroPanel
            data={satData}
            user={user}
            year={year}
            month={month}
            onShowAll={() => setShowModal(true)}
          />
          <FocusAchievementCards
            data={satData}
            focusPending={focusQuery.isPending}
            focusError={focusQuery.isError}
            onCardClick={(filters) => {
              setModalYnFilters(filters);
              setShowModal(true);
            }}
          />
        </>
      )}

      {/* ── 접수 상세 모달 ── */}
      {showModal && (
        <div
          className="adm-sat-row-modal-backdrop"
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <section
            className="adm-sat-row-modal"
            role="dialog"
            aria-modal="true"
            aria-label="나의 접수 상세"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="adm-sat-row-modal-head">
              <div>
                <h3 className="adm-sat-row-modal-title">
                  {user?.name ?? user?.skid} 접수 상세
                </h3>
                <p className="adm-sat-row-modal-sub">
                  {year}년 전체 · 총 {numKo(memberRowsQuery.data?.totalCount ?? 0)}건
                </p>
              </div>
              <div className="adm-sat-row-modal-month-nav">
                <button
                  type="button"
                  className="adm-sat-row-modal-month-btn"
                  onClick={() => {
                    if (modalDateIndex >= modalDateBuckets.length - 1) return;
                    setModalDate(modalDateBuckets[modalDateIndex + 1].date);
                  }}
                  disabled={modalDateIndex < 0 || modalDateIndex >= modalDateBuckets.length - 1}
                  aria-label="이전 일자"
                >
                  <ChevronLeft size={14} aria-hidden />
                </button>
                <strong className="adm-sat-row-modal-month-label">
                  {modalSelectedBucket ? modalSelectedBucket.date : '—'}
                </strong>
                <button
                  type="button"
                  className="adm-sat-row-modal-month-btn"
                  onClick={() => {
                    if (modalDateIndex <= 0) return;
                    setModalDate(modalDateBuckets[modalDateIndex - 1].date);
                  }}
                  disabled={modalDateIndex <= 0}
                  aria-label="다음 일자"
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className="adm-sat-row-modal-close"
                onClick={() => setShowModal(false)}
                aria-label="모달 닫기"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="adm-sat-row-modal-body">
              {memberRowsQuery.isLoading ? (
                <div className="adm-team-detail-loading">
                  <div className="spinner" />
                  <p>접수 내역을 불러오는 중…</p>
                </div>
              ) : memberRowsQuery.isError ? (
                <p className="adm-team-detail-error">
                  {memberRowsQuery.error?.message ?? '접수 내역을 불러오지 못했습니다.'}
                </p>
              ) : (memberRowsQuery.data?.months?.length ?? 0) === 0 ? (
                <p className="adm-sat-query-empty">해당 연도 접수 내역이 없습니다.</p>
              ) : (
                <div className="adm-sat-member-month-bucket">
                  <div className="adm-sat-modal-context-bar">
                    <div className="adm-sat-modal-context-date">
                      <span className="adm-sat-modal-context-kicker">조회 일자</span>
                      <strong>{modalSelectedBucket ? modalSelectedBucket.date : '—'}</strong>
                    </div>
                    <div className="adm-sat-modal-context-meta">
                      <span className="adm-sat-modal-context-pill">필터 결과 {numKo(modalFilteredRows.length)}건</span>
                      <span className="adm-sat-modal-context-pill">페이지 {modalPage} / {modalTotalPages}</span>
                    </div>
                  </div>
                  <div className="adm-table-wrap adm-sat-modal-table-wrap">
                    <table className="adm-table adm-sat-modal-rows-table">
                      <thead>
                        <tr>
                          <th><span className="adm-sat-modal-th-wrap">상담일시</span></th>
                          <th><span className="adm-sat-modal-th-wrap">상담유형</span></th>
                          <th>
                            <div className="adm-sat-modal-th-filter">
                              <button type="button" className="adm-sat-modal-th-btn"
                                onClick={() => setModalYnFilters((p) => ({ ...p, satisfiedYn: nextYnFilter(p.satisfiedYn) }))}
                                aria-label={`만족 필터 ${modalYnFilters.satisfiedYn}`}
                              >
                                <span className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.satisfiedYn)}`}>만족</span>
                              </button>
                            </div>
                          </th>
                          <th>
                            <button type="button" className="adm-sat-modal-th-btn"
                              onClick={() => setModalYnFilters((p) => ({ ...p, fiveMajorCitiesYn: nextYnFilter(p.fiveMajorCitiesYn) }))}
                              aria-label={`5대도시 필터 ${modalYnFilters.fiveMajorCitiesYn}`}
                            >
                              <span className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.fiveMajorCitiesYn)}`}>5대도시</span>
                            </button>
                          </th>
                          <th>
                            <button type="button" className="adm-sat-modal-th-btn"
                              onClick={() => setModalYnFilters((p) => ({ ...p, gen5060Yn: nextYnFilter(p.gen5060Yn) }))}
                              aria-label={`5060 필터 ${modalYnFilters.gen5060Yn}`}
                            >
                              <span className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.gen5060Yn)}`}>5060</span>
                            </button>
                          </th>
                          <th>
                            <button type="button" className="adm-sat-modal-th-btn"
                              onClick={() => setModalYnFilters((p) => ({ ...p, problemResolvedYn: nextYnFilter(p.problemResolvedYn) }))}
                              aria-label={`문제해결 필터 ${modalYnFilters.problemResolvedYn}`}
                            >
                              <span className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.problemResolvedYn)}`}>문제해결</span>
                            </button>
                          </th>
                          <th><span className="adm-sat-modal-th-wrap">Good 멘트</span></th>
                          <th><span className="adm-sat-modal-th-wrap">Bad 멘트</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPagedRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="adm-table-empty">
                              선택한 조건에 맞는 접수 내역이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          modalPagedRows.map((row) => (
                            <tr key={row.id}>
                              <td className="adm-sat-modal-cell-dt">{formatDateTime(row.consultDateTime)}</td>
                              <td className="adm-sat-modal-cell-type">
                                {[row.consultType1, row.consultType2, row.consultType3]
                                  .filter((v) => String(v ?? '').trim() !== '')
                                  .join(' / ') || '—'}
                              </td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.satisfiedYn)}`}>{yesNo(row.satisfiedYn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.fiveMajorCitiesYn)}`}>{yesNo(row.fiveMajorCitiesYn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.gen5060Yn)}`}>{yesNo(row.gen5060Yn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.problemResolvedYn)}`}>{yesNo(row.problemResolvedYn)}</span></td>
                              <td className="adm-sat-modal-cell-ment">{row.goodMent?.trim() ? row.goodMent : '—'}</td>
                              <td className="adm-sat-modal-cell-ment">{row.badMent?.trim() ? row.badMent : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="adm-sat-modal-pagination">
                    <button type="button" className="adm-sat-modal-page-btn"
                      onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                      disabled={modalPage <= 1}
                    >이전</button>
                    <span className="adm-sat-modal-page-label">{modalPage} / {modalTotalPages}</span>
                    <button type="button" className="adm-sat-modal-page-btn"
                      onClick={() => setModalPage((p) => Math.min(modalTotalPages, p + 1))}
                      disabled={modalPage >= modalTotalPages}
                    >다음</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
