/** 접수 현황 — 검증 단계 필터·표시 */

export const CASE_STAGE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'waiting', label: '대기중' },
  { key: 'phase1', label: '1차 완료' },
  { key: 'phase2', label: '2차 완료' },
  { key: 'returned', label: '반려' },
];

/**
 * @returns {'waiting'|'phase1'|'phase2'|'returned'|'other'}
 */
export function getCaseReviewStage(caseItem) {
  const fromApi = caseItem?.reviewStage;
  if (fromApi === 'waiting' || fromApi === 'phase1' || fromApi === 'phase2' || fromApi === 'returned') {
    return fromApi;
  }
  const status = String(caseItem?.status ?? '').toLowerCase();
  if (status === 'returned') return 'returned';
  if (status === 'selected' || status === 'rejected') return 'phase2';
  if (status === 'pending') {
    return caseItem?.judgmentDraft === true ? 'phase1' : 'waiting';
  }
  return 'other';
}

export function getCaseReviewStageBadge(caseItem) {
  const stage = getCaseReviewStage(caseItem);
  if (stage === 'returned') {
    return { key: 'returned', label: '반려', tone: 'returned' };
  }
  if (stage === 'phase2') {
    return { key: 'phase2', label: '2차 완료', tone: 'phase2' };
  }
  if (stage === 'phase1') {
    return { key: 'phase1', label: '1차 완료', tone: 'phase1' };
  }
  if (stage === 'waiting') {
    return { key: 'waiting', label: '대기중', tone: 'waiting' };
  }
  return { key: 'other', label: '—', tone: 'neutral' };
}

export function caseMatchesStageFilter(caseItem, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  return getCaseReviewStage(caseItem) === filterKey;
}

export function countCasesByStageFilter(cases, filterKey) {
  if (!Array.isArray(cases)) return 0;
  return cases.filter((c) => caseMatchesStageFilter(c, filterKey)).length;
}
