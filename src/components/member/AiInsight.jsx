import React from 'react';
import { Sparkles, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import './AiInsight.css';

export default function AiInsight({ insight }) {
  if (!insight) return null;

  const isSelected = insight.recommendation === 'selected';
  const isRejected = insight.recommendation === 'rejected';

  const RecommendIcon = isSelected ? CheckCircle : isRejected ? XCircle : AlertCircle;
  const recommendLabel = isSelected ? '선정 추천' : isRejected ? '비선정 추천' : '검토 필요';
  const recommendClass = isSelected ? 'rec-selected' : isRejected ? 'rec-rejected' : 'rec-neutral';

  const highlights = Array.isArray(insight.highlights) ? insight.highlights : [];
  const chatTurns = Array.isArray(insight.chatTurns) ? insight.chatTurns : [];

  return (
    <div className="ai-insight">
      <div className="ai-header">
        <div className="ai-title-row">
          <Sparkles size={18} className="ai-icon" />
          <span className="ai-title">AI 인사이트</span>
          <span className="ai-badge">Beta</span>
        </div>
        <div className={`ai-recommendation ${recommendClass}`}>
          <RecommendIcon size={14} />
          {recommendLabel}
        </div>
      </div>

      <div className="ai-score-row">
        <div className="ai-score-label">
          <TrendingUp size={14} />
          <span>응대 품질 점수</span>
        </div>
        <div className="ai-score-bar-wrap">
          <div
            className="ai-score-bar"
            style={{
              width: `${insight.score}%`,
              background:
                insight.score >= 80
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : insight.score >= 60
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #ef4444, #dc2626)',
            }}
          />
        </div>
        <span className="ai-score-value">{insight.score}점</span>
        <span className="ai-confidence">신뢰도 {insight.confidence}%</span>
      </div>

      {insight.summary && <p className="ai-summary">{insight.summary}</p>}
      {insight.rationale && <p className="ai-rationale">{insight.rationale}</p>}

      {highlights.length > 0 && (
        <div className="ai-highlights">
          {highlights.map((h, i) => (
            <div key={i} className="ai-highlight-item">
              <span className="ai-dot" />
              {h}
            </div>
          ))}
        </div>
      )}

      {chatTurns.length > 0 && (
        <div className="ai-key-chat">
          <h4 className="ai-key-chat-title">핵심 대화</h4>
          <div className="ai-key-chat-scroll">
            {chatTurns.map((turn, i) => (
              <div key={i} className={`ai-key-msg ai-key-msg--${turn.role}`}>
                <span className="ai-key-msg-role">
                  {turn.role === 'customer' ? '고객' : turn.role === 'agent' ? '상담사' : '안내'}
                </span>
                <div className="ai-key-msg-bubble">{turn.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
