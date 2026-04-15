import { Navigate } from 'react-router-dom';

/** @deprecated 라우트 호환: 만족도 대시보드에서 모달로 열립니다. */
export default function AdminSatisfactionSetupPage() {
  return <Navigate to="/admin/satisfaction?setup=1" replace />;
}
