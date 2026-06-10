/** 평가 항목 — API 필드명, 화면 라벨, 만점(다정한맞이 순) */
export const CASE_SCORE_ITEMS = [
  { key: 'kindGreeting', label: '다정한맞이', maxScore: 5 },
  { key: 'needsIdentification', label: '니즈파악', maxScore: 10 },
  { key: 'empathy', label: '공감', maxScore: 10 },
  { key: 'listening', label: '경청', maxScore: 10 },
  { key: 'variedExpression', label: '다양한표현', maxScore: 10 },
  { key: 'voiceDirection', label: '음성연출', maxScore: 10 },
  { key: 'customConsultation', label: '고객맞춤상담', maxScore: 5 },
  { key: 'consultationFlow', label: '상담흐름', maxScore: 5 },
  { key: 'proactivity', label: '적극성', maxScore: 10 },
  { key: 'accuracy', label: '정확성', maxScore: 10 },
  { key: 'deepCare', label: '딥케어', maxScore: 10 },
  { key: 'closingImpression', label: '여운있는마무리', maxScore: 5 },
  { key: 'bonus', label: '가점', maxScore: 10 },
];

export const CASE_MAX_TOTAL_SCORE = CASE_SCORE_ITEMS.reduce((sum, { maxScore }) => sum + maxScore, 0);

export const DEFAULT_CERTIFICATION_MIN_TOTAL = 90;

export function getScoreItemMax(key) {
  const item = CASE_SCORE_ITEMS.find((i) => i.key === key);
  return item?.maxScore ?? 100;
}

export function emptyScoreForm() {
  return CASE_SCORE_ITEMS.reduce((acc, { key }) => {
    acc[key] = '';
    return acc;
  }, { remarks: '' });
}

export function scoresFromCaseData(caseData) {
  const base = emptyScoreForm();
  if (!caseData) return base;
  for (const { key } of CASE_SCORE_ITEMS) {
    const v = caseData[key];
    base[key] = v != null && v !== '' ? String(v) : '';
  }
  const remarkSrc = caseData?.scoreRemarks ?? caseData?.remarks;
  base.remarks = remarkSrc?.trim() ? remarkSrc.trim() : '';
  return base;
}

export function parseScoreValue(raw, maxScore = 100) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  const max = Number(maxScore);
  if (!Number.isFinite(n) || n < 0 || !Number.isFinite(max) || n > max) return null;
  return Math.round(n);
}

/** 입력 중인 값이 해당 항목 만점을 넘는지 (빈 값·미완성 입력은 false) */
export function isScoreInputOverMax(raw, maxScore) {
  const s = String(raw ?? '').trim();
  if (s === '' || s === '-') return false;
  const n = Number(s);
  const max = Number(maxScore);
  if (!Number.isFinite(n) || !Number.isFinite(max)) return false;
  return n > max;
}

export function sumScores(form) {
  let total = 0;
  for (const { key, maxScore } of CASE_SCORE_ITEMS) {
    const n = parseScoreValue(form[key], maxScore);
    if (n != null) total += n;
  }
  return total;
}

export function decisionFromTotal(total, minTotal = DEFAULT_CERTIFICATION_MIN_TOTAL) {
  return total >= minTotal ? 'selected' : 'rejected';
}

export function decisionLabel(decision) {
  return decision === 'selected' ? '인증' : '미인증';
}

export function buildJudgePayload({ form, adminSkid, draft, decision, description }) {
  const body = {
    adminSkid,
    draft: Boolean(draft),
    remarks: form.remarks?.trim() || '',
  };
  const desc = description != null ? String(description).trim() : '';
  if (desc) {
    body.description = desc;
  }
  if (!draft && decision) {
    body.decision = decision === 'selected' ? 'selected' : 'rejected';
  }
  for (const { key, maxScore } of CASE_SCORE_ITEMS) {
    const n = parseScoreValue(form[key], maxScore);
    if (n != null) body[key] = n;
  }
  return body;
}

export function caseDescriptionExcerpt(text, maxLen = 48) {
  const t = (text && String(text).trim()) || '';
  if (!t) return '—';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/**
 * 사례 목록 — 항목별 평균 취득률 계산
 */
function computeScoreItemRankings(cases) {
  return CASE_SCORE_ITEMS.map(({ key, label, maxScore }) => {
    let sum = 0;
    let count = 0;
    for (const row of cases ?? []) {
      const n = parseScoreValue(row?.[key], maxScore);
      if (n != null) {
        sum += n;
        count += 1;
      }
    }
    if (count === 0) return null;
    const avg = sum / count;
    return {
      key,
      label,
      maxScore,
      avg,
      rate: avg / maxScore,
      count,
    };
  }).filter(Boolean);
}

function filterCasesWithScores(cases) {
  return (cases ?? []).filter((row) => (
    CASE_SCORE_ITEMS.some(({ key, maxScore }) => parseScoreValue(row?.[key], maxScore) != null)
  ));
}

/**
 * TOP10 인증 사례 — 평균 취득률이 가장 높은 평가 항목 분석
 * @returns {{ label: string, summary: string, avgScore: number, maxScore: number } | null}
 */
export function analyzeTopScoreTrendInsight(cases) {
  const items = (cases ?? []).slice(0, 10);
  if (!items.length) return null;

  const ranked = computeScoreItemRankings(items);
  if (!ranked.length) return null;

  ranked.sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (b.avg !== a.avg) return b.avg - a.avg;
    return a.label.localeCompare(b.label, 'ko');
  });

  const top = ranked[0];
  return {
    label: top.label,
    summary: `상위자들은 ${top.label} 점수에서 가장 높은 점수를 취득했습니다.`,
    avgScore: Math.round(top.avg * 10) / 10,
    maxScore: top.maxScore,
  };
}

/**
 * 내 사례 — 상위자 대비·또는 자체 평균 기준 취약 항목
 */
export function analyzeMyWeakScoreInsight(myCases, topCases) {
  const scoredMine = filterCasesWithScores(myCases);
  if (!scoredMine.length) return null;

  const myRanked = computeScoreItemRankings(scoredMine);
  if (!myRanked.length) return null;

  const topRanked = (topCases ?? []).length
    ? computeScoreItemRankings((topCases ?? []).slice(0, 10))
    : [];

  let candidates = myRanked.map((my) => {
    const top = topRanked.find((item) => item.key === my.key);
    const gap = top ? top.rate - my.rate : null;
    return { ...my, gap };
  });

  if (topRanked.length) {
    const withGap = candidates.filter((item) => item.gap != null && item.gap > 0);
    if (withGap.length) {
      withGap.sort((a, b) => {
        if (b.gap !== a.gap) return b.gap - a.gap;
        return a.rate - b.rate;
      });
      candidates = withGap;
    } else {
      candidates.sort((a, b) => a.rate - b.rate);
    }
  } else {
    candidates.sort((a, b) => a.rate - b.rate);
  }

  const weak = candidates[0];
  if (!weak) return null;

  return {
    label: weak.label,
    avgScore: Math.round(weak.avg * 10) / 10,
    maxScore: weak.maxScore,
    sampleCount: scoredMine.length,
    comparedToTop: topRanked.length > 0 && weak.gap != null && weak.gap > 0,
  };
}
