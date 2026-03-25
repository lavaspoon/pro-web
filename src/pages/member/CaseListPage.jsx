import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemberModalStore } from '../../store/memberModalStore';

/**
 * /member/cases 직접 진입 시 홈으로 돌리고 목록 모달을 연다.
 */
export default function CaseListPage() {
  const navigate = useNavigate();
  const openCaseList = useMemberModalStore((s) => s.openCaseList);

  useEffect(() => {
    openCaseList();
    navigate('/member', { replace: true });
  }, [openCaseList, navigate]);

  return null;
}
