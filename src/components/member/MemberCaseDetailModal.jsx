import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ChevronLeft,
  Calendar,
  CalendarClock,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { fetchCaseDetail } from '../../api/memberApi';
import StatusBadge from '../common/StatusBadge';
import AiInsight from './AiInsight';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { getMemberAiFallback } from '../../utils/memberAiFallback';
import { useMemberModalStore } from '../../store/memberModalStore';
import '../../pages/member/CaseDetailPage.css';
import './MemberSubmitModal.css';
import './MemberCaseDetailModal.css';

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MemberCaseDetailModal() {
  const caseDetailId = useMemberModalStore((s) => s.caseDetailId);
  const caseListOpen = useMemberModalStore((s) => s.caseListOpen);
  const closeCaseDetail = useMemberModalStore((s) => s.closeCaseDetail);

  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: ['case-detail', caseDetailId],
    queryFn: () => fetchCaseDetail(caseDetailId),
    enabled: !!caseDetailId,
  });

  useEffect(() => {
    if (!caseDetailId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [caseDetailId]);

  useEffect(() => {
    if (!caseDetailId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeCaseDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [caseDetailId, closeCaseDetail]);

  if (!caseDetailId) return null;

  const hasTranscript = Boolean(caseData?.fullTranscript && caseData.fullTranscript.trim());
  const showDuration = Boolean(caseData?.callDuration && String(caseData.callDuration).trim());

  const displayAiInsight =
    caseData &&
    (caseData.aiKeyPoint ||
      (caseData.status !== 'pending' ? getMemberAiFallback(caseData.id) : null));

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
      <div className="member-modal-panel member-case-detail-panel">
        <div className="member-case-detail-head">
          <button
            type="button"
            className="member-case-detail-back"
            onClick={closeCaseDetail}
            aria-label={caseListOpen ? '내 사례 목록으로 돌아가기' : '이전 화면으로'}
          >
            <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
            <span>{caseListOpen ? '목록' : '이전'}</span>
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
                  <StatusBadge status={caseData.status} size="lg" />
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
                  {hasTranscript && (
                    <span className="meta-item meta-item-stt">
                      <FileText size={13} />
                      STT 전사 제공
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

              {displayAiInsight && caseData.status !== 'pending' && (
                <div className="member-case-ai-wrap">
                  <AiInsight insight={displayAiInsight} />
                </div>
              )}

              {caseData.status !== 'pending' && caseData.judgmentReason && (
                <div
                  className={`judgment-card ${caseData.status === 'selected' ? 'judgment-selected' : 'judgment-rejected'}`}
                >
                  <div className="judgment-header">
                    <span className="judgment-label">
                      {caseData.status === 'selected' ? (
                        <>
                          <CheckCircle size={14} /> 선정 사유
                        </>
                      ) : (
                        <>
                          <XCircle size={14} /> 비선정 사유
                        </>
                      )}
                    </span>
                    <span className="judgment-date">판정일: {formatDateTime(caseData.judgedAt)}</span>
                  </div>
                  <p className="judgment-reason">{caseData.judgmentReason}</p>
                </div>
              )}

              {hasTranscript && (
                <section className="detail-section">
                  <h4 className="detail-section-title">
                    <FileText size={17} />
                    통화 STT 전사
                  </h4>
                  <div className="stt-transcript-box">{caseData.fullTranscript}</div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
