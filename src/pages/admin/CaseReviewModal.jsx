import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2, Save, ChevronLeft, ChevronRight, Check, Undo2 } from 'lucide-react';
import { cancelCaseDraftJudgment, cancelCaseFinalJudgment, judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import { isYouProMonitoring } from '../../utils/youProRole';
import CaseScorePanel from '../../components/case/CaseScorePanel';
import CaseDetailMetaRow from '../../components/case/CaseDetailMetaRow';
import { parseCaseCallDateTime } from '../../utils/caseDisplay';
import {
  DEFAULT_CERTIFICATION_MIN_TOTAL,
  buildJudgePayload,
  decisionFromTotal,
  emptyScoreForm,
  parseScoreValue,
  scoresFromCaseData,
  sumScores,
  CASE_SCORE_ITEMS,
} from '../../utils/caseEvaluation';
import '../../components/member/MemberCaseEvaluationView.css';
import '../../components/member/MemberCaseDetailModal.css';
import './CaseReviewModal.css';

export default function CaseReviewModal({
  caseData,
  memberName,
  deptHierarchy = '',
  onClose,
  overlayClassName = '',
  onRefreshCase,
  /** 다중 검토: { currentIndex, total, onPrev, onNext } */
  reviewNavigation = null,
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isMonitoringUser = isYouProMonitoring(user);
  const [scoreForm, setScoreForm] = useState(emptyScoreForm);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saveMode, setSaveMode] = useState(null);
  const [liveCase, setLiveCase] = useState(caseData);
  /** 최종 저장 시 인증·미인증 — 점수 기준 자동 제안, 수동 변경 가능 */
  const [manualDecision, setManualDecision] = useState('rejected');
  const decisionTouchedRef = useRef(false);

  useEffect(() => {
    setLiveCase(caseData);
  }, [caseData]);

  useEffect(() => {
    setSuccessMessage('');
    setError('');
  }, [caseData.id]);

  const caseStatus = String(liveCase.status ?? '').toLowerCase();
  const isFinalized = caseStatus === 'selected' || caseStatus === 'rejected';
  const isPhase1 = caseStatus === 'pending' && liveCase.judgmentDraft === true;
  const minTotal =
    liveCase.certificationMinTotalScore != null
      ? liveCase.certificationMinTotalScore
      : DEFAULT_CERTIFICATION_MIN_TOTAL;

  const totalScore = useMemo(() => sumScores(scoreForm), [scoreForm]);
  const previewDecision = useMemo(
    () => decisionFromTotal(totalScore, minTotal),
    [totalScore, minTotal],
  );
  /** 최종 저장 전에는 종합점수 색 중립 — 90점 이상이어도 인증(초록)처럼 보이지 않게 */
  const scoreCertTone = isFinalized
    ? caseStatus === 'selected'
      ? 'cert'
      : 'uncert'
    : 'neutral';

  const displayMemberName = memberName ?? liveCase.memberName ?? '구성원';
  const displayDeptHierarchy =
    (deptHierarchy && String(deptHierarchy).trim()) ||
    (liveCase.teamName && String(liveCase.teamName).trim()) ||
    '';
  const callDateTime = useMemo(
    () => parseCaseCallDateTime(liveCase.callDate),
    [liveCase.callDate],
  );

  const syncCaseFromServer = async (updated) => {
    if (updated) {
      setLiveCase(updated);
    }
    if (typeof onRefreshCase === 'function') {
      await onRefreshCase();
    }
  };

  useEffect(() => {
    setScoreForm(scoresFromCaseData(liveCase));
    setError('');
    setSaveMode(null);
    decisionTouchedRef.current = false;
    const initial = scoresFromCaseData(liveCase);
    const st = String(liveCase.status ?? '').toLowerCase();
    if (st === 'selected' || st === 'rejected') {
      setManualDecision(st);
    } else {
      setManualDecision(decisionFromTotal(sumScores(initial), minTotal));
    }
  }, [liveCase.id, liveCase.status, liveCase.judgmentDraft, liveCase.totalScore, minTotal]);

  /** 점수 변경 시 자동 제안 — 사용자가 인증·미인증을 직접 고른 뒤에는 유지 (2차 완료 건은 기존 판정 유지) */
  useEffect(() => {
    if (decisionTouchedRef.current || isFinalized) return;
    setManualDecision(previewDecision);
  }, [previewDecision, isFinalized]);

  const mutation = useMutation({
    mutationFn: (payload) => judgeCase({ caseId: liveCase.id, ...payload }),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-member-cases'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail', String(liveCase.id)] });
      setError('');
      setSaveMode(null);
      setLiveCase(data);
      if (variables.draft) {
        setSuccessMessage('1차 인증 완료');
        await syncCaseFromServer(data);
      } else {
        setSuccessMessage('2차 인증 완료');
        await syncCaseFromServer(data);
      }
    },
    onError: (err) => {
      setError(err.message);
      setSuccessMessage('');
      setSaveMode(null);
    },
  });

  const cancelFinalMutation = useMutation({
    mutationFn: () => cancelCaseFinalJudgment({ caseId: liveCase.id, adminSkid: user.skid }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-member-cases'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail', String(liveCase.id)] });
      setError('');
      setSaveMode(null);
      setSuccessMessage('2차 인증 취소 완료');
      await syncCaseFromServer(data);
    },
    onError: (err) => {
      setError(err.message);
      setSuccessMessage('');
      setSaveMode(null);
    },
  });

  const cancelDraftMutation = useMutation({
    mutationFn: () => cancelCaseDraftJudgment({ caseId: liveCase.id, adminSkid: user.skid }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-member-cases'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail', String(liveCase.id)] });
      setError('');
      setSaveMode(null);
      setSuccessMessage('1차 인증 취소 완료');
      await syncCaseFromServer(data);
    },
    onError: (err) => {
      setError(err.message);
      setSuccessMessage('');
      setSaveMode(null);
    },
  });

  const isActionPending =
    mutation.isPending || cancelFinalMutation.isPending || cancelDraftMutation.isPending;

  const handleScoreChange = (key, value) => {
    setError('');
    setSuccessMessage('');
    setScoreForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitEvaluation = (draft) => {
    if (!user?.skid) {
      setError('로그인 정보가 없습니다.');
      return;
    }
    if (!draft) {
      const missing = CASE_SCORE_ITEMS.filter(
        ({ key, maxScore }) => parseScoreValue(scoreForm[key], maxScore) == null,
      ).map((i) => i.label);
      if (missing.length > 0) {
        setError(`2차 인증 시 모든 항목 점수가 필요합니다: ${missing.join(', ')}`);
        return;
      }
    }
    setSaveMode(draft ? 'draft' : 'final');
    setError('');
    setSuccessMessage('');
    mutation.mutate(
      buildJudgePayload({
        form: scoreForm,
        adminSkid: user.skid,
        draft,
        decision: draft ? undefined : manualDecision,
      }),
    );
  };

  const handleCancelFinal = () => {
    if (!user?.skid) {
      setError('로그인 정보가 없습니다.');
      return;
    }
    setSaveMode('cancel');
    setError('');
    setSuccessMessage('');
    cancelFinalMutation.mutate();
  };

  const handleCancelDraft = () => {
    if (!user?.skid) {
      setError('로그인 정보가 없습니다.');
      return;
    }
    setSaveMode('cancelDraft');
    setError('');
    setSuccessMessage('');
    cancelDraftMutation.mutate();
  };

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="review-modal review-modal--single">
        <div className="review-modal-header review-modal-header--compact">
          {reviewNavigation && reviewNavigation.total > 1 ? (
            <div
              className="review-modal-bulk-nav"
              role="navigation"
              aria-label="선택한 사례 순서 이동"
            >
              <button
                type="button"
                className="review-modal-bulk-nav-btn"
                onClick={reviewNavigation.onPrev}
                disabled={reviewNavigation.currentIndex <= 0}
                aria-label="이전 사례"
              >
                <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
              </button>
              <span className="review-modal-bulk-nav-pos" aria-live="polite">
                <span className="review-modal-bulk-nav-current">
                  {reviewNavigation.currentIndex + 1}
                </span>
                <span className="review-modal-bulk-nav-sep">/</span>
                <span className="review-modal-bulk-nav-total">{reviewNavigation.total}</span>
              </span>
              <button
                type="button"
                className="review-modal-bulk-nav-btn"
                onClick={reviewNavigation.onNext}
                disabled={reviewNavigation.currentIndex >= reviewNavigation.total - 1}
                aria-label="다음 사례"
              >
                <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ) : null}
          <div className="review-modal-title-row">
            <div className="review-modal-title-main">
              <h2 className="review-modal-title">{displayMemberName}</h2>
              {displayDeptHierarchy ? (
                <span className="review-modal-dept" title={displayDeptHierarchy}>
                  {displayDeptHierarchy}
                </span>
              ) : null}
            </div>
          </div>
          <CaseDetailMetaRow
            className="review-modal-header-meta"
            status={liveCase.status}
            submittedAt={liveCase.submittedAt}
            callDate={liveCase.callDate}
            swingId={liveCase.swingId}
            caseItem={liveCase}
            statusMode="review"
            callTitle={callDateTime ? `STT 조회: ${callDateTime.searchKey}` : undefined}
          />
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="review-modal-body review-modal-body--single">
          <div className="mce-root review-case-body">
            <section className="mce-section mce-section--compact" aria-labelledby="review-content-title">
              <h4 id="review-content-title" className="mce-section-label">
                접수 내용
              </h4>
              <div className="mce-panel">
                <div className="mce-panel-block">
                  <p className="mce-panel-text">
                    {liveCase.description?.trim() || '내용이 없습니다.'}
                  </p>
                </div>
              </div>
            </section>

            <CaseScorePanel
              scores={scoreForm}
              totalScore={totalScore}
              certTone={scoreCertTone}
              status={liveCase.status}
              minTotal={minTotal}
              readonly={false}
              onScoreChange={handleScoreChange}
              sectionTitle="평가 결과"
              scoreLayout="inline"
              scoreColumns={3}
              compact
            />

            {successMessage ? (
              <div className="judge-success judge-success--compact" role="status">
                <Check size={13} aria-hidden />
                {successMessage}
              </div>
            ) : null}

            {error && (
              <div className="judge-error judge-error--compact" role="alert">
                <AlertTriangle size={13} aria-hidden />
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          className="review-modal-footer review-modal-footer--judge review-modal-footer--bar"
          role="group"
          aria-label="인증·미인증 선택 및 저장"
        >
          <div className="review-footer-decisions">
            <button
              type="button"
              className={`judge-option judge-option--sel review-footer-choice ${manualDecision === 'selected' ? 'is-active' : ''}`}
              onClick={() => {
                setError('');
                setSuccessMessage('');
                decisionTouchedRef.current = true;
                setManualDecision('selected');
              }}
              aria-pressed={manualDecision === 'selected'}
            >
              <span className="judge-option__mark" aria-hidden>
                {manualDecision === 'selected' ? (
                  <Check className="judge-option__check" size={14} strokeWidth={3} />
                ) : (
                  <span className="judge-option__mark-empty" />
                )}
              </span>
              인증
            </button>
            <button
              type="button"
              className={`judge-option judge-option--rej review-footer-choice ${manualDecision === 'rejected' ? 'is-active' : ''}`}
              onClick={() => {
                setError('');
                setSuccessMessage('');
                decisionTouchedRef.current = true;
                setManualDecision('rejected');
              }}
              aria-pressed={manualDecision === 'rejected'}
            >
              <span className="judge-option__mark" aria-hidden>
                {manualDecision === 'rejected' ? (
                  <Check className="judge-option__check" size={14} strokeWidth={3} />
                ) : (
                  <span className="judge-option__mark-empty" />
                )}
              </span>
              미인증
            </button>
          </div>
          <div className="review-footer-actions">
            {isFinalized ? (
              !isMonitoringUser ? (
                <button
                  type="button"
                  className="btn btn-secondary review-footer-save-btn review-footer-save-btn--cancel"
                  onClick={handleCancelFinal}
                  disabled={isActionPending}
                  title="2차 인증 취소 — 1차 인증 상태로 되돌림"
                >
                  {saveMode === 'cancel' && cancelFinalMutation.isPending ? (
                    <Loader2 size={16} className="review-spin" aria-hidden />
                  ) : (
                    <Undo2 size={16} aria-hidden />
                  )}
                  2차 인증 취소
                </button>
              ) : null
            ) : isPhase1 ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary review-footer-save-btn review-footer-save-btn--cancel"
                  onClick={handleCancelDraft}
                  disabled={isActionPending}
                  title="1차 인증 취소 — 대기중 상태로 되돌림"
                >
                  {saveMode === 'cancelDraft' && cancelDraftMutation.isPending ? (
                    <Loader2 size={16} className="review-spin" aria-hidden />
                  ) : (
                    <Undo2 size={16} aria-hidden />
                  )}
                  1차 인증 취소
                </button>
                {!isMonitoringUser ? (
                  <button
                    type="button"
                    className="btn btn-primary review-footer-save-btn"
                    onClick={() => submitEvaluation(false)}
                    disabled={isActionPending}
                    title="2차 인증 — 구성원에게 결과 공개"
                  >
                    {saveMode === 'final' && mutation.isPending ? '저장 중…' : '2차 인증'}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary review-footer-save-btn"
                  onClick={() => submitEvaluation(true)}
                  disabled={isActionPending}
                  title="1차 인증 — pending 유지, 구성원 비공개"
                >
                  {saveMode === 'draft' && mutation.isPending ? (
                    <Loader2 size={16} className="review-spin" aria-hidden />
                  ) : (
                    <Save size={16} aria-hidden />
                  )}
                  1차 인증
                </button>
                {!isMonitoringUser ? (
                  <button
                    type="button"
                    className="btn btn-primary review-footer-save-btn"
                    onClick={() => submitEvaluation(false)}
                    disabled={isActionPending}
                    title="2차 인증 — 구성원에게 결과 공개"
                  >
                    {saveMode === 'final' && mutation.isPending ? '저장 중…' : '2차 인증'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
