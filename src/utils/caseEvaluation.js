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

export function buildJudgePayload({ form, adminSkid, draft, decision }) {
  const body = {
    adminSkid,
    draft: Boolean(draft),
    remarks: form.remarks?.trim() || '',
  };
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
