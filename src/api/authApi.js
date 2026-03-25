import axiosInstance from './axiosInstance';

/**
 * SKID로 로그인
 * GET /auth/login?skid={skid}
 * 반환값을 프론트 user 객체 형태로 정규화한다.
 */
export const loginWithSkid = async (skid) => {
  const { data } = await axiosInstance.get('/auth/login', { params: { skid } });

  return {
    ...data,
    id: data.skid,                                        // 기존 user.id 호환
    name: data.userName,                                  // 화면 표시명
    position: data.mbPositionName || '상담사',            // 직급명
    role: data.role === '관리자' ? 'admin' : 'member',   // 라우팅용 역할
  };
};
