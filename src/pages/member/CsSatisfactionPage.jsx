import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  MapPinned,
  UserCircle2,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  X,
  ArrowRight,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberSatisfaction, fetchCsSatisfactionTeamDaySummary } from '../../api/memberApi';
import { fetchCsSatisfactionMemberMonthlyRows } from '../../api/adminApi';
import CsSatisfactionModalDayStats from '../../components/cs/CsSatisfactionModalDayStats';
import PendingCaseDayPickerModal from '../admin/PendingCaseDayPickerModal';
import { fetchCsCoachScenario, fetchCsDayOverDayInsight, fetchCsGoodMentInsight } from '../../api/lmStudioClient';
import { parseCoachScenario, parseDayOverDayInsight, parseGoodMentInsight } from '../../utils/parseCsAiInsight';
import { formatCaseDateTimeMmDdKorean } from '../../utils/caseDisplay';
import { isActiveUseYn } from '../../utils/csSatisfactionModalDayStats';
import Skeleton, { SkeletonLines } from '../../components/common/Skeleton';
import '../admin/DashboardPage.css';
import '../admin/AdminSatisfactionPage.css';
import '../admin/PendingCasesPage.css';
import '../admin/PendingCaseDayPickerModal.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const CS_SAT_SLOGAN = '고객의 한마디가 내일의 만족도를 만듭니다';

function monthKeyFromParts(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function currentMonthKey() {
  return monthKeyFromParts(currentYear, currentMonth);
}

function currentDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function rowMonthKeyFromDateTime(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 7);
}

function formatModalMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  if (ym === currentMonthKey()) return `이번 달 · ${y}년 ${m}월`;
  return `${y}년 ${m}월`;
}

function formatDayPickerButtonLabel(dayKey) {
  if (!dayKey) return '전체';
  if (dayKey === currentDayKey()) return '오늘';
  const mo = Number(dayKey.slice(5, 7));
  const d = Number(dayKey.slice(8, 10));
  return `${mo}월 ${d}일`;
}

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

function matchesDissatTypeFilter(rawType, filterType) {
  if (filterType == null) return true;
  return toNum(rawType) === filterType;
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
/** 당월 접수·만족(Y)·불만족(N) 건수 (row 기준, API 폴백) */
function getMonthIntakeStats(memberRowsData, month, satData) {
  const bucket = (memberRowsData?.months ?? []).find(
    (m) => Number(m.month) === Number(month),
  );
  const rows = (bucket?.rows ?? []).filter(isActiveUseYn);
  if (rows.length > 0) {
    const satisfiedCount = rows.filter(
      (r) => String(r.satisfiedYn ?? '').trim().toUpperCase() === 'Y',
    ).length;
    const unsatisfiedCount = rows.filter(
      (r) => String(r.satisfiedYn ?? '').trim().toUpperCase() === 'N',
    ).length;
    return {
      totalReceived: rows.length,
      satisfiedCount,
      unsatisfiedCount,
    };
  }
  const totalReceived = toNum(satData?.receivedCount ?? satData?.totalSamples, 0) ?? 0;
  const satisfiedCount = toNum(satData?.satisfiedCount, 0) ?? 0;
  const unsatisfiedCount = toNum(satData?.unsatisfiedCount, 0) ?? 0;
  return { totalReceived, satisfiedCount, unsatisfiedCount };
}


/**
 * 문제해결 역산 달성률(%) — 목표는 허용 상한(이하여야 유리). 실적이 목표를 넘으면 감점.
 * 백엔드 problemInverseAchievementPct 와 동일.
 */
function problemInverseAchievementPct(actualResolvedPct, targetResolvedPct) {
  if (actualResolvedPct == null || targetResolvedPct == null) return null;
  const t = Number(targetResolvedPct);
  const a = Number(actualResolvedPct);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t <= 0 || t >= 100) return null;
  if (a <= t) return 100;
  return Math.round((1000 * t) / a) / 10;
}

/** 5대도시·5060 — 실적 ≥ 목표 */
function computeFocusMetricMet(pct, target) {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const t = toNum(target);
  if (t == null || t <= 0) return null;
  return Number(pct) >= t;
}

/** 문제해결 — 역산 달성률 ≥ 100% (실적 ≤ 목표) */
function computeProblemFocusMet(pct, target) {
  const ach = problemInverseAchievementPct(pct, target);
  if (ach == null) return null;
  return ach >= 100;
}

function computeShortageVsTarget(d, intakeStats) {
  const target = toNum(d.monthlyTargetPct ?? d.target);
  if (target == null || target <= 0) return { status: 'noTarget' };

  const received = intakeStats?.totalReceived
    ?? toNum(d.receivedCount ?? d.totalSamples, 0)
    ?? 0;
  const satisfied = intakeStats?.satisfiedCount
    ?? toNum(d.satisfiedCount, 0)
    ?? 0;

  if (received <= 0) return { status: 'noData' };

  const required = Math.ceil((target * received) / 100);
  const shortage = required - satisfied;

  if (shortage <= 0) return { status: 'met' };
  return { status: 'short', count: shortage, required, received };
}

function isEvaluatedRow(row) {
  return isActiveUseYn(row);
}

function flattenMemberRows(memberRowsData) {
  const months = memberRowsData?.months ?? [];
  return months.flatMap((m) => m.rows ?? []);
}

function groupRowsByConsultDate(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!isEvaluatedRow(row)) continue;
    const k = dateKeyFromDateTime(row?.consultDateTime);
    if (!k) continue;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(row);
  }
  return [...grouped.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0]), 'ko'))
    .map(([date, rowsInDate]) => ({ date, rows: rowsInDate }));
}

function computeDaySatisfactionPct(rows) {
  const evaluated = rows.filter(isEvaluatedRow);
  if (evaluated.length === 0) return null;
  const sat = evaluated.filter((r) => String(r.satisfiedYn).trim().toUpperCase() === 'Y').length;
  return (sat / evaluated.length) * 100;
}

function buildDaySnapshot(date, rows, unsatLabelMap) {
  const evaluated = rows.filter(isEvaluatedRow);
  const satisfied = evaluated.filter((r) => String(r.satisfiedYn).trim().toUpperCase() === 'Y');
  const unsatisfied = evaluated.filter((r) => String(r.satisfiedYn).trim().toUpperCase() === 'N');

  const goodMents = [...new Set(
    evaluated.map((r) => String(r.goodMent ?? '').trim()).filter(Boolean),
  )];
  const badMents = [...new Set(
    evaluated.map((r) => String(r.badMent ?? '').trim()).filter(Boolean),
  )];

  const unsatTypeCounts = new Map();
  unsatisfied.forEach((r) => {
    const label = unsatTypeLabel(unsatLabelMap, r.dissatisfactionType);
    if (!label) return;
    unsatTypeCounts.set(label, (unsatTypeCounts.get(label) ?? 0) + 1);
  });

  return {
    date,
    evaluatedCount: evaluated.length,
    satisfiedCount: satisfied.length,
    unsatisfiedCount: unsatisfied.length,
    pct: computeDaySatisfactionPct(rows),
    goodMents,
    badMents,
    unsatTypeCounts,
  };
}

function formatKoDate(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return dateStr;
  return `${m}월 ${d}일`;
}

