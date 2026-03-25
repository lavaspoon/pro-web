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
  editedTranscript,
  aiSnapshotJson,
}) => {
  const body = {
    adminSkid,
    decision,
    reason,
  };
  if (editedTranscript != null && String(editedTranscript).trim() !== '') {
    body.editedTranscript = String(editedTranscript).trim();
  }
  if (aiSnapshotJson != null && String(aiSnapshotJson).trim() !== '') {
    body.aiSnapshotJson = String(aiSnapshotJson).trim();
  }
  const { data } = await axiosInstance.post(`/api/admin/cases/${caseId}/judge`, body);
  return data;
};
