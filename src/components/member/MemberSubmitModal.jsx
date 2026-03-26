import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useMemberModalStore } from '../../store/memberModalStore';
import SubmitCaseForm from './SubmitCaseForm';
import './MemberSubmitModal.css';

export default function MemberSubmitModal() {
  const open = useMemberModalStore((s) => s.submitOpen);
  const closeSubmit = useMemberModalStore((s) => s.closeSubmit);
  const openCaseList = useMemberModalStore((s) => s.openCaseList);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSubmit]);

  if (!open) return null;

  const handleGoList = () => {
    closeSubmit();
    openCaseList();
  };

  return (
    <div
      className="member-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-submit-title"
    >
      <button
        type="button"
        className="member-modal-backdrop"
        aria-label="모달 닫기"
        onClick={closeSubmit}
      />
      <div className="member-modal-panel member-submit-modal">
        <span className="member-modal-blob member-modal-blob--1" aria-hidden />
        <span className="member-modal-blob member-modal-blob--2" aria-hidden />

        <div className="member-submit-modal-head">
          <div className="member-submit-modal-head-text">
            <p className="member-cute-kicker">YOU PRO</p>
            <h2 id="member-submit-title" className="member-cute-title">
              사례 접수
            </h2>
            <p className="member-cute-sub">
              아래에서 <strong>사례 내용</strong>과 <strong>통화 일시</strong>만 입력하면 접수가 완료됩니다.
            </p>
          </div>
          <button type="button" className="member-modal-close" onClick={closeSubmit} aria-label="닫기">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div className="member-submit-modal-body">
          <SubmitCaseForm compact onGoToCaseList={handleGoList} />
        </div>
      </div>
    </div>
  );
}
