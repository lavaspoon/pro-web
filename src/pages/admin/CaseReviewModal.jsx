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
} from 'lucide-react';
import { judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import './CaseReviewModal.css';

const TOTAL_STEPS = 2;

function formatSubmittedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getAiFirstStructured(aiKeyPoint) {
  if (aiKeyPoint != null && typeof aiKeyPoint === 'object' && !Array.isArray(aiKeyPoint)) {
    const keys = Object.keys(aiKeyPoint);
    if (keys.length === 0) return null;
    return aiKeyPoint;
  }
  return null;
}

function getAiFirstPlainText(aiKeyPoint) {
  if (typeof aiKeyPoint === 'string' && aiKeyPoint.trim()) return aiKeyPoint.trim();
  return null;
}

function hasAiFirstRound(aiKeyPoint) {
  return Boolean(getAiFirstStructured(aiKeyPoint) || getAiFirstPlainText(aiKeyPoint));
}

function AiFirstRoundContent({ aiKeyPoint }) {
  const snap = getAiFirstStructured(aiKeyPoint);
  const plain = getAiFirstPlainText(aiKeyPoint);

  if (plain) {
    return <pre className="review-detail-stt review-ai-first-plain">{plain}</pre>;
  }
  if (!snap) return null;

  const showCards =
    snap.recommendation != null ||
    snap.keyMessage != null ||
    snap.feedback != null ||
    snap.summary != null ||
    snap.rationale != null ||
    typeof snap.confidence === 'number' ||
    typeof snap.score === 'number';

  if (!showCards) {
    return (
      <pre className="review-detail-stt review-ai-first-plain">{JSON.stringify(snap, null, 2)}</pre>
    );
  }

  return (
    <div className="review-detail-ai-trio">
      <div
        className={`review-detail-ai-card review-detail-ai-card--verdict review-detail-ai-card--${
          snap.recommendation === 'selected' ? 'sel' : snap.recommendation === 'rejected' ? 'rej' : 'unk'
        }`}
      >
        <span className="review-detail-ai-card__tag">AI 1차 추천</span>
        <div className="review-detail-ai-card__verdict">
          {snap.recommendation === 'selected' ? (
            <>
              <CheckCircle size={18} aria-hidden />
              <strong>선정</strong>
            </>
          ) : snap.recommendation === 'rejected' ? (
            <>
              <XCircle size={18} aria-hidden />
              <strong>비선정</strong>
            </>
          ) : (
            <span className="review-detail-ai-card__na">판정 없음 / 참고용</span>
          )}
        </div>
        <div className="review-detail-ai-card__meta">
          {typeof snap.confidence === 'number' && <span>신뢰도 {snap.confidence}%</span>}
          {typeof snap.score === 'number' && <span>점수 {snap.score}</span>}
        </div>
      </div>
      <div className="review-detail-ai-card review-detail-ai-card--body">
        <span className="review-detail-ai-card__lbl">핵심멘트</span>
        <p className="review-detail-ai-card__txt">
          {String(snap.keyMessage || snap.rationale || snap.summary || '—')}
        </p>
      </div>
      <div className="review-detail-ai-card review-detail-ai-card--body">
        <span className="review-detail-ai-card__lbl">피드백</span>
        <p className="review-detail-ai-card__txt">{String(snap.feedback || snap.summary || '—')}</p>
      </div>
    </div>
  );
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
  const [aiRefreshing, setAiRefreshing] = useState(false);

  const isPending = caseData.status === 'pending';
  const isDetailMode = variant === 'detail';
  const aiFirstLoaded = hasAiFirstRound(caseData.aiKeyPoint);

  useEffect(() => {
    setStep(1);
    setDecision('');
    setReason('');
    setError('');
  }, [caseData.id]);

  const mutation = useMutation({
    mutationFn: ({ decision: d, reason: r }) =>
      judgeCase({
        caseId: caseData.id,
        decision: d,
        reason: r,
        adminSkid: user?.skid,
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

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    setError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const stepDotDone = (n) => n < step;

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
    });
  };

  const refreshAiFirst = async () => {
    if (typeof onRefreshCase !== 'function') return;
    setAiRefreshing(true);
    setError('');
    try {
      await onRefreshCase();
    } finally {
      setAiRefreshing(false);
    }
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
                  className={`review-step-dot ${n === step ? 'is-active' : ''} ${stepDotDone(n) ? 'is-done' : ''}`}
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

            <div className="review-detail-block review-detail-block--ai">
              <div className="review-detail-block__hd review-detail-block__hd--row">
                <span>
                  <Sparkles size={18} strokeWidth={2} aria-hidden />
                  AI 1차 판단
                </span>
                {typeof onRefreshCase === 'function' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm review-ai-first-refresh-btn"
                    onClick={refreshAiFirst}
                    disabled={aiRefreshing}
                    title="녹취 시스템 반영 후 DB의 최신 1차 결과를 다시 불러옵니다"
                  >
                    {aiRefreshing ? '…' : '새로고침'}
                  </button>
                )}
              </div>
              <div className="review-detail-block__bd">
                {aiFirstLoaded ? (
                  <AiFirstRoundContent aiKeyPoint={caseData.aiKeyPoint} />
                ) : (
                  <p className="review-detail-empty">
                    아직 AI 1차 판단 결과가 없습니다. 별도 녹취 시스템에서 재생·분석이 완료되면 사례에 반영되며,
                    상단의 새로고침으로 확인할 수 있습니다.
                  </p>
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
          </div>
        ) : (
          <div className="review-modal-body review-modal-body--wizard">
            {isPending ? (
              <>
                {step === 1 && (
                  <div className="review-step-pane review-step-pane--ai-first">
                    <div className="review-stt-step-intro">
                      <span className="review-ai-panel__kicker">1단계 · AI 1차 판단</span>
                      <h3 className="review-stt-step-intro__title">별도 시스템 분석 결과</h3>
                      <p className="review-stt-step-intro__desc">
                        녹취록 재생·분석이 완료되면 사례 DB에 AI 1차 판단이 저장됩니다.{' '}
                        <strong>새로고침</strong>으로 최신 내용을 불러온 뒤, 2단계에서 그 내용을 참고해 최종 선정
                        여부를 결정합니다. 결과가 아직 없으면 건너뛰고 바로 최종 판정으로 이동할 수 있습니다.
                      </p>
                    </div>
                    <div className="review-stt-step-head">
                      <h3 className="review-step-title">1차 판단 내용</h3>
                      {typeof onRefreshCase === 'function' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm review-ai-first-refresh-btn"
                          onClick={refreshAiFirst}
                          disabled={aiRefreshing}
                          title="DB에서 최신 ai_key_point를 다시 불러옵니다"
                        >
                          {aiRefreshing ? (
                            <>
                              <Loader2 size={16} strokeWidth={2.25} className="review-spin" aria-hidden />
                              불러오는 중
                            </>
                          ) : (
                            '새로고침'
                          )}
                        </button>
                      )}
                    </div>
                    {aiFirstLoaded ? (
                      <div className="review-ai-first-body">
                        <AiFirstRoundContent aiKeyPoint={caseData.aiKeyPoint} />
                      </div>
                    ) : (
                      <div className="review-stt-preview review-stt-preview--step review-stt-preview--empty">
                        <p className="review-stt-empty-short">
                          아직 1차 판단 결과가 없습니다. 녹취 시스템에서 분석이 끝난 뒤 새로고침 하거나, 아래에서
                          건너뛸 수 있습니다.
                        </p>
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
                  <div className="review-step-pane review-step-pane--judge">
                    <div className="review-judge-intro">
                      <span className="review-ai-panel__kicker">2단계 · 최종 판정</span>
                      <h3 className="review-judge-intro__title">구성원 사례 판정</h3>
                      <p className="review-judge-intro__desc">
                        1차 AI 판단을 참고하여 선정 또는 비선정을 선택하고, 구성원에게 전달할 피드백을 남겨 주세요.
                        두 항목 모두 필수입니다.
                      </p>
                    </div>

                    {aiFirstLoaded && (
                      <div className="review-judge-ai-ref">
                        <div className="review-judge-ai-ref__hd">
                          <Sparkles size={16} strokeWidth={2} aria-hidden />
                          <span>1차 판단 참고</span>
                          {typeof onRefreshCase === 'function' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm review-ai-first-refresh-btn review-ai-first-refresh-btn--inline"
                              onClick={refreshAiFirst}
                              disabled={aiRefreshing}
                            >
                              {aiRefreshing ? '…' : '다시 불러오기'}
                            </button>
                          )}
                        </div>
                        <div className="review-judge-ai-ref__bd">
                          <AiFirstRoundContent aiKeyPoint={caseData.aiKeyPoint} />
                        </div>
                      </div>
                    )}

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
                        placeholder="1차 판단을 참고하여 판정 근거와 구성원에게 전달할 코멘트를 입력하세요."
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
