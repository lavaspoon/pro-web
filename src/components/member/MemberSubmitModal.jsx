import React, { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
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
        <span className="member-modal-sticker" aria-hidden>
          <Sparkles size={18} />
        </span>

        <div className="member-submit-modal-head">
          <div className="member-submit-modal-head-text">
            <p className="member-cute-kicker">오늘도 수고했어요</p>
            <h2 id="member-submit-title" className="member-cute-title">
              우수사례 접수
            </h2>
            <p className="member-cute-sub">멋진 응대를 살짝 적어 두면 나중에 더 반짝여요</p>
          </div>
          <button type="button" className="member-modal-close" onClick={closeSubmit} aria-label="닫기">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <p className="member-submit-hint">
          월 3건 · 연 36건까지 선정 가능 · 담당자가 녹취로 확인해요
        </p>

        <div className="member-submit-modal-body">
          <SubmitCaseForm compact onGoToCaseList={handleGoList} />
        </div>
      </div>
    </div>
  );
}
