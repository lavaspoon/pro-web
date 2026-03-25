import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  CheckCircle,
  XCircle,
  Sparkles,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { mockRunAiAnalysis } from '../../utils/mockCaseAiAnalysis';
import { MOCK_STT_TRANSCRIPT } from '../../utils/mockCaseReviewDemo';
import { serializeAiSnapshotForJudge } from '../../utils/aiSnapshot';
import './CaseReviewModal.css';

const TOTAL_STEPS = 3;

export default function CaseReviewModal({ caseData, memberName, onClose, overlayClassName = '' }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const [aiMockResult, setAiMockResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const isPending = caseData.status === 'pending';

  useEffect(() => {
    setStep(1);
    setAiMockResult(null);
    setDecision('');
    setReason('');
    setError('');
  }, [caseData.id]);

  const mutation = useMutation({
    mutationFn: ({ decision: d, reason: r, aiSnapshotJson }) =>
      judgeCase({
        caseId: caseData.id,
        decision: d,
        reason: r,
        adminSkid: user?.skid,
        aiSnapshotJson,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-member-cases'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail', String(caseData.id)] });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const runMockAi = async () => {
    setAiLoading(true);
    setError('');
    try {
      const result = await mockRunAiAnalysis({
        fullTranscript: caseData.fullTranscript,
        title: caseData.title,
        callDate: caseData.callDate,
      });
      setAiMockResult(result);
      setDecision(result.recommendation);
      setReason(
        `[AI ${result.recommendation === 'selected' ? '선정' : '비선정'} ${result.confidence}%] ${result.rationale}`
      );
    } catch {
      setError('실패');
    } finally {
      setAiLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    setError('');
    if (step === 2) {
      if (!aiMockResult) {
        setError('AI 분석 필요');
        return;
      }
      setDecision(aiMockResult.recommendation);
      setReason(
        `[AI ${aiMockResult.recommendation === 'selected' ? '선정' : '비선정'} ${aiMockResult.confidence}%] ${aiMockResult.rationale}`
      );
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleJudge = () => {
    if (!aiMockResult) {
      setError('AI 분석 필요');
      return;
    }
    if (!decision) {
      setError('선정/비선정 선택');
      return;
    }
    if (!reason.trim()) {
      setError('사유 입력');
      return;
    }
    setError('');
    mutation.mutate({
      decision,
      reason: reason.trim(),
      aiSnapshotJson: serializeAiSnapshotForJudge(aiMockResult),
    });
  };

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="review-modal review-modal--wizard">
        <div className="review-modal-header review-modal-header--compact">
          <div className="review-modal-title-row">
            <h2 className="review-modal-title">{caseData.title}</h2>
            <StatusBadge status={caseData.status} />
          </div>
          <p className="review-modal-sub">
            {memberName ?? caseData.memberName} · {formatCaseCallDateTime(caseData.callDate)}
          </p>
          {isPending && (
            <div className="review-step-indicator" role="tablist" aria-label={`${step}/${TOTAL_STEPS}`}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={`review-step-dot ${n === step ? 'is-active' : ''} ${n < step ? 'is-done' : ''}`}
                />
              ))}
            </div>
          )}
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="review-modal-body review-modal-body--wizard">
          {isPending ? (
            <>
              {step === 1 && (
                <div className="review-step-pane">
                  <h3 className="review-step-title">STT</h3>
                  <div className="review-stt-preview review-stt-preview--step">{MOCK_STT_TRANSCRIPT}</div>
                </div>
              )}

              {step === 2 && (
                <div className="review-step-pane review-step-pane--ai">
                  <div className="review-ai-step">
                    <div className="review-ai-step-head">
                      <h3 className="review-step-title">AI 분석</h3>
                      <p className="review-ai-step-hint">
                        통화 전사를 바탕으로 선정·비선정 의견과 핵심 대화를 생성합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="review-ai-run-btn"
                      onClick={runMockAi}
                      disabled={aiLoading}
                      aria-busy={aiLoading}
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 size={17} strokeWidth={2.25} className="review-spin" aria-hidden />
                          <span className="review-ai-run-btn__label">분석 중입니다…</span>
                        </>
                      ) : (
                        <>
                          <span className="review-ai-run-btn__icon" aria-hidden>
                            <Sparkles size={18} strokeWidth={2.25} />
                          </span>
                          <span className="review-ai-run-btn__label">AI 분석 실행</span>
                        </>
                      )}
                    </button>
                    {aiMockResult && (
                      <div className="review-ai-compact fade-in">
                        <div
                          className={`review-ai-verdict review-ai-verdict--compact ${
                            aiMockResult.recommendation === 'selected' ? 'is-sel' : 'is-rej'
                          }`}
                        >
                          <span className="review-ai-verdict__main">
                            {aiMockResult.recommendation === 'selected' ? (
                              <>
                                <CheckCircle size={18} strokeWidth={2.25} aria-hidden />
                                <strong>선정</strong>
                              </>
                            ) : (
                              <>
                                <XCircle size={18} strokeWidth={2.25} aria-hidden />
                                <strong>비선정</strong>
                              </>
                            )}
                          </span>
                          <span className="review-ai-meta-inline">
                            신뢰도 {aiMockResult.confidence}% · 점수 {aiMockResult.score}
                          </span>
                        </div>
                        <div className="review-ai-summary-card">
                          <span className="review-ai-summary-card__label">요약</span>
                          <p className="review-ai-one-liner">{aiMockResult.rationale}</p>
                        </div>
                        <div className="review-ai-chat-wrap">
                          <span className="review-ai-chat-wrap__label">핵심 대화</span>
                          <div className="review-ai-chat review-ai-chat--step">
                            {aiMockResult.chatTurns.map((turn, i) => (
                              <div key={i} className={`review-ai-msg review-ai-msg--${turn.role}`}>
                                <span className="review-ai-msg-role">
                                  {turn.role === 'customer'
                                    ? '고객'
                                    : turn.role === 'agent'
                                      ? '상담사'
                                      : '안내'}
                                </span>
                                <div className="review-ai-msg-bubble">{turn.text}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="review-step-pane">
                  <h3 className="review-step-title">판정</h3>
                  <div className="judge-options judge-options--compact">
                    <button
                      type="button"
                      className={`judge-option selected-opt ${decision === 'selected' ? 'active' : ''}`}
                      onClick={() => setDecision('selected')}
                    >
                      <CheckCircle size={16} />
                      선정
                    </button>
                    <button
                      type="button"
                      className={`judge-option rejected-opt ${decision === 'rejected' ? 'active' : ''}`}
                      onClick={() => setDecision('rejected')}
                    >
                      <XCircle size={16} />
                      비선정
                    </button>
                  </div>
                  <textarea
                    id="review-final-reason"
                    className="judge-textarea judge-textarea--step"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={5}
                  />
                  {error && (
                    <div className="judge-error judge-error--compact">
                      <AlertTriangle size={13} />
                      {error}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="review-step-pane review-step-pane--readonly">
              {caseData.judgmentReason && (
                <div
                  className={`existing-judgment existing-judgment--compact ${
                    caseData.status === 'selected' ? 'j-selected' : 'j-rejected'
                  }`}
                >
                  <strong className="judgment-label-inline">
                    {caseData.status === 'selected' ? (
                      <>
                        <CheckCircle size={12} /> 선정
                      </>
                    ) : (
                      <>
                        <XCircle size={12} /> 비선정
                      </>
                    )}
                  </strong>
                  <p>{caseData.judgmentReason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isPending && (
          <div className="review-wizard-footer">
            <div className="review-wizard-footer__start">
              {step > 1 && (
                <button type="button" className="btn btn-secondary btn-compact review-wizard-nav" onClick={goBack}>
                  <ChevronLeft size={16} />
                  이전
                </button>
              )}
            </div>
            <div className="review-wizard-footer__end">
              {step < TOTAL_STEPS ? (
                <button type="button" className="btn btn-primary btn-compact review-wizard-nav" onClick={goNext}>
                  다음
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-compact review-wizard-nav"
                  onClick={handleJudge}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? '…' : '완료'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
