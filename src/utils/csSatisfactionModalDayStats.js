/** 스킬 월 목표 대비 만족도 달성률(%) */
export function satisfactionAchievementFromTarget(actualRate, targetPercent) {
  if (actualRate == null || targetPercent == null) return null;
  const t = Number(targetPercent);
  const a = Number(actualRate);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t <= 0) return null;
  return Math.round((1000 * a) / t) / 10;
}

/** 목표 대비 달성 — achievementRate 우선, 없으면 actual ≥ target */
export function resolveTargetMet({ actualPct, targetPct, achievementRate }) {
  if (achievementRate != null && !Number.isNaN(Number(achievementRate))) {
    return Number(achievementRate) >= 100;
  }
  if (actualPct == null || targetPct == null || Number.isNaN(Number(actualPct))) {
    return null;
  }
  const t = Number(targetPct);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Number(actualPct) >= t;
}

export function isActiveUseYn(row) {
  return String(row?.useYn ?? '').trim().toUpperCase() === 'Y';
}

function isSatisfiedYn(row) {
  return String(row?.satisfiedYn ?? '').trim().toUpperCase() === 'Y';
}

/**
 * 선택 일자 row 목록에서 평가시간(useYn=Y) 기준 일별 만족도 집계.
 */
export function computePersonalDaySatisfaction(rows) {
  const active = (rows ?? []).filter(isActiveUseYn);
  const evalCount = active.length;
  const satisfiedCount = active.filter(isSatisfiedYn).length;
  const satisfactionRate =
    evalCount > 0 ? Math.round((1000 * satisfiedCount) / evalCount) / 10 : null;
  return { evalCount, satisfiedCount, satisfactionRate };
}

/** 부서·개인 만족도 목표를 모두 달성했는지 */
export function isDualSatisfactionTargetMet({
  personalRate,
  personalTarget,
  deptRate,
  deptTarget,
}) {
  const personalMet = resolveTargetMet({
    actualPct: personalRate,
    targetPct: personalTarget,
    achievementRate: satisfactionAchievementFromTarget(personalRate, personalTarget),
  });
  const deptMet = resolveTargetMet({
    actualPct: deptRate,
    targetPct: deptTarget,
    achievementRate: satisfactionAchievementFromTarget(deptRate, deptTarget),
  });
  return personalMet === true && deptMet === true;
}

export function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

export function fmtCount(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function defaultDateKeyFromDateTime(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 10);
}

/** row 목록 → 일자별 { evalCount, satisfiedCount, satisfactionRate } Map */
export function buildDaySatisfactionStatsByDay(rows, dateKeyFromDateTime = defaultDateKeyFromDateTime) {
  const grouped = new Map();
  for (const row of rows ?? []) {
    if (!isActiveUseYn(row)) continue;
    const dayKey = dateKeyFromDateTime(row?.consultDateTime);
    if (!dayKey) continue;
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey).push(row);
  }
  const statsByDay = new Map();
  for (const [dayKey, dayRows] of grouped) {
    statsByDay.set(dayKey, computePersonalDaySatisfaction(dayRows));
  }
  return statsByDay;
}
