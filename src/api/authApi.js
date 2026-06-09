import axiosInstance from './axiosInstance';
import { isAdminRouteRole } from '../utils/youProRole';

/** 역할이 관리자 라우팅 대상이거나 comCode >= 31 이고 mbPosition !== 719 이면 관리자 화면 */
export function isAdminRouteByMemberProfile({ comCode, mbPosition, role } = {}) {
  if (isAdminRouteRole(role)) return true;
  if (comCode == null || mbPosition == null) return false;
  return comCode >= 31 && mbPosition !== 719;
}

/**
 * SKID로 로그인
 * GET /auth/login?skid={skid}
 * 반환값을 프론트 user 객체 형태로 정규화한다.
 */
export const loginWithSkid = async (skid) => {
  const { data } = await axiosInstance.get('/auth/login', { params: { skid } });

  return {
    ...data,
    id: data.skid,
    name: data.userName,
    position: data.mbPositionName || '상담사',
    youProRole: data.role,
    role: isAdminRouteByMemberProfile({
      comCode: data.comCode,
      mbPosition: data.mbPosition,
      role: data.role,
    })
      ? 'admin'
      : 'member',
  };
};
