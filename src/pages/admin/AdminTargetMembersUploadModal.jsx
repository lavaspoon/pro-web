import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import {
  uploadCsTargetMembersExcel,
  uploadYouProTargetMembersExcel,
} from '../../api/adminApi';
import './DashboardPage.css';
import './PendingCasesPage.css';
import './AdminSatisfactionSetupPage.css';

const VARIANT_CONFIG = {
  you: {
    title: 'YOU 프로 평가 대상자 업로드',
    tableLabel: 'TB_YOU_TARGET',
    memberColumn: 'you_yn',
    uploadFn: uploadYouProTargetMembersExcel,
    invalidateKeys: [
      ['admin-dashboard'],
      ['admin-leaf-teams'],
      ['admin-ranking'],
      ['team-detail'],
    ],
  },
  cs: {
    title: 'CS 만족도 평가 대상자 업로드',
    tableLabel: 'TB_CS_TARGET',
    memberColumn: 'cs_yn',
    uploadFn: uploadCsTargetMembersExcel,
    invalidateKeys: [
      ['cs-satisfaction-summary'],
      ['cs-satisfaction-center-month-detail'],
      ['cs-satisfaction-dashboard-kpis'],
      ['cs-satisfaction-member-monthly-rows'],
    ],
  },
};

export default function AdminTargetMembersUploadModal({ open, onClose, variant = 'you' }) {
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.you;
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [pickedName, setPickedName] = useState('');

  const uploadMutation = useMutation({
    mutationFn: (file) => config.uploadFn(file),
    onSuccess: () => {
      for (const key of config.invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      setPickedName('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setPickedName('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open, variant]);

  if (!open) return null;

  const onUpload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    uploadMutation.mutate(f);
  };

  return (
    <div
      className="sat-setup-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sat-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-member-upload-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sat-setup-modal-header">
          <div className="sat-setup-modal-header-text">
            <h2 id="target-member-upload-modal-title" className="sat-setup-modal-title">
              {config.title}
            </h2>
            <p className="sat-setup-modal-lead">
              업로드 시 <strong>{config.tableLabel} 기존 데이터는 전체 삭제</strong> 후 재적재되며,{' '}
              <strong>TB_LMS_MEMBER.{config.memberColumn}</strong> 은 먼저 전체 N 처리 후 엑셀 기준으로 반영됩니다.
              {variant === 'you' ? (
                <>
                  {' '}
                  <strong>TB_LMS_MEMBER.b_id</strong> 는 상담사ID(skid) 매칭 후 엑셀 스윙ID 값으로 동기화됩니다.
                </>
              ) : null}
            </p>
          </div>
          <button type="button" className="sat-setup-modal-close" onClick={onClose} aria-label="닫기">
            <X size={22} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="sat-setup-modal-body">
          <div className="sat-setup-shell sat-setup-shell--modal">
            <section className="sat-setup-pane sat-setup-pane--upload sat-setup-pane--modal">
              <div className="sat-setup-pane-head sat-setup-pane-head--minimal">
                <div>
                  <h3 className="sat-setup-pane-title">엑셀 업로드</h3>
                  <p className="sat-setup-pane-sub">
                    {config.tableLabel} 반영 후 구성원 {config.memberColumn} 을 동기화합니다.
                    {variant === 'you' ? ' (YOU 프로는 부서 스킬도 함께 반영)' : null}
                  </p>
                </div>
              </div>
              <div className="sat-setup-pane-body sat-setup-pane-body--upload">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sat-setup-file-input"
                  onChange={(e) => setPickedName(e.target.files?.[0]?.name || '')}
                  aria-label="평가 대상자 엑셀 파일"
                />

                <button
                  type="button"
                  className="sat-setup-drop sat-setup-drop--active"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={22} strokeWidth={2.1} className="sat-setup-drop-ico" aria-hidden />
                  <span className="sat-setup-drop-title">파일 선택</span>
                  <span className="sat-setup-drop-hint">
                    .xlsx · 평가대상여부: 대상 또는 평가
                    {variant === 'you' ? ' · 평가대상여부 우측 스윙ID 열' : null}
                  </span>
                </button>

                <div className="sat-setup-upload-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm sat-setup-btn-primary"
                    disabled={!pickedName || uploadMutation.isPending}
                    onClick={onUpload}
                  >
                    {uploadMutation.isPending ? '업로드 중…' : '업로드 실행'}
                  </button>
                </div>

                {pickedName ? (
                  <p className="sat-setup-picked">
                    <span className="sat-setup-picked-label">선택됨</span>
                    {pickedName}
                  </p>
                ) : null}
                {uploadMutation.isError ? (
                  <p className="pending-inline-error sat-setup-inline-msg">{uploadMutation.error?.message}</p>
                ) : null}
                {uploadMutation.isSuccess ? (
                  <p className="sat-setup-ok sat-setup-inline-msg">
                    반영 {uploadMutation.data?.inserted ?? 0} · 전체 N 초기화{' '}
                    {uploadMutation.data?.resetMembers ?? 0} · 구성원동기화{' '}
                    {uploadMutation.data?.updatedMembers ?? 0}
                    {variant === 'you' ? (
                      <>
                        {' '}
                        · 부서스킬동기화 {uploadMutation.data?.updatedDepts ?? 0}
                      </>
                    ) : null}{' '}
                    · 스킵 {uploadMutation.data?.skipped ?? 0}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
