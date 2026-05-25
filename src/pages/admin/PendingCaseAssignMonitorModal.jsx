import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { fetchMonitoringUsers } from '../../api/adminApi';
import './PendingCaseAssignMonitorModal.css';

export default function PendingCaseAssignMonitorModal({
  open,
  caseCount,
  onClose,
  onConfirm,
  submitting,
  errorMessage,
}) {
  const [selectedSkid, setSelectedSkid] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-monitoring-users'],
    queryFn: fetchMonitoringUsers,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setSelectedSkid('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="pending-assign-backdrop" onClick={onClose} role="presentation">
      <div
        className="pending-assign-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-assign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pending-assign-head">
          <h2 id="pending-assign-title" className="pending-assign-title">
            담당자 지정
          </h2>
          <button type="button" className="pending-assign-close" onClick={onClose} aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="pending-assign-desc">
          선택한 <strong>{caseCount}건</strong>에 모니터링 담당자 1명을 지정합니다.
        </p>
        {isLoading ? (
          <p className="pending-assign-msg">모니터링 구성원 불러오는 중…</p>
        ) : users.length === 0 ? (
          <p className="pending-assign-msg">지정 가능한 모니터링 구성원이 없습니다.</p>
        ) : (
          <ul className="pending-assign-list">
            {users.map((u) => {
              const active = selectedSkid === u.skid;
              return (
                <li key={u.skid}>
                  <button
                    type="button"
                    className={`pending-assign-option${active ? ' is-active' : ''}`}
                    onClick={() => setSelectedSkid(u.skid)}
                    aria-pressed={active}
                  >
                    <span className="pending-assign-option-name">{u.name}</span>
                    <span className="pending-assign-option-meta">
                      {u.skid}
                      {u.deptName ? ` · ${u.deptName}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {errorMessage ? (
          <p className="pending-assign-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="pending-assign-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selectedSkid || submitting || users.length === 0}
            onClick={() => onConfirm(selectedSkid)}
          >
            {submitting ? '지정 중…' : '담당자 지정'}
          </button>
        </div>
      </div>
    </div>
  );
}
