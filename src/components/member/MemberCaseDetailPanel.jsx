import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft } from 'lucide-react';
import { fetchCaseDetail } from '../../api/memberApi';
import StatusBadge from '../common/StatusBadge';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { useMemberModalStore } from '../../store/memberModalStore';
import MemberCaseEvaluationView from './MemberCaseEvaluationView';
import './MemberSubmitModal.css';
import './MemberCaseDetailModal.css';

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatJudgedAt(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateTime(dateStr);
}

/**
 * 사례 상세 본문 — 목록 모달 안(embedded) 또는 단독 모달에서 공통 사용.
 */
export default function MemberCaseDetailPanel({ embedded = false }) {
  const caseDetailId = useMemberModalStore((s) => s.caseDetailId);
  const closeCaseDetail = useMemberModalStore((s) => s.closeCaseDetail);

  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: ['case-detail', caseDetailId],
    queryFn: () => fetchCaseDetail(caseDetailId),
    enabled: !!caseDetailId,
  });

  if (!caseDetailId) return null;

  const judgedAtLabel = caseData ? formatJudgedAt(caseData.judgedAt) : null;

  return (
    <>
      <div className="member-case-detail-head">
        <button
          type="button"
          className="member-case-detail-back"
          onClick={closeCaseDetail}
          aria-label={embedded ? '내 사례 목록으로 돌아가기' : '이전 화면으로'}
        >
          <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
          <span>{embedded ? '목록' : '이전'}</span>
        </button>
        <h2 id="member-case-detail-title" className="member-case-detail-heading">
          사례 상세
        </h2>
        <button type="button" className="member-modal-close" onClick={closeCaseDetail} aria-label="닫기">
          <X size={20} strokeWidth={2.25} />
        </button>
      </div>

      <div className="member-case-detail-body">
        {isLoading && (
          <div className="member-case-detail-loading">
            <div className="spinner" />
            <p>불러오는 중...</p>
          </div>
        )}
        {isError && (
          <p className="member-case-detail-error">{(error && error.message) || '사례를 불러올 수 없습니다.'}</p>
        )}
        {!isLoading && !isError && caseData && (
          <>
            <div className="member-case-detail-meta-row" aria-label="접수·통화·판정">
              <StatusBadge status={caseData.status} size="sm" />
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">접수</span>
                <span className="member-case-detail-meta-val">
                  {formatDateTime(caseData.submittedAt)}
                </span>
              </span>
              <span className="member-case-detail-meta-sep" aria-hidden>·</span>
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">통화</span>
                <span className="member-case-detail-meta-val">
                  {formatCaseCallDateTime(caseData.callDate)}
                </span>
              </span>
              <span className="member-case-detail-meta-sep" aria-hidden>·</span>
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">판정</span>
                <span className="member-case-detail-meta-val">
                  {judgedAtLabel ?? (caseData.status === 'pending' ? '대기' : '—')}
                </span>
              </span>
            </div>
            <MemberCaseEvaluationView caseData={caseData} />
          </>
        )}
      </div>
    </>
  );
}
