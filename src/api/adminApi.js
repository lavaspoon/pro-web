import axiosInstance from './axiosInstance';

/**
 * 관리자 대시보드 데이터 조회
 * GET /api/admin/dashboard
 */
export const fetchAdminDashboard = async () => {
  const { data } = await axiosInstance.get('/api/admin/dashboard');
  return data;
};

/**
 * 2depth 부서 기준 하위 leaf 팀 목록·집계
 * GET /api/admin/filter/leaf-teams?secondDepthDeptId=5 (생략 시 전체 2depth 하위 leaf 합집합)
 */
export const fetchAdminLeafTeams = async (secondDepthDeptId) => {
  const params = {};
  if (secondDepthDeptId != null && secondDepthDeptId !== '') {
    params.secondDepthDeptId = secondDepthDeptId;
  }
  const { data } = await axiosInstance.get('/api/admin/filter/leaf-teams', { params });
  return data;
};

/**
 * 랭킹 — 사례(TB_YOU_PRO_CASE) 접수 건수 기준, 2depth 센터별 통계
 * GET /api/admin/ranking?year=&topN=
 */
export const fetchAdminRanking = async (year, topN = 3) => {
  const { data } = await axiosInstance.get('/api/admin/ranking', {
    params: { year, topN },
  });
  return data;
};

/**
 * 팀(실) 상세 구성원 현황 조회
 * GET /api/admin/teams/{deptIdx}
 */
export const fetchTeamDetail = async (deptIdx) => {
  const { data } = await axiosInstance.get(`/api/admin/teams/${deptIdx}`);
  return data;
};

/**
 * 검토 대기 전체 사례 조회
 * GET /api/admin/cases/pending
 */
export const fetchAllPendingCases = async () => {
  const { data } = await axiosInstance.get('/api/admin/cases/pending');
  return data;
};

/**
 * 검토 대기 화면 — 대시보드 + 대기 사례 단일 요청
 * GET /api/admin/review-queue
 */
export const fetchAdminReviewQueue = async () => {
  const { data } = await axiosInstance.get('/api/admin/review-queue');
  return data;
};

/**
 * 사례 상세 조회 (STT 포함)
 * GET /api/admin/cases/{caseId}
 */
export const fetchCaseForReview = async (caseId) => {
  const { data } = await axiosInstance.get(`/api/admin/cases/${caseId}`);
  return data;
};

/**
 * 사례 판정 (선정 / 비선정)
 * POST /api/admin/cases/{caseId}/judge
 */
export const judgeCase = async ({
  caseId,
  decision,
  reason,
  adminSkid,
  aiKeyPhrase,
  aiKeyPoint,
}) => {
  const body = {
    adminSkid,
    decision,
    reason,
  };
  if (aiKeyPhrase != null && String(aiKeyPhrase).trim() !== '') {
    body.aiKeyPhrase = String(aiKeyPhrase).trim();
  }
  if (aiKeyPoint != null && String(aiKeyPoint).trim() !== '') {
    body.aiKeyPoint = String(aiKeyPoint).trim();
  }
  const { data } = await axiosInstance.post(`/api/admin/cases/${caseId}/judge`, body);
  return data;
};
