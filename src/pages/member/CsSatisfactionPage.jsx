import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ThumbsUp,
  ThumbsDown,
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
import { fetchMemberSatisfaction, fetchMemberCsInsightPromptMents } from '../../api/memberApi';
import { fetchCsSatisfactionMemberMonthlyRows } from '../../api/adminApi';
import { fetchCsSatisfactionInsight, LM_STUDIO_MODEL } from '../../api/lmStudioClient';
import { finalizeInsightHtml } from '../../utils/sanitizeInsightHtml';
import { parseInsightFeedback } from '../../utils/parseInsightFeedback';
import Skeleton from '../../components/common/Skeleton';
import '../admin/DashboardPage.css';
import '../admin/AdminSatisfactionPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

function useCountUpFloat(target, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (end <= 0) {
      setValue(0);
      return undefined;
    }

    let rafId = 0;
    const startedAt = performance.now();
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;

    const tick = (nowMs) => {
      const p = Math.min(1, (nowMs - startedAt) / duration);
      setValue(end * easeOutCubic(p));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };

    setValue(0);
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

const MEMBER_ROWS_PAGE_SIZE = 10;

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

function normalizeCommentList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : x?.comment ?? x?.goodMent ?? x?.badMent ?? ''))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** API의 yyyy-MM-dd → 표시용 (예: 2026.5.3) */
function formatInsightMentBasisDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}`;
}

/* ════════════════════════════════════════════════════════════
   히어로 스켈레톤
   ════════════════════════════════════════════════════════════ */
function HeroSkeleton() {
  return (
    <>
      <section className="csx-session csx-session--primary">
        <section className="csx-hero csx-hero--unified">
          <div className="csx-hero-topbar" aria-hidden>
            <Skeleton width={72} height={24} radius={999} />
          </div>
          <div className="csx-hero-highlight">
            <div className="csx-hero-highlight-left">
              <div className="csx-gauge-wrap" style={{ alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                <Skeleton width={184} height={184} radius={999} />
              </div>
              <Skeleton height={36} radius={10} style={{ width: '100%' }} />
              <Skeleton height={28} radius={999} style={{ width: '72%' }} />
            </div>
            <div className="csx-ai-insight csx-ai-insight--skeleton" aria-hidden>
              <Skeleton variant="text" width={120} height={14} />
              <Skeleton variant="text" width="100%" height={12} />
              <Skeleton variant="text" width="100%" height={12} />
              <Skeleton variant="text" width="92%" height={12} />
              <Skeleton variant="text" width="85%" height={12} />
            </div>
          </div>
          <Skeleton height={42} radius={12} />
        </section>
      </section>
      <section className="csx-session csx-session--secondary csx-session--skeleton csx-session--rates" aria-hidden>
        <Skeleton variant="text" width={140} height={18} />
        <Skeleton variant="text" width="95%" height={12} style={{ marginTop: 6 }} />
        <ul className="csx-rate-deck csx-rate-deck--skeleton">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="csx-rate-deck-item">
              <Skeleton height={64} radius={14} />
            </li>
          ))}
        </ul>
        <Skeleton height={42} radius={12} style={{ marginTop: 4 }} />
      </section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   링 게이지 SVG
   ════════════════════════════════════════════════════════════ */
const RING_GAP = 4;

function GaugeRing({ actual, target, met, size = 'default' }) {
  const ringR = size === 'large' ? 84 : 72;
  const ringStroke = size === 'large' ? 11 : 10;
  const ringSize = (ringR + ringStroke) * 2;
  const ringCx = ringSize / 2;
  const ringCy = ringSize / 2;
  const circumference = 2 * Math.PI * ringR;

  const clampedActual = Math.min(Math.max(actual ?? 0, 0), 100);
  const clampedTarget = target != null ? Math.min(Math.max(target, 0), 100) : null;

  const actualOffset = circumference * (1 - clampedActual / 100);
  const targetOffset = clampedTarget != null
    ? circumference * (1 - clampedTarget / 100)
    : null;

  const trackColor = '#eef1f6';
  const actualGrad = met === true
    ? 'url(#gaugeGradMet)'
    : met === false
      ? 'url(#gaugeGradNo)'
      : 'url(#gaugeGradNeutral)';

  return (
    <svg
      className={`csx-gauge-svg csx-gauge-svg--${size}`}
      width={ringSize}
      height={ringSize}
      viewBox={`0 0 ${ringSize} ${ringSize}`}
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
        cx={ringCx} cy={ringCy} r={ringR}
        fill="none"
        stroke={trackColor}
        strokeWidth={ringStroke}
        strokeLinecap="round"
      />

      {/* 목표 마커 */}
      {clampedTarget != null && (
        <circle
          cx={ringCx} cy={ringCy} r={ringR}
          fill="none"
          stroke="#dbeafe"
          strokeWidth={ringStroke + RING_GAP}
          strokeLinecap="butt"
          strokeDasharray={`2 ${circumference - 2}`}
          strokeDashoffset={circumference * 0.25 - targetOffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${ringCx}px ${ringCy}px` }}
        />
      )}

      {/* 실적 아크 */}
      {actual != null && (
        <circle
          cx={ringCx} cy={ringCy} r={ringR}
          fill="none"
          stroke={actualGrad}
          strokeWidth={ringStroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={actualOffset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${ringCx}px ${ringCy}px`,
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
        const px = ringCx + ringR * Math.cos(rad);
        const py = ringCy + ringR * Math.sin(rad);
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

function clipInsightLines(lines, maxItems = 8, maxChars = 120) {
  return lines.slice(0, maxItems).map((s) => {
    const t = String(s);
    return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
  });
}

function SatisfactionLinearBar({
  actualPct,
  target,
  met,
  animatedActualPct,
}) {
  const fillPct = animatedActualPct != null
    ? Math.min(100, Math.max(0, Number(animatedActualPct)))
    : null;
  const markerLeft = target != null ? Math.min(100, Math.max(0, Number(target))) : null;
  const statusMod = met === true ? 'met' : met === false ? 'no' : 'none';

  const ariaLabel = (() => {
    const a = actualPct != null ? `${fmt(animatedActualPct ?? actualPct)}%` : '집계 전';
    const t = target != null ? `목표 ${fmt(target)}%` : '목표 미설정';
    return `이달 만족도 진행, 실적 ${a}, ${t}`;
  })();

  return (
    <div
      className={`csx-linear-bar csx-linear-bar--${statusMod}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="csx-linear-bar-meta" aria-hidden>
        {actualPct != null ? (
          <>
            <strong>{fmt(animatedActualPct ?? actualPct)}%</strong>
            {target != null ? (
              <span className="csx-linear-bar-slash"> / {fmt(target)}%</span>
            ) : (
              <span className="csx-linear-bar-muted"> · 목표 없음</span>
            )}
          </>
        ) : (
          <span className="csx-linear-bar-muted">집계 전</span>
        )}
      </div>
      <div className="csx-linear-bar-track" aria-hidden>
        {fillPct != null ? (
          <div
            className={`csx-linear-bar-fill csx-linear-bar-fill--${statusMod}`}
            style={{ width: `${fillPct}%` }}
          />
        ) : (
          <div className="csx-linear-bar-fill csx-linear-bar-fill--empty" style={{ width: '0%' }} />
        )}
        {markerLeft != null ? (
          <span
            className="csx-linear-bar-marker"
            style={{ left: `${markerLeft}%` }}
            title={`목표 ${fmt(target)}%`}
          />
        ) : null}
      </div>
    </div>
  );
}

function buildInsightStatsLines(d) {
  const actualPct = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  const met = computeMet(d);
  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;
  const satisfied = toNum(d.satisfiedCount, 0) ?? 0;
  const unsatisfied = toNum(d.unsatisfiedCount, 0) ?? 0;
  const lines = [
    `- 만족도 실적: ${actualPct != null ? `${fmt(actualPct)}%` : '—'}`,
    target != null ? `- 목표: ${fmt(target)}%` : '- 목표: (미설정)',
    `- 이번 달 달성 여부: ${met === true ? '달성' : met === false ? '미달성' : '판정 전'}`,
    `- 접수 ${received}건 · 만족 ${satisfied} · 불만족 ${unsatisfied}`,
  ];
  const hot = (d.unsatisfiedCategories ?? [])
    .filter((c) => toNum(c.count, 0) > 0)
    .map((c) => `${c.label ?? ''} ${c.count}건`)
    .filter((s) => s.trim());
  if (hot.length) lines.push(`- 불만족 유형 요약: ${hot.join(', ')}`);
  return lines;
}

/** Good/Bad 멘트 기반 코칭 카드 — 스크롤 없이 한 화면에 */
function InsightFeedbackPanel({ fromGood, fromBad, nextStep, accent }) {
  const goodText = fromGood?.trim() || '이번 달 수집된 Good 멘트가 없습니다.';
  const badText = fromBad?.trim() || 'Bad 멘트가 없습니다. 좋은 패턴을 유지하면 됩니다.';

  return (
    <div
      className={`csx-insight-fb csx-insight-fb--${accent}`}
      role="region"
      aria-label="Good·Bad 멘트 기준 개선 제안"
    >
      <div className="csx-insight-fb-row">
        <div className="csx-insight-fb-cell csx-insight-fb-cell--good">
          <span className="csx-insight-fb-label">
            <ThumbsUp size={14} strokeWidth={2.4} aria-hidden />
            Good 멘트에서
          </span>
          <p className="csx-insight-fb-body">{goodText}</p>
        </div>
        <div className="csx-insight-fb-cell csx-insight-fb-cell--watch">
          <span className="csx-insight-fb-label csx-insight-fb-label--soft">
            Bad 멘트 기준 보완
          </span>
          <p className="csx-insight-fb-body">{badText}</p>
        </div>
      </div>
      <div className="csx-insight-fb-action">
        <span className="csx-insight-fb-action-label">
          <Sparkles size={13} strokeWidth={2.4} className="csx-insight-fb-action-ico" aria-hidden />
          이렇게 개선해 보세요
        </span>
        <p className="csx-insight-fb-action-text">{nextStep}</p>
      </div>
    </div>
  );
}

function CsAiInsight({
  satData,
  year,
  month,
  insightMents,
  insightMentsPending,
  fallbackContent,
  shortageStatus,
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    if (!satData || insightMentsPending) return undefined;

    let alive = true;
    const ac = new AbortController();
    setLoading(true);
    setErrMsg(null);

    (async () => {
      try {
        const goodLines = clipInsightLines(
          [...new Set(normalizeCommentList(insightMents?.goodMents))],
          14,
          140,
        );
        const badLines = clipInsightLines(
          [...new Set(normalizeCommentList(insightMents?.badMents))],
          14,
          140,
        );
        const statsLines = buildInsightStatsLines(satData);

        const insightText = await fetchCsSatisfactionInsight({
          year,
          month,
          statsLines,
          goodLines,
          badLines,
          latestConsultDate: insightMents?.latestConsultDate ?? null,
          signal: ac.signal,
        });
        if (!alive) return;
        setText(insightText);
      } catch (e) {
        if (!alive || ac.signal.aborted || e?.name === 'AbortError') return;
        setErrMsg(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
      setLoading(false);
    };
  }, [satData, year, month, insightMents, insightMentsPending]);

  const mod = shortageStatus === 'met' ? 'met'
    : shortageStatus === 'short' ? 'short'
      : ['noData', 'noTarget'].includes(shortageStatus) ? 'muted' : 'neutral';

  const feedback = useMemo(() => (text ? parseInsightFeedback(text) : null), [text]);
  const safeInsightHtml = useMemo(() => (text ? finalizeInsightHtml(text) : ''), [text]);

  const basisCaption = useMemo(() => {
    if (insightMentsPending && insightMents == null) return null;
    const iso = insightMents?.latestConsultDate;
    if (iso) {
      const disp = formatInsightMentBasisDate(iso);
      return disp ? `멘트 분석 기준 상담일 ${disp}` : null;
    }
    if (!insightMentsPending) {
      return '멘트 분석: 해당 월 평가시간 적용 전체 · 상담일시 없음';
    }
    return null;
  }, [insightMents, insightMentsPending]);

  return (
    <aside className={`csx-ai-insight csx-ai-insight--${mod}`} aria-labelledby="csx-ai-insight-label">
      <div className="csx-ai-insight-head">
        <span
          className="csx-ai-insight-icon"
          title={`LM Studio · ${LM_STUDIO_MODEL}`}
        >
          <Sparkles size={18} strokeWidth={2.3} aria-hidden />
        </span>
        <div className="csx-ai-insight-head-text">
          <h2 id="csx-ai-insight-label" className="csx-ai-insight-title">AI 인사이트</h2>
          <p className="csx-ai-insight-tagline">Good·Bad 멘트 기준 개선</p>
          {basisCaption ? (
            <p className="csx-ai-insight-basis" role="note">
              {basisCaption}
            </p>
          ) : null}
        </div>
      </div>

      {insightMentsPending || loading ? (
        <div className="csx-ai-insight-body csx-ai-insight-body--loading">
          <div className="csx-ai-insight-shimmer" />
          <p className="csx-ai-insight-wait">불러오는 중…</p>
        </div>
      ) : errMsg ? (
        <div className="csx-ai-insight-body">
          <p className="csx-ai-insight-prose" role="status">
            {fallbackContent}
          </p>
          <p className="csx-ai-insight-err" role="alert">
            LM Studio 확인 · {errMsg.length > 72 ? `${errMsg.slice(0, 72)}…` : errMsg}
          </p>
        </div>
      ) : (
        <div className="csx-ai-insight-body">
          {text ? (
            feedback ? (
              <InsightFeedbackPanel
                fromGood={feedback.fromGood}
                fromBad={feedback.fromBad}
                nextStep={feedback.nextStep}
                accent={mod}
              />
            ) : safeInsightHtml.trim() ? (
              <div
                className="csx-ai-insight-html"
                role="status"
                aria-live="polite"
                dangerouslySetInnerHTML={{ __html: safeInsightHtml }}
              />
            ) : (
              <p className="csx-ai-insight-prose" role="status" aria-live="polite">{text}</p>
            )
          ) : (
            <div className="csx-ai-insight-prose csx-ai-insight-fallback-wrap">{fallbackContent}</div>
          )}
        </div>
      )}
    </aside>
  );
}

const DEFAULT_MODAL_FILTERS = {
  satisfiedYn: 'ALL',
  fiveMajorCitiesYn: 'ALL',
  gen5060Yn: 'ALL',
  problemResolvedYn: 'ALL',
};

const RATE_CARD_FILTERS = {
  sat: { ...DEFAULT_MODAL_FILTERS, satisfiedYn: 'Y' },
  unsat: { ...DEFAULT_MODAL_FILTERS, satisfiedYn: 'N' },
  five: { ...DEFAULT_MODAL_FILTERS, fiveMajorCitiesYn: 'Y' },
  gen: { ...DEFAULT_MODAL_FILTERS, gen5060Yn: 'Y' },
  solve: { ...DEFAULT_MODAL_FILTERS, problemResolvedYn: 'Y' },
};

/* ════════════════════════════════════════════════════════════
   만족도 현황 — 5대 지표(%)
   ════════════════════════════════════════════════════════════ */
function SatisfactionRateDeck({ data, received, onOpenFiltered }) {
  const d = data ?? {};
  const hasBase = received > 0;

  const items = [
    {
      key: 'sat',
      label: '만족',
      sub: '만족(Y)',
      field: 'monthlyActualPct',
      mod: 'sat',
      Icon: ThumbsUp,
      filter: RATE_CARD_FILTERS.sat,
    },
    {
      key: 'unsat',
      label: '불만족',
      sub: '불만족(N)',
      field: 'unsatisfiedPct',
      mod: 'unsat',
      Icon: ThumbsDown,
      filter: RATE_CARD_FILTERS.unsat,
    },
    {
      key: 'five',
      label: '5대도시',
      sub: '5대도시(Y)',
      field: 'fiveMajorCitiesPct',
      mod: 'five',
      Icon: MapPinned,
      filter: RATE_CARD_FILTERS.five,
    },
    {
      key: 'gen',
      label: '5060',
      sub: '5060(Y)',
      field: 'gen5060Pct',
      mod: 'gen',
      Icon: UserCircle2,
      filter: RATE_CARD_FILTERS.gen,
    },
    {
      key: 'solve',
      label: '문제해결',
      sub: '문제해결(Y)',
      field: 'problemResolvedPct',
      mod: 'solve',
      Icon: CheckCircle2,
      filter: RATE_CARD_FILTERS.solve,
    },
  ];

  const rightItems = items.filter((it) => it.key !== 'sat' && it.key !== 'unsat');
  const satPctRaw = hasBase ? toNum(d.monthlyActualPct) : null;
  const unsatPctRaw = hasBase ? toNum(d.unsatisfiedPct) : null;
  const satPct = satPctRaw == null || Number.isNaN(satPctRaw) ? null : Math.min(100, Math.max(0, satPctRaw));
  const unsatPct = unsatPctRaw == null || Number.isNaN(unsatPctRaw) ? null : Math.min(100, Math.max(0, unsatPctRaw));

  const renderCard = (it) => {
    const Icon = it.Icon;
    const raw = hasBase ? toNum(d[it.field]) : null;
    const display = raw == null || Number.isNaN(raw) ? '—' : `${fmt(raw)}%`;
    const width = raw != null && !Number.isNaN(raw) ? Math.min(100, Math.max(0, raw)) : 0;

    return (
      <li key={it.key} className="csx-rate-deck-item">
        <button
          type="button"
          className={`csx-rate-card csx-rate-card--${it.mod}`}
          onClick={() => onOpenFiltered(it.filter)}
        >
          <span className="csx-rate-card-icon" aria-hidden>
            <Icon size={20} strokeWidth={2.15} />
          </span>
          <span className="csx-rate-card-main">
            <span className="csx-rate-card-top">
              <span className="csx-rate-card-label">{it.label}</span>
              <span className="csx-rate-card-pct" title={`${it.sub} ÷ 이번 달 평가 건수`}>
                {display}
              </span>
            </span>
            <span className="csx-rate-card-sub">{it.sub}</span>
            {hasBase && raw != null && !Number.isNaN(raw) ? (
              <span className="csx-rate-meter" aria-hidden>
                <span className="csx-rate-meter-fill" style={{ width: `${width}%` }} />
              </span>
            ) : null}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="csx-rate-deck-group-wrap">
      <section className="csx-rate-group csx-rate-group--left" aria-label="만족/불만족">
        <h3 className="csx-rate-group-title">만족/불만족</h3>
        <button
          type="button"
          className="csx-satmix-card"
          onClick={() => onOpenFiltered({ ...DEFAULT_MODAL_FILTERS })}
          aria-label="만족도 통합 게이지"
        >
          <span className="csx-satmix-title">만족도</span>
          <span className="csx-satmix-kpi-row">
            <span className="csx-satmix-kpi-item">
              <span className="csx-satmix-kpi-label">만족</span>
              <strong className="csx-satmix-kpi-value csx-satmix-kpi-value--sat">
                {satPct == null ? '—' : `${fmt(satPct)}%`}
              </strong>
            </span>
            <span className="csx-satmix-kpi-sep">|</span>
            <span className="csx-satmix-kpi-item">
              <span className="csx-satmix-kpi-label">불만족</span>
              <strong className="csx-satmix-kpi-value csx-satmix-kpi-value--unsat">
                {unsatPct == null ? '—' : `${fmt(unsatPct)}%`}
              </strong>
            </span>
          </span>
        </button>
      </section>
      <section className="csx-rate-group csx-rate-group--right" aria-label="중점 항목">
        <h3 className="csx-rate-group-title">5대도시 · 5060 · 문제해결</h3>
        <ul className="csx-rate-deck csx-rate-deck--right">
          {rightItems.map(renderCard)}
        </ul>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   하단 세션 — 만족도 현황 (%)
   ════════════════════════════════════════════════════════════ */
function ReceptionFocusSection({
  data,
  onShowAll,
  onOpenFiltered,
}) {
  const d = data ?? {};
  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;

  return (
    <section
      className="csx-session csx-session--secondary csx-session--rates"
      aria-labelledby="csx-session-reception-focus-title"
    >
      <header className="csx-session-head-main csx-session-head-main--rates">
        <h2 id="csx-session-reception-focus-title" className="csx-session-title-main">
          만족도 현황
        </h2>
        <p className="csx-session-desc-main">
          기준: <strong>해당 지표 건수 ÷ 이달 평가 건수(useYn=Y)</strong>
          <span className="csx-session-desc-divider">·</span>
          분모 {received > 0 ? <strong>{received}건</strong> : <strong>0건</strong>}
        </p>
      </header>

      <SatisfactionRateDeck
        data={d}
        received={received}
        onOpenFiltered={onOpenFiltered}
      />

      <button type="button" className="csx-rates-all-btn" onClick={onShowAll}>
        전체 접수 보기
      </button>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ① 히어로 (만족도 · AI — 상단 세션)
   ════════════════════════════════════════════════════════════ */
function HeroPanel({
  data,
  user,
  year,
  month,
  insightMents,
  insightMentsPending,
}) {
  const d = data ?? {};
  const actualPct = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  const met = computeMet(d);

  const animatedActualPct = useCountUpFloat(actualPct ?? 0, 1300);

  const shortage = computeShortageVsTarget(d);

  const fallbackInsight = (() => {
    switch (shortage.status) {
      case 'met':
        return <>목표 <strong>달성</strong>. 긍정 피드백을 이어가 보세요.</>;
      case 'short':
        return (
          <>만족 <strong className="csx-hero-kpi-ai-strong">{shortage.count}건</strong> 더 필요합니다.</>
        );
      case 'noData':
        return <>이번 달 접수가 없습니다.</>;
      case 'noTarget':
      default:
        return <>당월 목표%가 없습니다.</>;
    }
  })();

  const statusMod = met === true ? 'met' : met === false ? 'no' : 'none';

  const compactStatus = (() => {
    if (met === true) return '달성';
    if (met === false && shortage.status === 'short') return `미달성 · 만족 ${shortage.count}건 부족`;
    if (met === false) return '미달성';
    if (shortage.status === 'noData') return '접수 대기';
    if (shortage.status === 'noTarget') return '목표 없음';
    return '집계 전';
  })();

  return (
    <section className="csx-hero csx-hero--unified">
      <div className="csx-hero-topbar csx-hero-topbar--solo">
        <span className="csx-hero-chip csx-hero-chip--skill">
          {month}월 만족도
        </span>
      </div>

      <div className="csx-hero-highlight">
        <div className="csx-hero-highlight-left">
          <div className={`csx-gauge-featured csx-gauge-wrap csx-gauge-wrap--${statusMod}`}>
            <GaugeRing actual={animatedActualPct} target={target} met={met} size="large" />
            <div className="csx-gauge-center">
              <p className="csx-gauge-period">
                목표: {target != null ? `${fmt(target)}%` : '—'}
              </p>
              <div className="csx-gauge-value">
                <span className={`csx-gauge-num csx-gauge-num--${statusMod}`}>
                  {actualPct != null ? fmt(animatedActualPct) : '—'}
                </span>
                <span className="csx-gauge-unit">%</span>
              </div>
            </div>
          </div>

          <SatisfactionLinearBar
            actualPct={actualPct}
            target={target}
            met={met}
            animatedActualPct={animatedActualPct}
          />

          <p className={`csx-hero-status-compact csx-hero-status-compact--${statusMod}`} role="status">
            {compactStatus}
          </p>
        </div>

        <CsAiInsight
          satData={d}
          year={year}
          month={month}
          insightMents={insightMents}
          insightMentsPending={insightMentsPending}
          fallbackContent={fallbackInsight}
          shortageStatus={shortage.status}
        />
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
  const [modalYnFilters, setModalYnFilters] = useState(() => ({ ...DEFAULT_MODAL_FILTERS }));

  const satQuery = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = satQuery.data ?? null;

  const insightMentsQuery = useQuery({
    queryKey: ['member-cs-ai-insight-ments', user?.skid, year, month],
    queryFn: () => fetchMemberCsInsightPromptMents({ skid: user.skid, year, month }),
    enabled: !!user?.skid && !!satData && !satQuery.isError,
    staleTime: 60_000,
  });

  const memberRowsQuery = useQuery({
    queryKey: ['member-sat-rows', user?.skid, year],
    queryFn: () => fetchCsSatisfactionMemberMonthlyRows(user.skid, year),
    enabled: !!user?.skid && !!satData && !satQuery.isError,
    staleTime: 60_000,
  });

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
      setModalYnFilters({ ...DEFAULT_MODAL_FILTERS });
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
  const headerName = user?.name ?? user?.skid ?? '구성원';
  const headerSkill = (satData?.skill ?? satQuery.data?.skill ?? user?.skill ?? '').toString().trim();

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp cs-sat-page yp-home hp-home fade-in csx-page">
      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 CS 만족도</h1>
          <p className="csx-header-meta" aria-label="구성원 정보">
            <span className="csx-header-skill-badge">{headerSkill || '스킬 미지정'}</span>
            <span className="csx-header-name">{headerName}</span>
          </p>
        </div>
      </header>

      {isLoading ? (
        <HeroSkeleton />
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
          <section className="csx-session csx-session--primary">
            <HeroPanel
              data={satData}
              user={user}
              year={year}
              month={month}
              insightMents={insightMentsQuery.data}
              insightMentsPending={insightMentsQuery.isPending || insightMentsQuery.isFetching}
            />
          </section>
          <ReceptionFocusSection
            data={satData}
            onShowAll={() => {
              setModalYnFilters({ ...DEFAULT_MODAL_FILTERS });
              setShowModal(true);
            }}
            onOpenFiltered={(filters) => {
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
                        </tr>
                      </thead>
                      <tbody>
                        {modalPagedRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="adm-table-empty">
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
