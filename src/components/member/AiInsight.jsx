import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import './AiInsight.css';

/**
 * 구성원용: 선정 여부 + 선정(·비선정) 사유만 표시 (AI 세부는 비표시)
 *
 * @param {string} [props.judgmentReason]
 * @param {'selected'|'rejected'|'pending'} [props.caseStatus]
 * @param {string|null} [props.judgedAtLabel]
 */
export default function AiInsight({ judgmentReason, caseStatus, judgedAtLabel }) {
  if (caseStatus === 'pending') return null;

  const isSelectedCase = caseStatus === 'selected';
  const isRejectedCase = caseStatus === 'rejected';

  const VerdictIcon = isSelectedCase ? CheckCircle : isRejectedCase ? XCircle : AlertCircle;
  const verdictMain = isSelectedCase ? '선정' : isRejectedCase ? '비선정' : '검토 필요';

  const reasonText = judgmentReason != null ? String(judgmentReason).trim() : '';
  const showJudgmentReasonCard =
    reasonText.length > 0 && (isSelectedCase || isRejectedCase);

  const JudgmentRibbonIcon = isSelectedCase ? CheckCircle : XCircle;

  return (
    <div className="ai-insight-stack">
      <div className="ai-result ai-result--analysis">
        <div className="ai-result__ribbon ai-result__ribbon--status">
          <span>선정 여부</span>
        </div>

        <section className="ai-result__block ai-result__block--verdict" aria-label="선정 여부">
          <div
            className={`ai-verdict-card ai-verdict-card--${isSelectedCase ? 'yes' : isRejectedCase ? 'no' : 'neutral'}`}
          >
            <div className="ai-verdict-card__icon" aria-hidden>
              <VerdictIcon size={28} strokeWidth={2} />
            </div>
            <div className="ai-verdict-card__body">
              <p className="ai-verdict-card__value ai-verdict-card__value--solo">{verdictMain}</p>
            </div>
          </div>
        </section>
      </div>

      {showJudgmentReasonCard && (
        <div
          className={`ai-result ai-result--judgment-card ${isSelectedCase ? 'ai-result--judgment-card--selected' : 'ai-result--judgment-card--rejected'}`}
        >
          <div
            className={`ai-result__ribbon ai-result__ribbon--judgment ${isSelectedCase ? 'ai-result__ribbon--judgment-selected' : 'ai-result__ribbon--judgment-rejected'}`}
          >
            <JudgmentRibbonIcon size={16} strokeWidth={2.2} aria-hidden />
            <span>{isSelectedCase ? '선정 사유' : '비선정 사유'}</span>
          </div>
          <section className="ai-result__block ai-result__block--judgment-reason" aria-label="선정·비선정 사유">
            {judgedAtLabel ? (
              <p className="ai-judgment-meta">판정일: {judgedAtLabel}</p>
            ) : null}
            <div className="ai-judgment-reason-panel">
              <p className="ai-judgment-reason-text">{reasonText}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
