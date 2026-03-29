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
  ClipboardList,
  Gavel,
  Mic,
  MessageSquare,
  Quote,
} from 'lucide-react';
import { judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { mockRunAiAnalysis } from '../../utils/mockCaseAiAnalysis';
import { serializeAiSnapshotForJudge } from '../../utils/aiSnapshot';
import './CaseReviewModal.css';

const TOTAL_STEPS = 3;

function formatSubmittedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CaseReviewModal({
  caseData,
  memberName,
  onClose,
  overlayClassName = '',
  onRefreshCase,
  variant = 'wizard',
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const [aiMockResult, setAiMockResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sttRefreshing, setSttRefreshing] = useState(false);

  const isPending = caseData.status === 'pending';
  const isDetailMode = variant === 'detail';
  const aiSnap =
    caseData.aiKeyPoint &&
    typeof caseData.aiKeyPoint === 'object' &&
    !Array.isArray(caseData.aiKeyPoint)
      ? caseData.aiKeyPoint
      : null;

  const sttBody = caseData.fullTranscript && String(caseData.fullTranscript).trim();

  useEffect(() => {
    setStep(1);
    setAiMockResult(null);
    setDecision('');
    setReason('');
    setError('');
  }, [caseData.id]);

  /** STT가 없을 때는 AI(2단계) 화면을 쓰지 않으므로, 잘못 머물면 3단계로 보정 */
  useEffect(() => {
    if (isDetailMode || !isPending) return;
    if (step === 2 && !sttBody) {
      setStep(3);
    }
  }, [isDetailMode, isPending, step, sttBody]);

  const mutation = useMutation({
    mutationFn: ({ decision: d, reason: r, aiKeyPoint }) =>
      judgeCase({
        caseId: caseData.id,
        decision: d,
        reason: r,
        adminSkid: user?.skid,
        aiKeyPoint,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
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
    } catch {
      setError('AI 분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAiLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    setStep((s) => {
      if (s === 3 && !sttBody) return 1;
      return Math.max(1, s - 1);
    });
  };

  const goNext = () => {
    setError('');
    setStep((s) => {
      if (s === 1 && !sttBody) return 3;
      return Math.min(TOTAL_STEPS, s + 1);
    });
  };

  const stepDotDone = (n) => {
    if (!sttBody && step === 3) return n === 1;
    return n < step;
  };
  const stepDotSkipped = (n) => !sttBody && step === 3 && n === 2;

  const handleJudge = () => {
    if (!decision) {
      setError('선정 또는 비선정을 선택해 주세요. (필수)');
      return;
    }
    if (!reason.trim()) {
      setError('구성원 피드백을 입력해 주세요. (필수)');
      return;
    }
    setError('');
    mutation.mutate({
      decision,
      reason: reason.trim(),
      aiKeyPoint: aiMockResult ? serializeAiSnapshotForJudge(aiMockResult) : undefined,
    });
  };

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`review-modal ${isDetailMode ? 'review-modal--detail' : 'review-modal--wizard'}`}>
        <div className="review-modal-header review-modal-header--compact">
          <div className="review-modal-title-row">
            <h2 className="review-modal-title">{caseData.title}</h2>
            <StatusBadge status={caseData.status} />
          </div>
          <p className="review-modal-sub">
            {memberName ?? caseData.memberName} · {formatCaseCallDateTime(caseData.callDate)}
          </p>
          {isPending && !isDetailMode && (
            <div className="review-step-indicator" role="tablist" aria-label={`${step}/${TOTAL_STEPS}`}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={`review-step-dot ${n === step ? 'is-active' : ''} ${stepDotDone(n) ? 'is-done' : ''} ${stepDotSkipped(n) ? 'is-skipped' : ''}`}
                  aria-label={
                    stepDotSkipped(n)
                      ? `2단계 생략 (STT 없음)`
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {isDetailMode ? (
          <div className="review-modal-body review-modal-body--detail">
            <div className="review-detail-block">
              <div className="review-detail-block__hd">
                <ClipboardList size={18} strokeWidth={2} aria-hidden />
                접수 내용
              </div>
              <div className="review-detail-block__bd">
                <div className="review-detail-field">
                  <span className="review-detail-label">우수 상담내용</span>
                  <p className="review-detail-text">{caseData.description?.trim() || '—'}</p>
                </div>
                <dl className="review-detail-dl">
                  <div>
                    <dt>고객 유형</dt>
                    <dd>{caseData.customerType?.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>통화 길이</dt>
                    <dd>{caseData.callDuration?.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>접수 일시</dt>
                    <dd>{formatSubmittedAt(caseData.submittedAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="review-detail-block">
              <div className="review-detail-block__hd review-detail-block__hd--row">
                <span>
                  <Mic size={18} strokeWidth={2} aria-hidden />
                  녹취 전사 (STT)
                </span>
                {typeof onRefreshCase === 'function' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm review-stt-refresh-btn"
                    onClick={async () => {
                      setSttRefreshing(true);
                      setError('');
                      try {
                        await onRefreshCase();
                      } finally {
                        setSttRefreshing(false);
                      }
                    }}
                    disabled={sttRefreshing}
                  >
                    {sttRefreshing ? '…' : '다시 불러오기'}
                  </button>
                )}
              </div>
              <div className="review-detail-block__bd review-detail-block__bd--stt">
                {sttBody ? (
                  <pre className="review-detail-stt">{caseData.fullTranscript}</pre>
                ) : (
                  <p className="review-detail-empty">연동된 STT 전사가 없습니다.</p>
                )}
                {caseData.aiKeyPhrase && String(caseData.aiKeyPhrase).trim() && (
                  <div className="review-detail-subblock">
                    <span className="review-detail-label">핵심 멘트 (AI 추출)</span>
                    <pre className="review-detail-stt review-detail-stt--muted">{caseData.aiKeyPhrase}</pre>
                  </div>
                )}
              </div>
            </div>

            <div className="review-detail-block">
              <div className="review-detail-block__hd">
                <Gavel size={18} strokeWidth={2} aria-hidden />
                판정 내용
              </div>
              <div className="review-detail-block__bd">
                {isPending ? (
                  <p className="review-detail-empty">
                    아직 판정 전입니다. 판정·선정 처리는 <strong>검토 대기</strong> 화면에서 진행할 수 있습니다.
                  </p>
                ) : (
                  <>
                    <div
                      className={`review-detail-verdict ${
                        caseData.status === 'selected' ? 'is-sel' : 'is-rej'
                      }`}
                    >
                      {caseData.status === 'selected' ? (
                        <>
                          <CheckCircle size={16} aria-hidden />
                          <strong>선정</strong>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} aria-hidden />
                          <strong>비선정</strong>
                        </>
                      )}
                      {caseData.judgedAt && (
                        <span className="review-detail-verdict__date">판정 {formatSubmittedAt(caseData.judgedAt)}</span>
                      )}
                    </div>
                    {caseData.judgmentReason?.trim() ? (
                      <p className="review-detail-text review-detail-text--judge">{caseData.judgmentReason}</p>
                    ) : (
                      <p className="review-detail-empty">판정 사유가 등록되지 않았습니다.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="review-detail-block review-detail-block--ai">
              <div className="review-detail-block__hd">
                <Sparkles size={18} strokeWidth={2} aria-hidden />
                AI 분석 (저장 스냅샷)
              </div>
              <div className="review-detail-block__bd">
                {!aiSnap ? (
                  <p className="review-detail-empty">
                    저장된 AI 스냅샷이 없습니다. 검토 대기에서 판정 시 AI 분석을 실행하면 추천·핵심멘트·피드백이
                    여기에 남습니다.
                  </p>
                ) : (
                  <div className="review-detail-ai-trio">
                    <div
                      className={`review-detail-ai-card review-detail-ai-card--verdict review-detail-ai-card--${
                        aiSnap.recommendation === 'selected'
                          ? 'sel'
                          : aiSnap.recommendation === 'rejected'
                            ? 'rej'
                            : 'unk'
                      }`}
                    >
                      <span className="review-detail-ai-card__tag">AI 추천</span>
                      <div className="review-detail-ai-card__verdict">
                        {aiSnap.recommendation === 'selected' ? (
                          <>
                            <CheckCircle size={18} aria-hidden />
                            <strong>선정</strong>
                          </>
                        ) : aiSnap.recommendation === 'rejected' ? (
                          <>
                            <XCircle size={18} aria-hidden />
                            <strong>비선정</strong>
                          </>
                        ) : (
                          <span className="review-detail-ai-card__na">기록 없음</span>
                        )}
                      </div>
                      <div className="review-detail-ai-card__meta">
                        {typeof aiSnap.confidence === 'number' && <span>신뢰도 {aiSnap.confidence}%</span>}
                        {typeof aiSnap.score === 'number' && <span>점수 {aiSnap.score}</span>}
                      </div>
                    </div>
                    <div className="review-detail-ai-card review-detail-ai-card--body">
                      <span className="review-detail-ai-card__lbl">핵심멘트</span>
                      <p className="review-detail-ai-card__txt">
                        {String(aiSnap.keyMessage || aiSnap.rationale || aiSnap.summary || '—')}
                      </p>
                    </div>
                    <div className="review-detail-ai-card review-detail-ai-card--body">
                      <span className="review-detail-ai-card__lbl">피드백</span>
                      <p className="review-detail-ai-card__txt">{String(aiSnap.feedback || aiSnap.summary || '—')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
        <div className="review-modal-body review-modal-body--wizard">
          {isPending ? (
            <>
              {step === 1 && (
                <div className="review-step-pane review-step-pane--stt">
                  <div className="review-stt-step-intro">
                    <span className="review-ai-panel__kicker">1단계 · 녹취 확인</span>
                    <h3 className="review-stt-step-intro__title">STT 전사</h3>
                    <p className="review-stt-step-intro__desc">
                      TB_YOU_PRO_STT에서 불러온 녹취입니다. 전사가 없거나 건너뛰면 AI 참고 단계 없이 바로 최종
                      판정(3단계)으로 이동합니다.
                    </p>
                  </div>
                  <div className="review-stt-step-head">
                    <h3 className="review-step-title">전사 본문</h3>
                    {typeof onRefreshCase === 'function' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm review-stt-refresh-btn"
                        onClick={async () => {
                          setSttRefreshing(true);
                          setError('');
                          try {
                            await onRefreshCase();
                          } finally {
                            setSttRefreshing(false);
                          }
                        }}
                        disabled={sttRefreshing}
                        title="녹취 적재 후 최신 전사를 다시 가져옵니다"
                      >
                        {sttRefreshing ? '…' : 'STT 다시 불러오기'}
                      </button>
                    )}
                  </div>
                  {sttBody ? (
                    <div className="review-stt-preview review-stt-preview--step">{caseData.fullTranscript}</div>
                  ) : (
                    <div className="review-stt-preview review-stt-preview--step review-stt-preview--empty">
                      <p className="review-stt-empty-short">STT 분석 시스템을 통해서 녹취록을 분석해주세요.</p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm review-stt-skip-btn"
                        onClick={() => {
                          setError('');
                          goNext();
                        }}
                      >
                        건너뛰기
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="review-step-pane review-step-pane--ai">
                  <div className="review-ai-panel">
                    <header className="review-ai-panel__intro">
                      <div className="review-ai-panel__intro-text">
                        <span className="review-ai-panel__kicker">2단계 · 참고 분석</span>
                        <h3 className="review-ai-panel__title">AI 1차 분석</h3>
                        <p className="review-ai-panel__desc">
                          실행 시 <strong>선정/비선정 추천</strong>, <strong>핵심멘트</strong>,{' '}
                          <strong>피드백</strong> 세 가지를 확인할 수 있습니다. (현재 mock 데이터) 최종 판정은
                          다음 단계에서 직접 선택합니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="review-ai-panel__run"
                        onClick={runMockAi}
                        disabled={aiLoading}
                        aria-busy={aiLoading}
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 size={18} strokeWidth={2.25} className="review-spin" aria-hidden />
                            분석 중…
                          </>
                        ) : (
                          <>
                            <Sparkles size={18} strokeWidth={2.25} aria-hidden />
                            AI 분석 실행
                          </>
                        )}
                      </button>
                    </header>

                    {!aiMockResult && !aiLoading && (
                      <div className="review-ai-panel__empty">
                        <div className="review-ai-panel__empty-icon" aria-hidden>
                          <Sparkles size={22} strokeWidth={1.75} />
                        </div>
                        <p>버튼을 누르면 분석 카드가 아래에 표시됩니다.</p>
                      </div>
                    )}

                    {aiMockResult && (
                      <div className="review-ai-trio fade-in" role="region" aria-label="AI 분석 결과">
                        <article
                          className={`review-ai-card review-ai-card--verdict review-ai-card--${
                            aiMockResult.recommendation === 'selected' ? 'sel' : 'rej'
                          }`}
                        >
                          <div className="review-ai-card__hd">
                            <span className="review-ai-card__tag">AI 추천</span>
                            <span className="review-ai-card__meta">
                              신뢰도 {aiMockResult.confidence}% · 점수 {aiMockResult.score}
                            </span>
                          </div>
                          <div className="review-ai-card__verdict-row">
                            {aiMockResult.recommendation === 'selected' ? (
                              <>
                                <CheckCircle size={22} strokeWidth={2.25} aria-hidden />
                                <strong>선정</strong>
                              </>
                            ) : (
                              <>
                                <XCircle size={22} strokeWidth={2.25} aria-hidden />
                                <strong>비선정</strong>
                              </>
                            )}
                          </div>
                          <p className="review-ai-card__hint">참고용이며, 최종 결정과 다를 수 있습니다.</p>
                        </article>

                        <article className="review-ai-card review-ai-card--key">
                          <div className="review-ai-card__hd">
                            <Quote size={18} strokeWidth={2.25} aria-hidden />
                            <span className="review-ai-card__label">핵심멘트</span>
                          </div>
                          <p className="review-ai-card__body review-ai-card__body--key">{aiMockResult.keyMessage}</p>
                        </article>

                        <article className="review-ai-card review-ai-card--fb">
                          <div className="review-ai-card__hd">
                            <MessageSquare size={18} strokeWidth={2.25} aria-hidden />
                            <span className="review-ai-card__label">피드백</span>
                          </div>
                          <p className="review-ai-card__body">{aiMockResult.feedback}</p>
                        </article>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="review-step-pane review-step-pane--judge">
                  <div className="review-judge-intro">
                    <span className="review-ai-panel__kicker">3단계 · 최종 판정</span>
                    <h3 className="review-judge-intro__title">구성원 사례 판정</h3>
                    <p className="review-judge-intro__desc">
                      선정 또는 비선정을 선택하고, 구성원에게 전달할 피드백을 남겨 주세요. 두 항목 모두 필수입니다.
                    </p>
                  </div>

                  <div className="review-judge-field">
                    <span className="review-judge-field__label">
                      판정 <span className="review-req">*</span>
                    </span>
                    <div className="judge-options judge-options--wizard" role="group" aria-label="선정 또는 비선정">
                      <button
                        type="button"
                        className={`judge-option judge-option--sel ${decision === 'selected' ? 'is-active' : ''}`}
                        onClick={() => {
                          setError('');
                          setDecision('selected');
                        }}
                      >
                        <CheckCircle size={18} strokeWidth={2.25} aria-hidden />
                        선정
                      </button>
                      <button
                        type="button"
                        className={`judge-option judge-option--rej ${decision === 'rejected' ? 'is-active' : ''}`}
                        onClick={() => {
                          setError('');
                          setDecision('rejected');
                        }}
                      >
                        <XCircle size={18} strokeWidth={2.25} aria-hidden />
                        비선정
                      </button>
                    </div>
                    {!decision && (
                      <p className="review-judge-field__hint">선택 전에는 두 버튼 모두 비활성(회색) 상태입니다.</p>
                    )}
                  </div>

                  <div className="review-judge-field">
                    <label className="review-judge-field__label" htmlFor="review-final-reason">
                      구성원 피드백 <span className="review-req">*</span>
                    </label>
                    <textarea
                      id="review-final-reason"
                      className="judge-textarea judge-textarea--step"
                      value={reason}
                      onChange={(e) => {
                        setError('');
                        setReason(e.target.value);
                      }}
                      rows={5}
                      placeholder="판정 근거와 구성원에게 전달할 코멘트를 입력하세요."
                      autoComplete="off"
                    />
                    <p className="review-judge-field__foot">저장 시 사례의 판정 사유로 등록됩니다.</p>
                  </div>

                  {error && (
                    <div className="judge-error judge-error--compact" role="alert">
                      <AlertTriangle size={13} aria-hidden />
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
        )}

        {isPending && !isDetailMode && (
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
