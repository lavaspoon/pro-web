import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemberModalStore } from '../../store/memberModalStore';

/**
 * /member/submit 직접 진입 시 홈으로 돌리고 접수 모달을 연다.
 */
export default function SubmitCasePage() {
  const navigate = useNavigate();
  const openSubmit = useMemberModalStore((s) => s.openSubmit);

  useEffect(() => {
    openSubmit();
    navigate('/member', { replace: true });
  }, [openSubmit, navigate]);

  return null;
}
