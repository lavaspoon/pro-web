import React from 'react';
import { Sparkles, MessageSquareQuote, ClipboardPenLine, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import './AiInsight.css';

export default function AiInsight({ insight }) {
  if (!insight) return null;

  const isSelected = insight.recommendation === 'selected';
  const isRejected = insight.recommendation === 'rejected';

  const VerdictIcon = isSelected ? CheckCircle : isRejected ? XCircle : AlertCircle;
  const verdictMain = isSelected ? '선정' : isRejected ? '비선정' : '검토 필요';
  const verdictSub = isSelected ? 'AI가 우수 사례로 판단했습니다' : isRejected ? 'AI가 보완이 필요하다고 보았습니다' : '추가 확인이 필요합니다';

  const highlights = Array.isArray(insight.highlights) ? insight.highlights.filter(Boolean) : [];
  const hasFeedback = Boolean(
    (insight.summary && String(insight.summary).trim()) || (insight.rationale && String(insight.rationale).trim()),
  );

  return (
    <div className="ai-result">
      <div className="ai-result__ribbon">
        <Sparkles size={16} strokeWidth={2.2} aria-hidden />
        <span>AI 분석</span>
      </div>

      {/* 1. AI 선정 여부 */}
      <section className="ai-result__block ai-result__block--verdict" aria-labelledby="ai-verdict-heading">
        <h3 id="ai-verdict-heading" className="ai-result__heading">
          <span className="ai-result__heading-mark" aria-hidden />
          AI 선정 여부
        </h3>
        <div
          className={`ai-verdict-card ai-verdict-card--${isSelected ? 'yes' : isRejected ? 'no' : 'neutral'}`}
        >
          <div className="ai-verdict-card__icon" aria-hidden>
            <VerdictIcon size={28} strokeWidth={2} />
          </div>
          <div className="ai-verdict-card__body">
            <p className="ai-verdict-card__label">AI 판단</p>
            <p className="ai-verdict-card__value">{verdictMain}</p>
            <p className="ai-verdict-card__hint">{verdictSub}</p>
            {typeof insight.score === 'number' && (
              <div className="ai-verdict-card__scores">
                <span className="ai-verdict-chip">응대 점수 {insight.score}점</span>
                {typeof insight.confidence === 'number' && (
                  <span className="ai-verdict-chip">신뢰도 {insight.confidence}%</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. 핵심 멘트 */}
      {highlights.length > 0 && (
        <section className="ai-result__block" aria-labelledby="ai-ments-heading">
          <h3 id="ai-ments-heading" className="ai-result__heading">
            <MessageSquareQuote size={17} strokeWidth={2.1} aria-hidden />
            핵심 멘트
          </h3>
          <p className="ai-result__lede">AI가 뽑은 응대·안내 문장의 핵심입니다.</p>
          <ol className="ai-ment-list">
            {highlights.map((h, i) => (
              <li key={i} className="ai-ment-item">
                <span className="ai-ment-item__idx">{i + 1}</span>
                <span className="ai-ment-item__text">{h}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 3. 피드백 */}
      {hasFeedback && (
        <section className="ai-result__block ai-result__block--feedback" aria-labelledby="ai-feedback-heading">
          <h3 id="ai-feedback-heading" className="ai-result__heading">
            <ClipboardPenLine size={17} strokeWidth={2.1} aria-hidden />
            피드백
          </h3>
          <div className="ai-feedback-panel">
            {insight.summary && String(insight.summary).trim() && (
              <p className="ai-feedback-panel__lead">{insight.summary.trim()}</p>
            )}
            {insight.rationale && String(insight.rationale).trim() && (
              <p className="ai-feedback-panel__detail">{insight.rationale.trim()}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
