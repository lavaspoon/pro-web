import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import './AiInsight.css';

export default function AiInsight({ judgmentReason, caseStatus, judgedAtLabel }) {
  if (caseStatus === 'pending') return null;

  const isSelected = caseStatus === 'selected';
  const isRejected = caseStatus === 'rejected';

  const VerdictIcon = isSelected ? CheckCircle : isRejected ? XCircle : AlertCircle;
  const verdictLabel = isSelected ? '선정' : isRejected ? '비선정' : '검토 필요';
  const variant = isSelected ? 'yes' : isRejected ? 'no' : 'neutral';

  const reasonText = judgmentReason != null ? String(judgmentReason).trim() : '';
  const hasReason = reasonText.length > 0 && (isSelected || isRejected);

  return (
    <div className={`ai-unified-card ai-unified-card--${variant}`}>
      {/* 헤더: 아이콘 + 선정여부 + 판정일 */}
      <div className="ai-unified-header">
        <div className="ai-unified-icon" aria-hidden>
          <VerdictIcon size={24} strokeWidth={2.2} />
        </div>
        <div className="ai-unified-header-body">
          <span className="ai-unified-label">선정 여부</span>
          <strong className="ai-unified-verdict">{verdictLabel}</strong>
        </div>
        {judgedAtLabel && (
          <span className="ai-unified-date">
            <Calendar size={12} aria-hidden />
            {judgedAtLabel}
          </span>
        )}
      </div>

      {/* 사유 */}
      {hasReason && (
        <div className="ai-unified-reason">
          <p className="ai-unified-reason-label">
            {isSelected ? '선정 사유' : '비선정 사유'}
          </p>
          <p className="ai-unified-reason-text">{reasonText}</p>
        </div>
      )}
    </div>
  );
}
