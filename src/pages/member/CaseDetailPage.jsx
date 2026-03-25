import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemberModalStore } from '../../store/memberModalStore';

/**
 * /member/cases/:id 직접 진입 시 홈으로 돌리고 사례 상세 모달을 연다.
 */
export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const openCaseDetail = useMemberModalStore((s) => s.openCaseDetail);

  useEffect(() => {
    openCaseDetail(id);
    navigate('/member', { replace: true });
  }, [id, openCaseDetail, navigate]);

  return null;
}
