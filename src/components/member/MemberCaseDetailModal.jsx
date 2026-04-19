import React, { useEffect } from 'react';
import { useMemberModalStore } from '../../store/memberModalStore';
import MemberCaseDetailPanel from './MemberCaseDetailPanel';
import './MemberSubmitModal.css';
import './MemberCaseDetailModal.css';

/**
 * 사례 상세 — 목록 모달이 열려 있을 때는 렌더하지 않음(목록 안에서 전환).
 * /member/cases/:id 직접 진입 등 목록 없이 상세만 열릴 때만 단독 모달.
 */
export default function MemberCaseDetailModal() {
  const caseDetailId = useMemberModalStore((s) => s.caseDetailId);
  const caseListOpen = useMemberModalStore((s) => s.caseListOpen);
  const closeCaseDetail = useMemberModalStore((s) => s.closeCaseDetail);

  useEffect(() => {
    if (!caseDetailId || caseListOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [caseDetailId, caseListOpen]);

  useEffect(() => {
    if (!caseDetailId || caseListOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeCaseDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [caseDetailId, caseListOpen, closeCaseDetail]);

  if (!caseDetailId || caseListOpen) return null;

  return (
    <div
      className="member-modal-root member-case-detail-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-case-detail-title"
    >
      <button
        type="button"
        className="member-modal-backdrop"
        aria-label="닫기"
        onClick={closeCaseDetail}
      />
      <div className="member-modal-panel member-case-detail-panel member-case-detail-modal-box">
        <MemberCaseDetailPanel embedded={false} />
      </div>
    </div>
  );
}
