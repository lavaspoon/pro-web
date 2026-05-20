/** 가점 항목 정의 — API 필드명과 화면 라벨 */
export const CASE_SCORE_ITEMS = [
  { key: 'kindGreeting', label: '다정한맞이' },
  { key: 'needsIdentification', label: '니즈파악' },
  { key: 'empathy', label: '공감' },
  { key: 'listening', label: '경청' },
  { key: 'variedExpression', label: '다양한표현' },
  { key: 'voiceDirection', label: '음성연출' },
  { key: 'customConsultation', label: '고객맞춤상담' },
  { key: 'consultationFlow', label: '상담흐름' },
  { key: 'proactivity', label: '적극성' },
  { key: 'accuracy', label: '정확성' },
  { key: 'deepCare', label: '딥케어' },
  { key: 'closingImpression', label: '여운있는마무리' },
  { key: 'bonus', label: '가점' },
];

export const DEFAULT_CERTIFICATION_MIN_TOTAL = 70;

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

export function parseScoreValue(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n);
}

export function sumScores(form) {
  let total = 0;
  for (const { key } of CASE_SCORE_ITEMS) {
    const n = parseScoreValue(form[key]);
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

export function buildJudgePayload({ form, adminSkid, draft }) {
  const body = {
    adminSkid,
    draft: Boolean(draft),
    remarks: form.remarks?.trim() || '',
  };
  for (const { key } of CASE_SCORE_ITEMS) {
    const n = parseScoreValue(form[key]);
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