function truncateMent(s, max = 52) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function topUnsatLabels(unsatTypeCounts, limit = 3) {
  return [...unsatTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

/** 불릿 본문 — 변동폭(%p)·건수 변화(→)만 은은하게 강조 */
const INSIGHT_HIGHLIGHT_RE = /(\d+(?:\.\d+)?%p|\d+건→\d+건)/g;

function InsightHighlightedText({ text }) {
  if (!text) return null;
  const nodes = [];
  let last = 0;
  let matchIndex = 0;
  const re = new RegExp(INSIGHT_HIGHLIGHT_RE.source, 'g');
  let m = re.exec(text);
  while (m) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <mark key={`hl-${matchIndex}`} className="csx-hl">
        {m[0]}
      </mark>,
    );
    matchIndex += 1;
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

/** 원인 문장 — Good 멘트·불만족 유형 형광 강조 */
function InsightReasonText({ reason, driver }) {
  if (!reason) return null;
  const label = driver?.text?.trim();
  if (!label || !reason.includes(label)) {
    return <InsightHighlightedText text={reason} />;
  }
  const idx = reason.indexOf(label);
  const tail = reason.slice(idx + label.length);
  return (
    <>
      {reason.slice(0, idx)}
      <mark className="csx-hl">{label}</mark>
      {tail ? <InsightHighlightedText text={tail} /> : null}
    </>
  );
}

function pickInsightDriver(latest, previous, direction) {
  if (direction === 'up') {
    const prevSet = new Set(previous.goodMents ?? []);
    const novel = (latest.goodMents ?? []).filter((m) => !prevSet.has(m));
    const text = novel[0] ?? latest.goodMents?.[0] ?? null;
    return text ? { kind: 'good', text } : null;
  }
  if (direction === 'down') {
    const text = topUnsatLabels(latest.unsatTypeCounts, 1)[0] ?? null;
    return text ? { kind: 'unsat', text } : null;
  }
  return null;
}

function pickInsightDrivers(latest, previous, direction) {
  const drivers = [];
  if (direction === 'up') {
    const primary = pickInsightDriver(latest, previous, direction);
    if (primary) drivers.push(primary);
    return drivers;
  }
  if (direction === 'down') {
    topUnsatLabels(latest.unsatTypeCounts, 2).forEach((text) => {
      drivers.push({ kind: 'unsat', text });
    });
    if (latest.badMents.length > previous.badMents.length) {
      const prevSet = new Set(previous.badMents ?? []);
      const novelBad = (latest.badMents ?? []).find((m) => !prevSet.has(m));
      if (novelBad) drivers.push({ kind: 'bad', text: novelBad });
    }
    return drivers;
  }
  return drivers;
}

function findDriverForReason(text, drivers) {
  if (!text || !drivers?.length) return null;
  return drivers.find((d) => d?.text && text.includes(d.text)) ?? null;
}

const INSIGHT_REASON_LIMIT = 3;
const COACH_FEEDBACK_POINTS_LIMIT = 1;

/** AI·폴백 원인 문장 — 줄바꿈·불릿 접두사를 li 항목으로 분리 */
function flattenInsightReasons(reasons) {
  const out = [];
  const seen = new Set();

  (reasons ?? []).forEach((line) => {
    String(line ?? '')
      .split(/\n+/)
      .flatMap((chunk) => chunk.split(/(?:(?:^|\s)[•·▪◦‣-]\s+)/))
      .map((part) => part.replace(/^[\s•·▪◦‣\-*\d.)]+/, '').trim())
      .filter(Boolean)
      .forEach((part) => {
        if (seen.has(part)) return;
        seen.add(part);
        out.push(part);
      });
  });

  return out.slice(0, INSIGHT_REASON_LIMIT);
}

/** AI·폴백 원인 문장 병합 — AI 우선, 부족하면 폴백으로 보강 */
function mergeInsightReasons(aiReasons, fallbackReasons, limit = INSIGHT_REASON_LIMIT) {
  const seen = new Set();
  const out = [];

  const add = (line) => {
    const text = String(line ?? '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };

  (aiReasons ?? []).forEach(add);
  (fallbackReasons ?? []).forEach(add);
  return out.slice(0, limit);
}

/** 만족도 AI 인사이트 — li 목록 */
function InsightReasonList({
  reasons,
  drivers,
  pending,
  emptyMessage,
  listClassName = '',
}) {
  const items = flattenInsightReasons(reasons);

  if (pending) {
    return (
      <ul
        className={`csx-toss-bullets csx-toss-bullets--skeleton${listClassName ? ` ${listClassName}` : ''}`}
        aria-busy="true"
        aria-label="AI 분석 중"
      >
        {[100, 94, 82].map((w) => (
          <li key={w} className="csx-toss-skel-bullet">
            <span className="csx-toss-skel-dot" aria-hidden />
            <Skeleton variant="text" width={`${w}%`} height={12} radius={4} />
          </li>
        ))}
      </ul>
    );
  }

  if (!items.length) {
    if (!emptyMessage) return null;
    return (
      <ul className={`csx-toss-bullets csx-toss-bullets--muted${listClassName ? ` ${listClassName}` : ''}`}>
        <li className="csx-toss-bullet csx-toss-bullet--reason">{emptyMessage}</li>
      </ul>
    );
  }

  return (
    <ul className={`csx-toss-bullets${listClassName ? ` ${listClassName}` : ''}`}>
      {items.map((line, i) => (
        <li key={`${i}-${line.slice(0, 24)}`} className="csx-toss-bullet csx-toss-bullet--reason">
          <InsightReasonText
            reason={line}
            driver={findDriverForReason(line, drivers)}
          />
        </li>
      ))}
    </ul>
  );
}

function buildReasonFallback(latest, previous, direction) {
  const drivers = pickInsightDrivers(latest, previous, direction);
  const primaryDriver = drivers[0] ?? null;
  const reasons = [];

  if (direction === 'up') {
    if (primaryDriver) {
      reasons.push(
        `${primaryDriver.text} Good 멘트가 전일보다 두드러져 만족도 상승의 핵심 요인으로 보입니다.`,
      );
    }
    if (latest.satisfiedCount > previous.satisfiedCount) {
      reasons.push(
        `만족(Y) 응답이 ${previous.satisfiedCount}→${latest.satisfiedCount}건으로 늘었습니다.`,
      );
    }
    if (latest.unsatisfiedCount < previous.unsatisfiedCount) {
      reasons.push(
        `불만족(N)이 ${previous.unsatisfiedCount}→${latest.unsatisfiedCount}건으로 줄었습니다.`,
      );
    }
    if (latest.goodMents.length > previous.goodMents.length) {
      reasons.push(
        `Good 멘트가 ${previous.goodMents.length}→${latest.goodMents.length}건으로 증가했습니다.`,
      );
    }
    if (latest.badMents.length < previous.badMents.length) {
      reasons.push(
        `Bad 멘트가 ${previous.badMents.length}→${latest.badMents.length}건으로 감소했습니다.`,
      );
    }
    if (latest.evaluatedCount !== previous.evaluatedCount) {
      reasons.push(
        `평가 건수는 ${previous.evaluatedCount}→${latest.evaluatedCount}건이었습니다.`,
      );
    }
  } else if (direction === 'down') {
    if (primaryDriver?.kind === 'unsat') {
      const count = latest.unsatTypeCounts.get(primaryDriver.text) ?? 0;
      reasons.push(
        `${primaryDriver.text} 유형 불만이 ${count}건으로 가장 많이 집계되었습니다.`,
      );
    }
    const secondUnsat = drivers.find((d, i) => i > 0 && d.kind === 'unsat');
    if (secondUnsat) {
      const count = latest.unsatTypeCounts.get(secondUnsat.text) ?? 0;
      reasons.push(`${secondUnsat.text} 유형 불만도 ${count}건으로 함께 나타났습니다.`);
    }
    if (latest.unsatisfiedCount > previous.unsatisfiedCount) {
      reasons.push(
        `불만족(N) 응답이 ${previous.unsatisfiedCount}→${latest.unsatisfiedCount}건으로 늘었습니다.`,
      );
    }
    const badDriver = drivers.find((d) => d.kind === 'bad');
    if (badDriver) {
      reasons.push(
        `${badDriver.text} Bad 멘트가 늘며 아쉬움 피드백이 만족도 하락에 영향을 준 것으로 보입니다.`,
      );
    } else if (latest.badMents.length > previous.badMents.length) {
      reasons.push(
        `Bad 멘트가 ${previous.badMents.length}→${latest.badMents.length}건으로 늘었습니다.`,
      );
    }
    if (latest.satisfiedCount < previous.satisfiedCount) {
      reasons.push(
        `만족(Y) 응답이 ${previous.satisfiedCount}→${latest.satisfiedCount}건으로 줄었습니다.`,
      );
    }
    if (latest.goodMents.length < previous.goodMents.length) {
      reasons.push(
        `Good 멘트가 ${previous.goodMents.length}→${latest.goodMents.length}건으로 감소했습니다.`,
      );
    }
    if (latest.evaluatedCount !== previous.evaluatedCount) {
      reasons.push(
        `평가 건수는 ${previous.evaluatedCount}→${latest.evaluatedCount}건이었습니다.`,
      );
    }
  } else {
    reasons.push('전일과 만족도 수준이 비슷해 뚜렷한 상·하락 요인이 없었습니다.');
    if (latest.evaluatedCount !== previous.evaluatedCount) {
      reasons.push(
        `평가 건수는 ${previous.evaluatedCount}→${latest.evaluatedCount}건이었습니다.`,
      );
    }
  }

  const unique = [...new Set(reasons.filter(Boolean))].slice(0, INSIGHT_REASON_LIMIT);
  if (!unique.length) {
    unique.push(
      direction === 'up'
        ? '만족 응답 비중이 커져 만족도가 상승했습니다.'
        : direction === 'down'
          ? '불만 응답이 늘어 만족도가 하락했습니다.'
          : '큰 변동 요인이 없었습니다.',
    );
  }

  return { driver: primaryDriver, drivers, reasons: unique };
}

function buildDayCompareInsight(latest, previous, direction) {
  return buildReasonFallback(latest, previous, direction);
}

function buildLatestTwoDayComparison(memberRowsData, unsatLabelMap) {
  const buckets = groupRowsByConsultDate(flattenMemberRows(memberRowsData));
  if (buckets.length === 0) return { status: 'empty' };
  if (buckets.length === 1) {
    const latest = buildDaySnapshot(buckets[0].date, buckets[0].rows, unsatLabelMap);
    return { status: 'single', latest };
  }

  const latest = buildDaySnapshot(buckets[0].date, buckets[0].rows, unsatLabelMap);
  const previous = buildDaySnapshot(buckets[1].date, buckets[1].rows, unsatLabelMap);
  if (latest.pct == null || previous.pct == null) {
    return { status: 'insufficient', latest, previous };
  }

  const deltaPp = latest.pct - previous.pct;
  const direction = deltaPp > 0.05 ? 'up' : deltaPp < -0.05 ? 'down' : 'flat';

  return {
    status: 'compare',
    latest,
    previous,
    deltaPp,
    direction,
    insight: buildDayCompareInsight(latest, previous, direction),
  };
}

const COACH_WINDOW_DAYS = 7;

/** 최근 N일 Good 멘트 — 상단 격려 섹션용 (중복 제거) */
function collectGoodMentHighlights(memberRowsData, dayLimit = COACH_WINDOW_DAYS) {
  const buckets = groupRowsByConsultDate(flattenMemberRows(memberRowsData));
  const items = [];
  const seen = new Set();

  buckets.slice(0, dayLimit).forEach(({ date, rows }) => {
    rows.forEach((row, idx) => {
      const text = String(row.goodMent ?? '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      items.push({
        id: `good-${date}-${row.id ?? idx}`,
        date,
        text,
      });
    });
  });

  return items;
}

/** AI 실패 시 Good 멘트 강점 요약 폴백 */
function buildGoodMentStrengthFallback(items) {
  if (!items?.length) return '';
  const corpus = items.map((it) => it.text).join(' ');
  const themes = [];
  if (/친절|상냥|친근|따뜻|미소|밝/.test(corpus)) themes.push('친절한 응대');
  if (/빠르|신속|즉|바로|급/.test(corpus)) themes.push('신속한 처리');
  if (/설명|안내|자세|이해|알기/.test(corpus)) themes.push('쉬운 설명·안내');
  if (/해결|처리|조치|도움|만족/.test(corpus)) themes.push('문제 해결');
  if (/전문|정확|꼼꼼|믿/.test(corpus)) themes.push('전문적 상담');

  const label = themes.length
    ? themes.slice(0, 2).join('·')
    : '긍정 피드백';
  return `최근 Good 멘트에서 ${label}가 고객에게 특히 호평받고 있어요.`;
}

/** 최근 N일 불만족 유형(1~5) — 탭·AI 코칭용 */
function buildCoachTypeTabs(memberRowsData, unsatLabelMap, dayLimit = COACH_WINDOW_DAYS) {
  const buckets = groupRowsByConsultDate(flattenMemberRows(memberRowsData));
  const typeMap = new Map();

  buckets.slice(0, dayLimit).forEach(({ date, rows }) => {
    rows.forEach((row) => {
      if (!isActiveUseYn(row)) return;
      if (String(row?.satisfiedYn ?? '').trim().toUpperCase() !== 'N') return;
      const code = toNum(row.dissatisfactionType);
      if (code == null || code < 1 || code > 5) return;

      const typeLabel = unsatTypeLabel(unsatLabelMap, code) || `유형 ${code}`;
      const badMent = String(row.badMent ?? '').trim();

      if (!typeMap.has(code)) {
        typeMap.set(code, {
          id: `type-${code}`,
          dissatisfactionType: code,
          typeLabel,
          count: 0,
          badMent: '',
          date: '',
        });
      }

      const entry = typeMap.get(code);
      entry.count += 1;
      if (!entry.badMent && badMent) {
        entry.badMent = badMent;
        entry.date = date;
      }
    });
  });

  return [...typeMap.values()]
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.dissatisfactionType - b.dissatisfactionType);
}

/** AI 실패 시 유형별 대응 피드백 폴백 */
function buildCoachScenarioFallback(typeLabel) {
  const label = String(typeLabel ?? '');
  if (/태도|응대|친절|말투|불친/.test(label)) {
    return {
      feedback: '먼저 감정을 확인하고, 짧게 사과한 뒤 조치·시간을 숫자로 안내하세요.',
      points: ['말투는 차분·존댓말 유지'],
    };
  }
  if (/지연|늦|대기|시간/.test(label)) {
    return {
      feedback: '지연 사과 후 현재 단계와 다음 연락 시각을 약속하세요.',
      points: ['“조금만” 대신 “○분 후 연락”'],
    };
  }
  if (/해결|미처리|처리|조치/.test(label)) {
    return {
      feedback: '원하는 결과를 확인하고, 가능·불가 조치와 일정을 나눠 말하세요.',
      points: ['처리 후 결과 재확인'],
    };
  }
  if (/안내|설명|정보|안내 부족/.test(label)) {
    return {
      feedback: '안내 부족을 인정하고, 쉬운 말로 단계별로 다시 설명하세요.',
      points: ['중간에 이해 여부 확인'],
    };
  }
  return {
    feedback: '불편에 공감하고, 확인·조치·일정을 짧게 안내하세요.',
    points: [],
  };
}

function renderHeroShortageValue(shortage, pending) {
  if (pending) return '…';
  if (shortage?.status === 'short') {
    return (
      <>
        <strong className="csx-hero-progress-stat-short">{numKo(shortage.count)}</strong>
        <span className="csx-hero-progress-stat-unit">건</span>
      </>
    );
  }
  if (shortage?.status === 'met') {
    return <strong className="csx-hero-progress-stat-met">달성</strong>;
  }
  if (shortage?.status === 'noTarget') {
    return <strong className="csx-hero-progress-stat-muted">목표 없음</strong>;
  }
  return <strong className="csx-hero-progress-stat-muted">—</strong>;
}

/** 히어로 — 원형 게이지 + 접수·만족·목표 필요 건수 */
function GaugeProgressSkeleton() {
  return (
    <div className="csx-hero-progress csx-hero-progress--skeleton" aria-hidden>
      <div className="csx-hero-progress-row">
        <Skeleton variant="circle" width={148} height={148} className="csx-hero-skel-gauge" />
        <div className="csx-hero-progress-side csx-hero-progress-side--skeleton">
          <div className="csx-hero-progress-stats csx-hero-progress-stats--skeleton">
            <Skeleton height={54} radius={10} />
            <Skeleton height={54} radius={10} />
            <Skeleton height={54} radius={10} />
          </div>
          <Skeleton height={34} radius={10} className="csx-hero-skel-badge" />
        </div>
      </div>
    </div>
  );
}

function resolvePanelRingStatus(met, shortageStatus) {
  if (met === true) return 'met';
  if (met === false) return 'no';
  if (shortageStatus === 'noTarget' || shortageStatus === 'noData') return 'muted';
  return 'neutral';
}

/** Apple 톤 공통 패널 세션 */
function PanelSessionShell({
  title,
  meta,
  children,
  skeleton = false,
  className = '',
  ringLoading = false,
  ringStatus = 'neutral',
}) {
  const ringClass = ringLoading ? ' csx-panel-session--ring' : '';
  const statusClass = !ringLoading
    ? ` csx-panel-session--status csx-panel-session--status-${ringStatus}`
    : '';

  return (
    <div
      className={`csx-panel-session${ringClass}${statusClass}${skeleton ? ' csx-panel-session--skeleton' : ''}${className ? ` ${className}` : ''}`}
    >
      <header className="csx-panel-session-head">
        {skeleton ? (
          <>
            <Skeleton width={108} height={14} radius={4} aria-hidden />
            <Skeleton width={48} height={12} radius={4} aria-hidden />
          </>
        ) : (
          <>
            <p className="csx-panel-session-title">{title}</p>
            {meta ? <span className="csx-panel-session-meta">{meta}</span> : null}
          </>
        )}
      </header>
      <div className="csx-panel-session-body">{children}</div>
    </div>
  );
}

/** 최근 만족도 AI 인사이트 — 토스형 스켈레톤 */
function AiTrendInsightSkeleton() {
  return (
    <section
      className="csx-panel-session-block"
      aria-busy="true"
      aria-label="AI 인사이트 불러오는 중"
    >
      <p className="csx-panel-session-kicker">최근 AI 인사이트</p>
      <div className="csx-toss-insight csx-toss-insight--skeleton">
        <header className="csx-toss-hero csx-toss-hero--skeleton">
          <Skeleton width={188} height={26} radius={6} className="csx-toss-skel-headline" />
          <Skeleton variant="text" width="88%" height={14} radius={4} />
        </header>
        <section className="csx-toss-why csx-toss-why--skeleton" aria-hidden>
          <Skeleton width={108} height={17} radius={4} className="csx-toss-skel-why-title" />
          <ul className="csx-toss-bullets csx-toss-bullets--skeleton">
            {[100, 94, 82].map((w) => (
              <li key={w} className="csx-toss-skel-bullet">
                <span className="csx-toss-skel-dot" aria-hidden />
                <Skeleton variant="text" width={`${w}%`} height={12} radius={4} />
              </li>
            ))}
          </ul>
        </section>
        <footer className="csx-toss-foot csx-toss-foot--skeleton">
          <Skeleton variant="text" width={88} height={11} radius={4} />
        </footer>
      </div>
    </section>
  );
}

/** ‘이렇게 하면 좋아요’ 대응 피드백 카드 스켈레톤 */
function CoachFeedbackSkeleton() {
  return (
    <div
      className="csx-coach-feedback csx-coach-feedback--skeleton"
      aria-busy="true"
      aria-label="대응 피드백 불러오는 중"
    >
      <div className="csx-coach-feedback-card csx-coach-feedback-card--skeleton">
        <span className="csx-coach-skel-type" aria-hidden>
          <Skeleton width={58} height={18} radius={999} />
        </span>
        <p className="csx-coach-feedback-kicker csx-coach-skel-kicker">이렇게 하면 좋아요</p>
        <div className="csx-coach-skel-main">
          <SkeletonLines lines={2} lineHeight={13} gap={7} lastWidth="76%" />
        </div>
        <ul className="csx-coach-feedback-points csx-coach-skel-points" aria-hidden>
          <li className="csx-coach-skel-point">
            <span className="csx-coach-skel-point-dot" aria-hidden />
            <Skeleton variant="text" width="90%" height={11} radius={4} />
          </li>
        </ul>
      </div>
      <p className="csx-coach-feedback-foot csx-coach-skel-foot" aria-hidden>
        <Skeleton variant="text" width={72} height={10} radius={4} />
      </p>
    </div>
  );
}

/** 코칭 세션 — Good 멘트 + AI 코칭 공통 껍데기 */
function CoachSessionShell({ children, skeleton = false }) {
  return (
    <PanelSessionShell
      title="AI 인사이트"
      meta={`최근 ${COACH_WINDOW_DAYS}일`}
      skeleton={skeleton}
    >
      {children}
    </PanelSessionShell>
  );
}

/** 대응 코칭 패널 전체 스켈레톤 */
function CoachPanelSkeleton() {
  return (
    <div className="csx-coach csx-coach--skeleton" aria-busy="true" aria-label="대응 코칭 불러오는 중">
      <CoachSessionShell skeleton>
        <div className="csx-coach-good-panel csx-coach-good-panel--skeleton" aria-hidden>
          <Skeleton width={72} height={13} radius={4} />
          <Skeleton variant="text" width="100%" height={13} radius={4} />
          <div className="csx-coach-good-badge csx-coach-good-badge--skeleton">
            <Skeleton width={58} height={20} radius={999} />
            <Skeleton variant="text" width="92%" height={13} radius={4} />
          </div>
        </div>
        <div className="csx-panel-session-divider" aria-hidden />
        <div className="csx-coach-ai-panel csx-coach-ai-panel--skeleton" aria-hidden>
          <Skeleton width={56} height={13} radius={4} />
          <div className="csx-coach-type-tabs csx-coach-type-tabs--skeleton">
            <Skeleton width={58} height={26} radius={999} />
            <Skeleton width={64} height={26} radius={999} />
          </div>
          <CoachFeedbackSkeleton />
        </div>
      </CoachSessionShell>
    </div>
  );
}

/** Good 멘트 — 잘하는 점 요약 + 대표 멘트 1건 */
function CoachGoodMentSection({ items, pending: dataPending }) {
  const exampleMent = items[0] ?? null;

  const goodAiQuery = useQuery({
    queryKey: [
      'cs-good-ment-insight',
      COACH_WINDOW_DAYS,
      items.map((it) => `${it.date}:${it.text.slice(0, 80)}`),
    ],
    queryFn: async ({ signal }) => {
      const raw = await fetchCsGoodMentInsight({
        items,
        dayLimit: COACH_WINDOW_DAYS,
        signal,
      });
      const parsed = parseGoodMentInsight(raw);
      if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다.');
      return parsed;
    },
    enabled: items.length > 0 && !dataPending,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const strengthPending = items.length > 0 && (goodAiQuery.isPending || goodAiQuery.isFetching);
  const strength = strengthPending
    ? null
    : goodAiQuery.data?.strength
    ?? (items.length ? buildGoodMentStrengthFallback(items) : null);
  const usedFallback = items.length > 0 && goodAiQuery.isError && !goodAiQuery.data;

  if (!items.length) {
    return (
      <p className="csx-coach-good-empty-inline" role="status">
        최근 {COACH_WINDOW_DAYS}일 Good 멘트가 아직 없어요.
      </p>
    );
  }

  return (
    <section className="csx-coach-good-panel" aria-label={`최근 ${COACH_WINDOW_DAYS}일 Good 멘트`}>
      <p className="csx-coach-good-kicker">Good 멘트</p>
      {strengthPending ? (
        <Skeleton variant="text" width="100%" height={14} radius={4} className="csx-coach-good-strength-skel" />
      ) : (
        <p className="csx-coach-good-strength">{strength}</p>
      )}
      {exampleMent ? (
        <div className="csx-coach-good-badge">
          <span className="csx-coach-good-badge-label">긍정 코멘트</span>
          <p className="csx-coach-good-badge-text">{`“${truncateMent(exampleMent.text, 56)}”`}</p>
          <span className="csx-coach-good-badge-date">{formatKoDate(exampleMent.date)}</span>
        </div>
      ) : null}
      <p className="csx-coach-good-foot">
        {usedFallback ? '기본 분석' : ''}
      </p>
    </section>
  );
}

/** 유형별 대응 피드백 */
function CoachTypeFeedback({ typeLabel, scenario, usedFallback }) {
  return (
    <div className="csx-coach-feedback">
      <div className="csx-coach-feedback-card">
        <span className="csx-coach-feedback-type">{typeLabel}</span>
        <p className="csx-coach-feedback-kicker">이렇게 하면 좋아요</p>
        <p className="csx-coach-feedback-main">{scenario.feedback}</p>
        {scenario.points.length > 0 ? (
          <ul className="csx-coach-feedback-points">
            {scenario.points.slice(0, COACH_FEEDBACK_POINTS_LIMIT).map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="csx-coach-feedback-foot">
        {usedFallback ? '기본 피드백' : ''}
      </p>
    </div>
  );
}

function handleCoachTypeTabsWheel(e) {
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth) return;
  el.scrollLeft += e.deltaY;
  e.preventDefault();
}

/** AI 코칭 — 불만유형 가로 스크롤 + 좌우 이동 버튼 */
function CoachTypeTabsScroller({ typeTabs, selectedId, onSelect }) {
  const scrollerRef = useRef(null);
  const [scrollEdge, setScrollEdge] = useState({ left: false, right: false });

  const updateScrollEdge = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 4) {
      setScrollEdge({ left: false, right: false });
      return;
    }
    setScrollEdge({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    updateScrollEdge();
    const el = scrollerRef.current;
    if (!el) return undefined;

    const rafId = requestAnimationFrame(updateScrollEdge);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollEdge)
      : null;
    observer?.observe(el);
    window.addEventListener('resize', updateScrollEdge);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollEdge);
    };
  }, [typeTabs, updateScrollEdge]);

  const scrollTabs = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(120, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
    window.setTimeout(updateScrollEdge, 320);
  };

  const { left: canScrollLeft, right: canScrollRight } = scrollEdge;

  return (
    <div className="csx-coach-type-scroll csx-coach-type-scroll--block">
      {canScrollLeft ? (
        <button
          type="button"
          className="csx-coach-type-scroll-btn"
          aria-label="이전 불만족 유형"
          onClick={() => scrollTabs(-1)}
        >
          <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
        </button>
      ) : null}
      <div
        ref={scrollerRef}
        className="csx-coach-type-tabs"
        role="tablist"
        aria-label={`최근 ${COACH_WINDOW_DAYS}일 불만족 유형`}
        onScroll={updateScrollEdge}
        onWheel={handleCoachTypeTabsWheel}
      >
        {typeTabs.map((tab) => {
          const active = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`csx-coach-tab-${tab.id}`}
              className={`csx-coach-type-chip${active ? ' is-active' : ''}`}
              aria-selected={active}
              onClick={() => onSelect(tab.id)}
            >
              <span className="csx-coach-type-chip-label">{tab.typeLabel}</span>
            </button>
          );
        })}
      </div>
      {canScrollRight ? (
        <button
          type="button"
          className="csx-coach-type-scroll-btn"
          aria-label="다음 불만족 유형"
          onClick={() => scrollTabs(1)}
        >
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** 대응 코칭 — Good 멘트(상단) + 불만유형 탭·AI 가이드(하단) */
function ResponseCoachPanel({ goodMentPool, typeTabs, pending: dataPending }) {
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!typeTabs.length) {
      setSelectedId(null);
      return;
    }
    if (!typeTabs.some((t) => t.id === selectedId)) {
      setSelectedId(typeTabs[0].id);
    }
  }, [typeTabs, selectedId]);

  const selected = typeTabs.find((t) => t.id === selectedId) ?? null;

  const coachAiQuery = useQuery({
    queryKey: ['cs-coach-ai', selected?.id, selected?.typeLabel, selected?.badMent, selected?.date],
    queryFn: async ({ signal }) => {
      const raw = await fetchCsCoachScenario({
        typeLabel: selected.typeLabel,
        badMent: selected.badMent,
        date: selected.date,
        signal,
      });
      const parsed = parseCoachScenario(raw);
      if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다.');
      return parsed;
    },
    enabled: !!selected && !dataPending,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const scenarioPending = !!selected && (coachAiQuery.isPending || coachAiQuery.isFetching);
  const scenario = scenarioPending
    ? null
    : coachAiQuery.data
    ?? (coachAiQuery.isError && selected ? buildCoachScenarioFallback(selected.typeLabel) : null);
  const scenarioUsedFallback = !!selected && coachAiQuery.isError && !coachAiQuery.data;

  if (dataPending) {
    return <CoachPanelSkeleton />;
  }

  const hasTabs = typeTabs.length > 0;

  return (
    <div className="csx-coach" role="region" aria-label="대응 코칭">
      <CoachSessionShell>
        <CoachGoodMentSection items={goodMentPool} pending={dataPending} />

        <div className="csx-panel-session-divider" aria-hidden />

        {hasTabs ? (
          <section className="csx-coach-ai-panel" aria-label="AI 코칭">
            <p className="csx-coach-ai-kicker">불만족 유형</p>
            <CoachTypeTabsScroller
              typeTabs={typeTabs}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && scenarioPending ? (
              <CoachFeedbackSkeleton />
            ) : selected && scenario ? (
              <CoachTypeFeedback
                typeLabel={selected.typeLabel}
                scenario={scenario}
                usedFallback={scenarioUsedFallback}
              />
            ) : null}
          </section>
        ) : (
          <div className="csx-coach--empty-inline" role="status">
            <p className="csx-coach-empty-title">최근 {COACH_WINDOW_DAYS}일 불만족 유형이 없어요</p>
            <p className="csx-coach-empty-sub">
              불만족 유형이 수집되면 대응 가이드를 제안해 드립니다.
            </p>
          </div>
        )}
      </CoachSessionShell>
    </div>
  );
}

/** 홈 YOU PRO와 동일 스타일 · CS 만족도 워드마크 */
function CsSatisfactionIntroLogo() {
  return (
    <svg
      className="hp-intro-logo csx-intro-logo"
      viewBox="0 0 200 56"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <title>CS 만족도</title>
      <defs>
        <linearGradient id="csx-logo-cs-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#3182F6" />
        </linearGradient>
        <linearGradient id="csx-logo-sat-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3182F6" />
          <stop offset="100%" stopColor="#1F5FCC" />
        </linearGradient>
        <filter id="csx-logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="hp-intro-logo-spark hp-intro-logo-spark--lead csx-intro-logo-spark" transform="translate(2 12)">
        <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
      </g>
      <text
        className="hp-intro-logo-you"
        x="20"
        y="34"
        dominantBaseline="middle"
        fill="url(#csx-logo-cs-grad)"
        filter="url(#csx-logo-glow)"
      >
        CS
      </text>
      <text
        className="hp-intro-logo-pro csx-intro-logo-sat"
        x="64"
        y="34"
        dominantBaseline="middle"
        fill="url(#csx-logo-sat-grad)"
        filter="url(#csx-logo-glow)"
      >
        만족도
      </text>
      <g className="hp-intro-logo-spark hp-intro-logo-spark--trail csx-intro-logo-spark" transform="translate(166 12)">
        <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" />
      </g>
      <path className="hp-intro-logo-line-brand" d="M20 50 L130 50" />
      <path className="hp-intro-logo-line-accent" d="M134 50 L176 50" />
      <circle className="hp-intro-logo-line-dot csx-intro-logo-line-dot" cx="132" cy="50" r="1.8" />
    </svg>
  );
}

function CsPageIntro({ skill, name, loading = false }) {
  const displayName = name?.trim() ? name.trim() : '구성원';

  return (
    <header className={`hp-intro${loading ? ' hp-intro--loading' : ''}`}>
      <div className="hp-intro-main">
        <div className="hp-intro-text">
          <h1 className="hp-intro-title" aria-label="CS 만족도">
            {loading ? (
              <Skeleton width={156} height={44} radius={8} />
            ) : (
              <CsSatisfactionIntroLogo />
            )}
          </h1>
          {loading ? (
            <Skeleton variant="text" width={280} height={14} radius={6} />
          ) : (
            <p className="hp-intro-line" aria-label="구성원 정보">
              <strong className="hp-intro-name">{displayName}</strong>님
              <span className="hp-intro-sep" aria-hidden>·</span>
              <span className="csx-header-skill-badge">{skill || '스킬 미지정'}</span>
              <span className="hp-intro-sep" aria-hidden>·</span>
              <span className="hp-intro-slogan">{CS_SAT_SLOGAN}</span>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   히어로 스켈레톤
   ════════════════════════════════════════════════════════════ */
function HeroSkeleton() {
  return (
    <>
      <section className="csx-session csx-session--primary">
        <section className="csx-hero csx-hero--unified">
          <span className="csx-corner-tr" aria-hidden />
          <span className="csx-corner-bl" aria-hidden />
          <div className="csx-hero-topbar" aria-hidden>
            <Skeleton width={72} height={24} radius={999} />
          </div>
          <div className="csx-hero-highlight csx-hero-highlight--integrated">
            <div
              className="csx-ai-insight csx-ai-insight--skeleton csx-ai-insight--toss csx-ai-insight--split csx-ai-insight--lr"
              aria-hidden
            >
              <div className="csx-ai-insight-split">
                <div className="csx-ai-insight-col csx-ai-insight-col--left">
                  <PanelSessionShell title="만족도 · AI 인사이트" meta="…" skeleton ringLoading ringStatus="neutral">
                    <GaugeProgressSkeleton />
                    <div className="csx-panel-session-divider" aria-hidden />
                    <AiTrendInsightSkeleton />
                  </PanelSessionShell>
                </div>
                <div className="csx-ai-insight-divider" aria-hidden />
                <div className="csx-ai-insight-col csx-ai-insight-col--coach">
                  <CoachPanelSkeleton />
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
      <section className="csx-session csx-session--secondary csx-session--skeleton csx-session--rates" aria-hidden>
        <span className="csx-corner-tr" aria-hidden />
        <span className="csx-corner-bl" aria-hidden />
        <Skeleton variant="text" width={140} height={18} />
        <Skeleton variant="text" width="95%" height={12} style={{ marginTop: 6 }} />
        <div className="csx-rates-dual-layout csx-rates-dual-layout--compact csx-rates-dual-layout--skeleton">
          <div className="csx-rates-dual-col csx-rates-dual-col--focus">
            <Skeleton width={64} height={11} radius={4} style={{ marginBottom: 5 }} />
            <ul className="csx-rate-deck csx-rate-deck--focus-row csx-rate-deck--skeleton" aria-hidden>
              {[0, 1, 2].map((i) => (
                <li key={i} className="csx-rate-deck-item">
                  <Skeleton height="100%" radius={9} style={{ minHeight: 96 }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="csx-rates-dual-divider" aria-hidden />
          <div className="csx-rates-dual-col csx-rates-dual-col--untype">
            <Skeleton height={132} radius={10} />
          </div>
        </div>
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
  const ringR = size === 'large' ? 84 : size === 'compact' ? 50 : 72;
  const ringStroke = size === 'large' ? 11 : size === 'compact' ? 8 : 10;
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
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#fb7185" />
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
              : met === false
                ? 'drop-shadow(0 0 5px rgba(225,29,72,0.42))'
                : 'drop-shadow(0 0 5px rgba(100,116,139,0.35))',
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
            stroke={met === true ? '#059669' : met === false ? '#e11d48' : '#94a3b8'}
            strokeWidth={2.5}
          />
        );
      })()}
    </svg>
  );
}

/** 일자별 만족도 비교 — 토스 스타일 + YOU PRO AI 불릿 */
function DayOverDayInsightPanel({
  comparison,
  aiInsight,
  aiBulletsPending,
  aiUsedFallback,
}) {
  if (comparison.status === 'empty') {
    return (
      <div className="csx-toss-insight csx-toss-insight--compact" role="status">
        <InsightReasonList
          reasons={[]}
          emptyMessage="비교할 일별 만족도 데이터가 아직 없습니다."
        />
      </div>
    );
  }

  if (comparison.status === 'single') {
    const { latest } = comparison;
    return (
      <div className="csx-toss-insight" role="region" aria-label="최근 일자 만족도">
        <header className="csx-toss-hero">
          <h3 className="csx-toss-headline">
            만족도 <span className="csx-toss-delta csx-toss-delta--flat">{fmt(latest.pct)}%</span>
          </h3>
          <p className="csx-toss-meta">
            최근 일자 {formatKoDate(latest.date)} · 평가 {numKo(latest.evaluatedCount)}건
          </p>
        </header>
        <InsightReasonList
          reasons={[]}
          emptyMessage="이전 일자와 비교하려면 최소 2일의 평가 데이터가 필요합니다."
          listClassName="csx-toss-bullets--inline"
        />
      </div>
    );
  }

  if (comparison.status === 'insufficient') {
    return (
      <div className="csx-toss-insight csx-toss-insight--compact" role="status">
        <InsightReasonList
          reasons={[]}
          emptyMessage="최근 두 일자의 만족도를 계산할 수 있는 평가 건이 부족합니다."
        />
      </div>
    );
  }

  const {
    latest, previous, deltaPp, direction, insight: fallbackInsight,
  } = comparison;
  const isUp = direction === 'up';
  const isDown = direction === 'down';
  const deltaMod = isUp ? 'up' : isDown ? 'down' : 'flat';
  const deltaLabel = isUp ? '증가' : isDown ? '감소' : '유지';
  const whyTitle = isUp ? '왜 올랐을까?' : isDown ? '왜 내렸을까?' : '변동 요약';
  const fallbackDrivers = fallbackInsight?.drivers
    ?? (fallbackInsight?.driver ? [fallbackInsight.driver] : []);
  const highlightDrivers = fallbackDrivers.length
    ? fallbackDrivers
    : pickInsightDrivers(latest, previous, direction);
  const displayReasons = mergeInsightReasons(
    aiInsight?.reasons,
    fallbackInsight?.reasons,
  );

  return (
    <div className="csx-toss-insight" role="region" aria-label="일자별 만족도 비교 인사이트">
      <header className="csx-toss-hero">
        <h3 className="csx-toss-headline">
          최근 만족도{' '}
          <span className={`csx-toss-delta csx-toss-delta--${deltaMod}`}>
            {fmt(Math.abs(deltaPp))}% {deltaLabel}
          </span>
        </h3>
        <p className="csx-toss-meta">
          <span className="csx-toss-meta-prev">
            {formatKoDate(previous.date)} {fmt(previous.pct)}%
          </span>
          <ArrowRight size={12} strokeWidth={2.4} className="csx-toss-meta-arrow" aria-hidden />
          <strong className="csx-toss-meta-strong csx-toss-meta-current">
            {formatKoDate(latest.date)} {fmt(latest.pct)}%
          </strong>
        </p>
      </header>

      <section className="csx-toss-why" aria-labelledby="csx-toss-why-title">
        <h4 id="csx-toss-why-title" className="csx-toss-why-title">
          {whyTitle}
        </h4>
        <InsightReasonList
          reasons={displayReasons}
          drivers={highlightDrivers}
          pending={aiBulletsPending}
          emptyMessage="원인을 분석할 데이터가 부족합니다."
        />
        {aiUsedFallback ? (
          <p className="csx-toss-ai-fallback" role="status">AI 연결 실패 — 기본 분석을 표시합니다.</p>
        ) : null}
      </section>

      <footer className="csx-toss-foot">
        <p className="csx-toss-ai-source">YOU PRO AI 분석</p>
      </footer>
    </div>
  );
}

/** 스킬 만족도 목표 달성 여부 */
function SkillAchievementBadge({ met, skill, shortage }) {
  const statusMod = met === true ? 'met' : met === false ? 'no' : 'none';
  const badgeText = met === true
    ? `${skill ? `${skill} ` : ''}만족도 목표 달성`
    : met === false
      ? `${skill ? `${skill} ` : ''}만족도 목표 미달성`
      : shortage.status === 'noData'
        ? '접수 대기'
        : shortage.status === 'noTarget'
          ? '목표 미설정'
          : '집계 전';

  return (
    <div
      className={`csx-achieve-badge csx-achieve-badge--${statusMod} csx-skill-achieve-badge`}
      role="status"
      aria-label={met === true ? '목표 달성' : met === false ? '목표 미달성' : '집계 전'}
    >
      <span className="csx-achieve-badge-icon" aria-hidden>
        {met === true ? (
          <CheckCircle2 size={18} strokeWidth={2.4} />
        ) : met === false ? (
          <AlertCircle size={18} strokeWidth={2.4} />
        ) : (
          <Inbox size={18} strokeWidth={2.4} />
        )}
      </span>
      <span className="csx-achieve-badge-text">{badgeText}</span>
    </div>
  );
}

/** 당월 만족도 진행 — 원형 게이지 */
function SatisfactionProgressSection({
  actualPct,
  target,
  met,
  animatedActualPct,
  month,
  intakeStats,
  statsPending,
  skill,
  shortage,
}) {
  const statusMod = met === true ? 'met' : met === false ? 'no' : 'none';
  const hasTarget = target != null && target > 0;
  const displayActual = actualPct != null ? fmt(animatedActualPct) : null;
  const { totalReceived, satisfiedCount } = intakeStats ?? {
    totalReceived: 0,
    satisfiedCount: 0,
  };

  return (
    <section className="csx-hero-progress" aria-label="당월 만족도 진행">
      <div className="csx-hero-progress-row">
        <div className={`csx-gauge-wrap csx-gauge-wrap--${statusMod} csx-hero-progress-gauge`}>
          <GaugeRing
            actual={animatedActualPct}
            target={target}
            met={met}
            size="default"
          />
          <div className="csx-gauge-center csx-gauge-center--hero">
            <p className="csx-gauge-period">{month}월</p>
            <div className="csx-gauge-value">
              <span className={`csx-gauge-num csx-gauge-num--${statusMod} csx-gauge-num--hero`}>
                {displayActual ?? '—'}
              </span>
              <span className="csx-gauge-unit csx-gauge-unit--hero">%</span>
            </div>
            {hasTarget ? (
              <p className="csx-gauge-target csx-gauge-target--hero">
                목표 <strong>{fmt(target)}%</strong>
              </p>
            ) : (
              <p className="csx-gauge-target csx-gauge-target--hero csx-gauge-target--muted">
                목표 미설정
              </p>
            )}
          </div>
        </div>

        <div className="csx-hero-progress-side">
          <dl className="csx-hero-progress-stats" aria-label="당월 접수·만족·목표 필요 건수">
            <div className="csx-hero-progress-stat csx-hero-progress-stat--recv">
              <dt>접수건수</dt>
              <dd>
                {statsPending ? '…' : (
                  <>
                    <strong>{numKo(totalReceived)}</strong>
                    <span className="csx-hero-progress-stat-unit">건</span>
                  </>
                )}
              </dd>
            </div>
            <div className="csx-hero-progress-stat csx-hero-progress-stat--sat">
              <dt>만족건수</dt>
              <dd>
                {statsPending ? '…' : (
                  <>
                    <strong className="csx-hero-progress-stat-sat">
                      {numKo(satisfiedCount)}
                    </strong>
                    <span className="csx-hero-progress-stat-unit">건</span>
                  </>
                )}
              </dd>
            </div>
            <div className="csx-hero-progress-stat csx-hero-progress-stat--shortage">
              <dt>목표 달성 필요 건수</dt>
              <dd>{renderHeroShortageValue(shortage, statsPending)}</dd>
            </div>
          </dl>
          <SkillAchievementBadge met={met} skill={skill} shortage={shortage} />
        </div>

      </div>
    </section>
  );
}

function CsAiInsight({
  memberRowsData,
  memberRowsPending,
  unsatTypeLabelMap,
  fallbackContent,
  shortageStatus,
  actualPct,
  target,
  met,
  animatedActualPct,
  skill,
  shortage,
  month,
  satData,
}) {
  const intakeStats = useMemo(
    () => getMonthIntakeStats(memberRowsData, month, satData),
    [memberRowsData, month, satData],
  );

  const comparison = useMemo(
    () => buildLatestTwoDayComparison(memberRowsData, unsatTypeLabelMap),
    [memberRowsData, unsatTypeLabelMap],
  );

  const coachGoodMentPool = useMemo(
    () => collectGoodMentHighlights(memberRowsData, COACH_WINDOW_DAYS),
    [memberRowsData],
  );

  const coachTypeTabs = useMemo(
    () => buildCoachTypeTabs(memberRowsData, unsatTypeLabelMap, COACH_WINDOW_DAYS),
    [memberRowsData, unsatTypeLabelMap],
  );

  const mod = shortageStatus === 'met' ? 'met'
    : shortageStatus === 'short' ? 'short'
      : ['noData', 'noTarget'].includes(shortageStatus) ? 'muted' : 'neutral';

  const canFetchDayAi = comparison.status === 'compare' && !memberRowsPending;

  const dayAiQuery = useQuery({
    queryKey: [
      'cs-day-over-day-ai',
      comparison.latest?.date,
      comparison.previous?.date,
      comparison.latest?.pct,
      comparison.previous?.pct,
      comparison.direction,
    ],
    queryFn: async ({ signal }) => {
      const raw = await fetchCsDayOverDayInsight({
        latest: comparison.latest,
        previous: comparison.previous,
        direction: comparison.direction,
        deltaPp: comparison.deltaPp,
        signal,
      });
      const parsed = parseDayOverDayInsight(raw);
      if (!parsed) throw new Error('AI 응답을 해석하지 못했습니다.');
      return parsed;
    },
    enabled: canFetchDayAi,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const aiInsight = dayAiQuery.data ?? null;
  const aiBulletsPending = canFetchDayAi && (dayAiQuery.isPending || dayAiQuery.isFetching);
  const aiUsedFallback = canFetchDayAi && dayAiQuery.isError && !dayAiQuery.data;
  const panelRingLoading = memberRowsPending || aiBulletsPending;
  const panelRingStatus = resolvePanelRingStatus(met, shortageStatus);

  return (
    <aside
      className={`csx-ai-insight csx-ai-insight--${mod} csx-ai-insight--toss csx-ai-insight--split csx-ai-insight--lr`}
      aria-label="만족도 진행 및 AI 인사이트"
    >
      <div className={`csx-ai-insight-split${memberRowsPending ? ' csx-ai-insight-split--loading' : ''}`}>
        <div className="csx-ai-insight-col csx-ai-insight-col--left">
          <PanelSessionShell
            title="만족도 현황"
            meta={`${month}월`}
            ringLoading={panelRingLoading}
            ringStatus={panelRingStatus}
          >
            <SatisfactionProgressSection
              actualPct={actualPct}
              target={target}
              met={met}
              animatedActualPct={animatedActualPct}
              month={month}
              intakeStats={intakeStats}
              statsPending={false}
              skill={skill}
              shortage={shortage}
            />
            <div className="csx-panel-session-divider" aria-hidden />
            {memberRowsPending ? (
              <AiTrendInsightSkeleton />
            ) : (
              <section className="csx-panel-session-block" aria-label="최근 AI 인사이트">
                {comparison.status === 'compare' || comparison.status === 'single' ? (
                  <DayOverDayInsightPanel
                    comparison={comparison}
                    aiInsight={aiInsight}
                    aiBulletsPending={aiBulletsPending}
                    aiUsedFallback={aiUsedFallback}
                  />
                ) : (
                  <>
                    <DayOverDayInsightPanel
                      comparison={comparison}
                      aiInsight={aiInsight}
                      aiBulletsPending={aiBulletsPending}
                      aiUsedFallback={aiUsedFallback}
                    />
                    <div className="csx-ai-insight-fallback-wrap">{fallbackContent}</div>
                  </>
                )}
              </section>
            )}
          </PanelSessionShell>
        </div>
        <div className="csx-ai-insight-divider" aria-hidden />
        <div className="csx-ai-insight-col csx-ai-insight-col--coach">
          <ResponseCoachPanel
            goodMentPool={memberRowsPending ? [] : coachGoodMentPool}
            typeTabs={memberRowsPending ? [] : coachTypeTabs}
            pending={memberRowsPending}
          />
        </div>
      </div>
    </aside>
  );
}


const DEFAULT_MODAL_FILTERS = {
  satisfiedYn: 'ALL',
  fiveMajorCitiesYn: 'ALL',
  gen5060Yn: 'ALL',
  problemResolvedYn: 'ALL',
  dissatisfactionType: null,
};

function buildUnsatTypeModalFilter(dissatisfactionType) {
  return {
    ...DEFAULT_MODAL_FILTERS,
    satisfiedYn: 'N',
    dissatisfactionType,
  };
}

const RATE_CARD_FILTERS = {
  sat: { ...DEFAULT_MODAL_FILTERS, satisfiedYn: 'Y' },
  unsat: { ...DEFAULT_MODAL_FILTERS, satisfiedYn: 'N' },
  five: { ...DEFAULT_MODAL_FILTERS, fiveMajorCitiesYn: 'Y' },
  gen: { ...DEFAULT_MODAL_FILTERS, gen5060Yn: 'Y' },
  solve: { ...DEFAULT_MODAL_FILTERS, problemResolvedYn: 'Y' },
};

/* ════════════════════════════════════════════════════════════
   만족도 현황 — 중점추진과제 3종(%)
   ════════════════════════════════════════════════════════════ */
function SatisfactionRateDeck({
  data,
  received,
  onOpenFiltered,
}) {
  const d = data ?? {};
  const hasBase = received > 0;

  const focusItems = [
    {
      key: 'five',
      label: '5대도시',
      sub: '',
      field: 'fiveMajorCitiesPct',
      targetField: 'fiveMajorCitiesTargetPct',
      metKind: 'higher',
      mod: 'five',
      Icon: MapPinned,
      filter: RATE_CARD_FILTERS.five,
    },
    {
      key: 'gen',
      label: '5060',
      sub: '',
      field: 'gen5060Pct',
      targetField: 'gen5060TargetPct',
      metKind: 'higher',
      mod: 'gen',
      Icon: UserCircle2,
      filter: RATE_CARD_FILTERS.gen,
    },
    {
      key: 'solve',
      label: '문제해결',
      sub: '',
      field: 'problemResolvedPct',
      targetField: 'problemResolvedTargetPct',
      metKind: 'lower',
      mod: 'solve',
      Icon: CheckCircle2,
      filter: RATE_CARD_FILTERS.solve,
    },
  ];

  const renderFocusCard = (it) => {
    const Icon = it.Icon;
    const raw = hasBase ? toNum(d[it.field]) : null;
    const display = raw == null || Number.isNaN(raw) ? '—' : `${fmt(raw)}%`;
    const width = raw != null && !Number.isNaN(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    const itemTarget = toNum(d[it.targetField]);
    const focusMet = it.metKind === 'lower'
      ? computeProblemFocusMet(raw, itemTarget)
      : computeFocusMetricMet(raw, itemTarget);
    const statusMod = focusMet === true ? 'met' : focusMet === false ? 'no' : 'none';

    const targetText = itemTarget != null && itemTarget > 0 ? (
      <>
        목표{' '}
        <strong className="csx-rate-card-target-val">{fmt(itemTarget)}%</strong>
      </>
    ) : (
      <span className="csx-rate-card-target-muted">목표 미설정</span>
    );

    const hasTarget = itemTarget != null && itemTarget > 0;
    const pctStatusMod = hasTarget ? statusMod : 'none';

    return (
      <li key={it.key} className="csx-rate-deck-item">
        <button
          type="button"
          className={`csx-rate-card csx-rate-card--${it.mod}${hasTarget ? ` csx-rate-card--status-${statusMod}` : ''}`}
          onClick={() => onOpenFiltered(it.filter)}
        >
          <span className="csx-rate-card-icon" aria-hidden>
            <Icon size={16} strokeWidth={2.2} />
          </span>
          <span className="csx-rate-card-main">
            <span className="csx-rate-card-top">
              <span className="csx-rate-card-label">{it.label}</span>
              <span
                className={`csx-rate-card-pct csx-rate-card-pct--${pctStatusMod}`}
                title={it.sub}
                aria-label={
                  hasTarget && focusMet != null
                    ? `${it.label} ${display}, 목표 ${focusMet ? '달성' : '미달성'}`
                    : undefined
                }
              >
                {display}
              </span>
            </span>
            {hasBase && raw != null && !Number.isNaN(raw) ? (
              <span className="csx-rate-meter" aria-hidden>
                <span className="csx-rate-meter-fill" style={{ width: `${width}%` }} />
              </span>
            ) : null}
            <span className="csx-rate-card-target">{targetText}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <ul className="csx-rate-deck csx-rate-deck--focus csx-rate-deck--focus-row" aria-label="중점추진과제">
      {focusItems.map(renderFocusCard)}
    </ul>
  );
}

/**
 * unsatisfiedCategories의 dissatisfactionType(코드) → label 맵을 만든다.
 * row.dissatisfactionType("1"~"5" 문자열)을 라벨로 환원하는 데 사용.
 */
function buildUnsatTypeLabelMap(data) {
  const raw = Array.isArray(data?.unsatisfiedCategories) ? data.unsatisfiedCategories : [];
  const map = new Map();
  raw.forEach((c) => {
    const code = toNum(c?.dissatisfactionType);
    if (code == null) return;
    const label = String(c?.label ?? '').trim() || `유형 ${code}`;
    map.set(code, label);
  });
  return map;
}

function unsatTypeLabel(map, rawType) {
  const code = toNum(rawType);
  // 유효 유형은 1~5뿐. 0·null·범위 밖은 미분류 → 라벨 없음.
  if (code == null || code < 1 || code > 5) return null;
  return map.get(code) ?? `유형 ${code}`;
}

/* ════════════════════════════════════════════════════════════
   불만족 유형 — 3행 2열 그리드
   ════════════════════════════════════════════════════════════ */
function chunkUnsatTypeRows(items, cols = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

function UnsatisfiedTypeDeck({ data, month, onOpenFiltered }) {
  const d = data ?? {};
  const raw = Array.isArray(d.unsatisfiedCategories) ? d.unsatisfiedCategories : [];

  const items = raw.slice(0, 5).map((c, i) => ({
    label: String(c?.label ?? `유형 ${i + 1}`).trim() || `유형 ${i + 1}`,
    count: toNum(c?.count, 0) ?? 0,
    dissatisfactionType: toNum(c?.dissatisfactionType),
  }));

  const rows = chunkUnsatTypeRows(items, 2);

  return (
    <section
      className={`csx-untype csx-untype--panel${items.length === 0 ? ' csx-untype--empty' : ''}`}
      aria-label="당월 불만족 유형별 건수"
    >
      <header className="csx-untype-head">
        <h3 className="csx-untype-title">불만족 유형</h3>
        <span className="csx-untype-total">당월 기준</span>
      </header>
      {items.length === 0 ? (
        <p className="csx-untype-empty">당월 불만족 유형 집계가 없습니다.</p>
      ) : (
        <div className="csx-untype-rows">
          {rows.map((rowItems, rowIdx) => (
            <ul
              key={`untype-row-${rowIdx}`}
              className="csx-untype-row csx-untype-row--2"
              aria-label={`불만족 유형 ${rowIdx + 1}행`}
            >
              {rowItems.map((it) => (
                <li key={it.dissatisfactionType ?? it.label}>
                  <button
                    type="button"
                    className="csx-untype-item"
                    onClick={() => {
                      if (it.dissatisfactionType == null || !onOpenFiltered) return;
                      onOpenFiltered(buildUnsatTypeModalFilter(it.dissatisfactionType));
                    }}
                    disabled={it.dissatisfactionType == null || !onOpenFiltered}
                    aria-label={`${it.label} ${numKo(it.count)}건 상세 보기`}
                  >
                    <span className="csx-untype-item-label" title={it.label}>{it.label}</span>
                    <span className="csx-untype-item-count">
                      {numKo(it.count)}<span className="csx-untype-item-unit">건</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   하단 세션 — 만족도 현황 (%)
   ════════════════════════════════════════════════════════════ */
function ReceptionFocusSection({
  data,
  onShowAll,
  onOpenFiltered,
  month,
}) {
  const d = data ?? {};
  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;

  return (
    <section
      className="csx-session csx-session--secondary csx-session--rates"
      aria-labelledby="csx-session-reception-focus-title"
    >
      <span className="csx-corner-tr" aria-hidden />
      <span className="csx-corner-bl" aria-hidden />
      <header className="csx-session-head-main csx-session-head-main--rates">
        <h2 id="csx-session-reception-focus-title" className="csx-hero-chip csx-hero-chip--skill">
          {month}월 만족도 상세 현황
        </h2>
      </header>

      <div className="csx-rates-dual-layout csx-rates-dual-layout--compact">
        <div className="csx-rates-dual-col csx-rates-dual-col--focus">
          <p className="csx-rates-col-kicker">중점추진과제</p>
          <SatisfactionRateDeck
            data={d}
            received={received}
            onOpenFiltered={onOpenFiltered}
          />
        </div>
        <div className="csx-rates-dual-divider" aria-hidden />
        <div className="csx-rates-dual-col csx-rates-dual-col--untype">
          <UnsatisfiedTypeDeck data={d} month={month} onOpenFiltered={onOpenFiltered} />
        </div>
      </div>

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
  month,
  memberRowsData,
  memberRowsPending,
  unsatTypeLabelMap,
  skill,
}) {
  const d = data ?? {};
  const actualPct = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  const met = computeMet(d);

  const animatedActualPct = useCountUpFloat(actualPct ?? 0, 1300);

  const intakeStats = useMemo(
    () => getMonthIntakeStats(memberRowsData, month, d),
    [memberRowsData, month, d],
  );
  const shortage = computeShortageVsTarget(d, intakeStats);

  const fallbackInsight = (() => {
    switch (shortage.status) {
      case 'met':
        return (
          <ul className="csx-toss-bullets csx-ai-insight-fallback-list">
            <li className="csx-toss-bullet csx-toss-bullet--reason">
              목표 <strong>달성</strong>. 긍정 피드백을 이어가 보세요.
            </li>
          </ul>
        );
      case 'short':
        return (
          <ul className="csx-toss-bullets csx-ai-insight-fallback-list">
            <li className="csx-toss-bullet csx-toss-bullet--reason">
              만족 <strong className="csx-hero-kpi-ai-strong">{shortage.count}건</strong> 더 필요합니다.
            </li>
          </ul>
        );
      case 'noData':
        return (
          <ul className="csx-toss-bullets csx-ai-insight-fallback-list">
            <li className="csx-toss-bullet csx-toss-bullet--reason">이번 달 접수가 없습니다.</li>
          </ul>
        );
      case 'noTarget':
      default:
        return (
          <ul className="csx-toss-bullets csx-ai-insight-fallback-list">
            <li className="csx-toss-bullet csx-toss-bullet--reason">당월 목표%가 없습니다.</li>
          </ul>
        );
    }
  })();

  return (
    <section className="csx-hero csx-hero--unified">
      <span className="csx-corner-tr" aria-hidden />
      <span className="csx-corner-bl" aria-hidden />
      <div className="csx-hero-topbar csx-hero-topbar--solo">
        <span className="csx-hero-chip csx-hero-chip--skill">
          {month}월 만족도 현황 · AI 인사이트
        </span>
      </div>

      <div className="csx-hero-highlight csx-hero-highlight--integrated">
        <CsAiInsight
          memberRowsData={memberRowsData}
          memberRowsPending={memberRowsPending}
          unsatTypeLabelMap={unsatTypeLabelMap}
          fallbackContent={fallbackInsight}
          shortageStatus={shortage.status}
          actualPct={actualPct}
          target={target}
          met={met}
          animatedActualPct={animatedActualPct}
          skill={skill}
          shortage={shortage}
          month={month}
          satData={d}
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
  const [modalMonthKey, setModalMonthKey] = useState(currentMonthKey);
  /** null = 월 전체, yyyy-MM-dd = 해당 일자만 */
  const [modalDayFilterKey, setModalDayFilterKey] = useState(null);
  const [modalDayPickerOpen, setModalDayPickerOpen] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalYnFilters, setModalYnFilters] = useState(() => ({ ...DEFAULT_MODAL_FILTERS }));

  const openDetailModal = useCallback((filters = DEFAULT_MODAL_FILTERS) => {
    setModalMonthKey(monthKeyFromParts(year, month));
    setModalDayFilterKey(null);
    setModalDayPickerOpen(false);
    setModalPage(1);
    setModalYnFilters({ ...filters });
    setShowModal(true);
  }, [year, month]);

  const satQuery = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = satQuery.data ?? null;

  const unsatTypeLabelMap = useMemo(
    () => buildUnsatTypeLabelMap(satData),
    [satData],
  );

  const memberRowsQuery = useQuery({
    queryKey: ['member-sat-rows', user?.skid, year],
    queryFn: () => fetchCsSatisfactionMemberMonthlyRows(user.skid, year),
    enabled: !!user?.skid && !!satData && !satQuery.isError,
    staleTime: 60_000,
  });

  /* ── 모달 파생 데이터 ── */
  const allMemberRows = useMemo(
    () => flattenMemberRows(memberRowsQuery.data),
    [memberRowsQuery.data],
  );

  const { minModalMonthKey, maxModalMonthKey } = useMemo(() => {
    const currentKey = monthKeyFromParts(year, month);
    const keys = [...new Set(
      allMemberRows
        .map((row) => rowMonthKeyFromDateTime(row?.consultDateTime))
        .filter(Boolean),
    )].sort();
    const yearKeys = keys.filter((k) => k.startsWith(`${year}-`));
    if (yearKeys.length === 0) {
      return { minModalMonthKey: currentKey, maxModalMonthKey: currentKey };
    }
    const latest = yearKeys[yearKeys.length - 1];
    return {
      minModalMonthKey: yearKeys[0],
      maxModalMonthKey: latest > currentKey ? currentKey : latest,
    };
  }, [allMemberRows, year, month]);

  const canPrevModalMonth = modalMonthKey > minModalMonthKey;
  const canNextModalMonth = modalMonthKey < maxModalMonthKey;

  const modalRowsInMonth = useMemo(
    () => allMemberRows.filter((row) => {
      if (!isActiveUseYn(row)) return false;
      return rowMonthKeyFromDateTime(row?.consultDateTime) === modalMonthKey;
    }),
    [allMemberRows, modalMonthKey],
  );

  const modalCaseCountByDay = useMemo(() => {
    const counts = new Map();
    for (const row of modalRowsInMonth) {
      const dk = dateKeyFromDateTime(row?.consultDateTime);
      if (!dk) continue;
      counts.set(dk, (counts.get(dk) ?? 0) + 1);
    }
    return counts;
  }, [modalRowsInMonth]);

  const modalRowsInView = useMemo(() => {
    if (!modalDayFilterKey) return modalRowsInMonth;
    return modalRowsInMonth.filter(
      (row) => dateKeyFromDateTime(row?.consultDateTime) === modalDayFilterKey,
    );
  }, [modalRowsInMonth, modalDayFilterKey]);

  const modalFilterHint = useMemo(() => {
    const parts = [];
    if (modalYnFilters.dissatisfactionType != null) {
      const label = unsatTypeLabel(unsatTypeLabelMap, modalYnFilters.dissatisfactionType);
      if (label) parts.push(label);
    }
    if (modalYnFilters.satisfiedYn === 'Y') parts.push('만족');
    if (modalYnFilters.satisfiedYn === 'N') parts.push('불만족');
    if (modalYnFilters.fiveMajorCitiesYn === 'Y') parts.push('5대도시');
    if (modalYnFilters.gen5060Yn === 'Y') parts.push('5060');
    if (modalYnFilters.problemResolvedYn === 'Y') parts.push('문제해결');
    return parts.length ? parts.join(' · ') : null;
  }, [modalYnFilters, unsatTypeLabelMap]);

  const modalFilteredRows = useMemo(() => {
    const filtered = modalRowsInView.filter((r) => {
      if (!isActiveUseYn(r)) return false;
      if (!matchesYnFilter(r?.satisfiedYn, modalYnFilters.satisfiedYn)) return false;
      if (!matchesYnFilter(r?.fiveMajorCitiesYn, modalYnFilters.fiveMajorCitiesYn)) return false;
      if (!matchesYnFilter(r?.gen5060Yn, modalYnFilters.gen5060Yn)) return false;
      if (!matchesYnFilter(r?.problemResolvedYn, modalYnFilters.problemResolvedYn)) return false;
      if (!matchesDissatTypeFilter(r?.dissatisfactionType, modalYnFilters.dissatisfactionType)) return false;
      return true;
    });
    return [...filtered].sort(
      (a, b) => String(b.consultDateTime ?? '').localeCompare(String(a.consultDateTime ?? ''), 'ko'),
    );
  }, [modalRowsInView, modalYnFilters]);

  const teamDaySummaryQuery = useQuery({
    queryKey: ['cs-satisfaction-team-day-summary', user?.skid, modalDayFilterKey],
    queryFn: () => fetchCsSatisfactionTeamDaySummary(user.skid, modalDayFilterKey),
    enabled: showModal && !!user?.skid && modalDayFilterKey != null && modalDayFilterKey !== '',
    staleTime: 30_000,
  });

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
      setModalDayFilterKey(null);
      setModalDayPickerOpen(false);
      setModalPage(1);
      setModalYnFilters({ ...DEFAULT_MODAL_FILTERS });
      return;
    }
  }, [showModal]);

  useEffect(() => {
    setModalDayFilterKey(null);
  }, [modalMonthKey]);

  useEffect(() => {
    if (!modalDayFilterKey) return;
    if (!modalDayFilterKey.startsWith(`${modalMonthKey}-`)) {
      setModalDayFilterKey(null);
    }
  }, [modalMonthKey, modalDayFilterKey]);

  useEffect(() => { setModalPage(1); }, [modalMonthKey, modalDayFilterKey, modalYnFilters]);
  useEffect(() => { setModalPage((p) => Math.min(p, modalTotalPages)); }, [modalTotalPages]);

  const handleSelectModalDayFilter = useCallback((dayKey) => {
    setModalDayFilterKey(dayKey);
    setModalDayPickerOpen(false);
  }, []);

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
      <CsPageIntro skill={headerSkill} name={headerName} loading={isLoading} />

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
              month={month}
              memberRowsData={memberRowsQuery.data}
              memberRowsPending={memberRowsQuery.isPending}
              unsatTypeLabelMap={unsatTypeLabelMap}
              skill={headerSkill}
            />
          </section>
          <ReceptionFocusSection
            data={satData}
            month={month}
            onShowAll={() => openDetailModal({ ...DEFAULT_MODAL_FILTERS })}
            onOpenFiltered={(filters) => openDetailModal(filters)}
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
            <header className="adm-sat-row-modal-head csx-modal-head">
              <div>
                <h3 className="adm-sat-row-modal-title">
                  {user?.name ?? user?.skid} 접수 상세
                </h3>
                <p className="adm-sat-row-modal-sub">
                  {modalFilterHint ? `${modalFilterHint}` : ''}
                </p>
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
                  <div className="csx-modal-period-bar">
                    <div className="pending-table-toolbar-period csx-modal-period-toolbar" role="group" aria-label="접수 기간 선택">
                      <div className="pending-table-toolbar-month" role="group" aria-label="접수 월 이동">
                        <button
                          type="button"
                          className="pending-month-nav-btn"
                          disabled={!canPrevModalMonth}
                          onClick={() => setModalMonthKey((k) => addMonths(k, -1))}
                          aria-label="이전 달"
                        >
                          <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
                        </button>
                        <span className="pending-month-nav-label">{formatModalMonthLabel(modalMonthKey)}</span>
                        <button
                          type="button"
                          className="pending-month-nav-btn"
                          disabled={!canNextModalMonth}
                          onClick={() => setModalMonthKey((k) => addMonths(k, 1))}
                          aria-label="다음 달"
                        >
                          <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`pending-day-picker-btn${modalDayFilterKey ? ' is-active' : ''}`}
                        onClick={() => setModalDayPickerOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={modalDayPickerOpen}
                        title="일자 선택"
                      >
                        <Calendar size={14} aria-hidden />
                        <span>{formatDayPickerButtonLabel(modalDayFilterKey)}</span>
                        <ChevronDown size={14} className="pending-day-picker-btn__chev" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <CsSatisfactionModalDayStats
                    rows={modalFilteredRows}
                    scope={modalDayFilterKey ? 'day' : 'month'}
                    personalTargetPercent={satData?.monthlyTargetPct ?? satData?.target ?? null}
                    deptSummary={modalDayFilterKey ? (teamDaySummaryQuery.data ?? null) : null}
                  />
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
                          <th><span className="adm-sat-modal-th-wrap">불만족 유형</span></th>
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
                              <td className="adm-sat-modal-cell-dt">{formatCaseDateTimeMmDdKorean(row.consultDateTime)}</td>
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
                              <td className="adm-sat-modal-cell-untype">
                                {String(row.satisfiedYn ?? '').trim().toUpperCase() === 'N'
                                  ? (() => {
                                    const label = unsatTypeLabel(unsatTypeLabelMap, row.dissatisfactionType);
                                    return label
                                      ? <span className="adm-sat-untype-chip">{label}</span>
                                      : '—';
                                  })()
                                  : '—'}
                              </td>
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

      <PendingCaseDayPickerModal
        open={showModal && modalDayPickerOpen}
        monthKey={modalMonthKey}
        selectedDayKey={modalDayFilterKey}
        caseCountByDay={modalCaseCountByDay}
        onClose={() => setModalDayPickerOpen(false)}
        onSelectDay={handleSelectModalDayFilter}
      />
    </div>
  );
}
