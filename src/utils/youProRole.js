/** TB_YOUPRO_ROLE.role — 접수 현황(검토 대기) 화면 접근 가능 역할 */
export const PENDING_CASES_ACCESS_ROLES = ['관리자', '모니터링'];

/** TB_YOUPRO_ROLE.role — 관리자 영역(/admin) 라우팅 역할 */
export const ADMIN_ROUTE_ROLES = ['관리자', '모니터링', 'CE실장'];

export const YOUPRO_ADMIN_ROLE = '관리자';
export const YOUPRO_MONITORING_ROLE = '모니터링';
export const YOUPRO_CE_DIRECTOR_ROLE = 'CE실장';

export function resolveYouProRole(user) {
  if (!user) return null;
  if (user.youProRole) return user.youProRole;
  if (user.role === 'admin') return YOUPRO_ADMIN_ROLE;
  return '담당자';
}

export function canAccessPendingCases(user) {
  const youProRole = resolveYouProRole(user);
  return PENDING_CASES_ACCESS_ROLES.includes(youProRole);
}

export function isYouProAdmin(user) {
  return resolveYouProRole(user) === YOUPRO_ADMIN_ROLE;
}

export function isYouProMonitoring(user) {
  return resolveYouProRole(user) === YOUPRO_MONITORING_ROLE;
}

export function isYouProCeDirector(user) {
  return resolveYouProRole(user) === YOUPRO_CE_DIRECTOR_ROLE;
}

export function isAdminRouteRole(youProRole) {
  return ADMIN_ROUTE_ROLES.includes(youProRole);
}
