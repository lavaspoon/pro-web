import React from 'react';
import StatusBadge from '../common/StatusBadge';
import CaseReviewStageBadge from '../common/CaseReviewStageBadge';
import { formatCaseDateTimeYyMmKorean } from '../../utils/caseDisplay';

/**
 * 사례 상세 상단 — 상태 · 접수시간 · 상담시간
 */
export default function CaseDetailMetaRow({
  status,
  submittedAt,
  callDate,
  caseItem = null,
  statusMode = 'member',
  className = '',
  callTitle,
}) {
  return (
    <div
      className={`member-case-detail-meta-row${className ? ` ${className}` : ''}`}
      aria-label="상태·접수시간·상담시간"
    >
      <div className="member-case-detail-meta-chip member-case-detail-meta-chip--status">
        <span className="member-case-detail-meta-kicker">상태</span>
        <span className="member-case-detail-meta-val member-case-detail-meta-val--status">
          {statusMode === 'review' && caseItem ? (
            <CaseReviewStageBadge caseItem={caseItem} size="sm" />
          ) : (
            <StatusBadge status={status} size="sm" />
          )}
        </span>
      </div>
      <span className="member-case-detail-meta-divider" aria-hidden />
      <div className="member-case-detail-meta-chip">
        <span className="member-case-detail-meta-kicker">접수시간</span>
        <span className="member-case-detail-meta-val">
          {formatCaseDateTimeYyMmKorean(submittedAt)}
        </span>
      </div>
      <span className="member-case-detail-meta-divider" aria-hidden />
      <div
        className="member-case-detail-meta-chip member-case-detail-meta-chip--call"
        title={callTitle}
      >
        <span className="member-case-detail-meta-kicker">상담시간</span>
        <span className="member-case-detail-meta-val">
          {formatCaseDateTimeYyMmKorean(callDate)}
        </span>
      </div>
    </div>
  );
}
