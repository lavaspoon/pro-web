import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ChevronLeft,
  Calendar,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { fetchCaseDetail } from '../../api/memberApi';
import StatusBadge from '../common/StatusBadge';
import AiInsight from './AiInsight';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { useMemberModalStore } from '../../store/memberModalStore';
import '../../pages/member/CaseDetailPage.css';
import './MemberSubmitModal.css';
import './MemberCaseDetailModal.css';

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  const showDuration = Boolean(caseData?.callDuration && String(caseData.callDuration).trim());

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
            <div className="detail-hero member-case-detail-hero">
              <div className="member-case-detail-title-row">
                <h3 className="detail-title">{caseData.title}</h3>
                <StatusBadge status={caseData.status} size="sm" />
              </div>
              <p className="detail-desc">{caseData.description}</p>
              <div className="detail-meta-row">
                <span className="meta-item">
                  <Calendar size={13} />
                  접수 {formatDateTime(caseData.submittedAt)}
                </span>
                <span className="meta-item">
                  <CalendarClock size={13} />
                  통화 일시 {formatCaseCallDateTime(caseData.callDate)}
                </span>
                {showDuration && (
                  <span className="meta-item">
                    <Clock size={13} />
                    녹취 길이 {caseData.callDuration}
                  </span>
                )}
              </div>
            </div>

            {caseData.status === 'pending' && (
              <div className="pending-notice">
                <Clock size={16} />
                <div>
                  <strong>대기중</strong>
                  <p>담당자가 녹취콜을 청취하고 있습니다. 결과가 나오면 알려드립니다.</p>
                </div>
              </div>
            )}

            {caseData.status !== 'pending' && (
              <div className="member-case-ai-wrap">
                <AiInsight
                  judgmentReason={caseData.judgmentReason}
                  caseStatus={caseData.status}
                  judgedAtLabel={caseData.judgedAt ? formatDateTime(caseData.judgedAt) : null}
                />
              </div>
            )}

          </>
        )}
      </div>
    </>
  );
}
