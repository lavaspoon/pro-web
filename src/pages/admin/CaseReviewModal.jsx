import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import CaseReviewStageBadge from '../../components/common/CaseReviewStageBadge';
import CaseScorePanel from '../../components/case/CaseScorePanel';
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

function formatSubmittedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CaseReviewModal({
  caseData,
  memberName,
  deptHierarchy = '',
  onClose,
  overlayClassName = '',
  onRefreshCase,
  /** 다중 검토: { currentIndex, total, onPrev, onNext } */
  reviewNavigation = null,
  /** 최종 저장 후 true 반환 시 모달 유지(다음 건으로 이동) */
  onAfterFinalSave,
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [scoreForm, setScoreForm] = useState(emptyScoreForm);
  const [error, setError] = useState('');
  const [saveMode, setSaveMode] = useState(null);
  /** 최종 저장 시 인증·미인증 — 점수 기준 자동 제안, 수동 변경 가능 */
  const [manualDecision, setManualDecision] = useState('rejected');
  const decisionTouchedRef = useRef(false);

  const caseStatus = String(caseData.status ?? '').toLowerCase();
  const isFinalized = caseStatus === 'selected' || caseStatus === 'rejected';
  const minTotal =
    caseData.certificationMinTotalScore != null
      ? caseData.certificationMinTotalScore
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

  const displayMemberName = memberName ?? caseData.memberName ?? '구성원';
  const displayDeptHierarchy =
    (deptHierarchy && String(deptHierarchy).trim()) ||
    (caseData.teamName && String(caseData.teamName).trim()) ||
    '';
  const callDateTime = useMemo(
    () => parseCaseCallDateTime(caseData.callDate),
    [caseData.callDate],
  );

  useEffect(() => {
    setScoreForm(scoresFromCaseData(caseData));
    setError('');
    setSaveMode(null);
    decisionTouchedRef.current = false;
    const initial = scoresFromCaseData(caseData);
    const st = String(caseData.status ?? '').toLowerCase();
    if (st === 'selected' || st === 'rejected') {
      setManualDecision(st);
    } else {
      setManualDecision(decisionFromTotal(sumScores(initial), minTotal));
    }
  }, [caseData.id, minTotal]);

  /** 점수 변경 시 자동 제안 — 사용자가 인증·미인증을 직접 고른 뒤에는 유지 (2차 완료 건은 기존 판정 유지) */
  useEffect(() => {
    if (decisionTouchedRef.current || isFinalized) return;
    setManualDecision(previewDecision);
  }, [previewDecision, isFinalized]);

  const mutation = useMutation({
    mutationFn: (payload) => judgeCase({ caseId: caseData.id, ...payload }),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-member-cases'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail', String(caseData.id)] });
      if (variables.draft) {
        setError('');
        setSaveMode(null);
        if (typeof onRefreshCase === 'function') {
          onRefreshCase();
        }
      } else if (typeof onAfterFinalSave === 'function') {
        const stayOpen = await onAfterFinalSave();
        if (!stayOpen) onClose();
      } else {
        onClose();
      }
    },
    onError: (err) => {
      setError(err.message);
      setSaveMode(null);
    },
  });

  const handleScoreChange = (key, value) => {
    setError('');
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
        setError(`최종 저장 시 모든 항목 점수가 필요합니다: ${missing.join(', ')}`);
        return;
      }
    }
    setSaveMode(draft ? 'draft' : 'final');
    setError('');
    mutation.mutate(
      buildJudgePayload({
        form: scoreForm,
        adminSkid: user.skid,
        draft,
        decision: draft ? undefined : manualDecision,
      }),
    );
  };

  const draftBadge = caseData.judgmentDraft ? (
    <span className="review-draft-badge">임시저장됨</span>
  ) : null;

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
            {draftBadge}
          </div>
          <div
            className="member-case-detail-meta-row review-modal-header-meta"
            aria-label="상태·상담시간·접수"
          >
            <CaseReviewStageBadge caseItem={caseData} size="sm" />
            <span className="member-case-detail-meta-sep" aria-hidden>
              ·
            </span>
            <span
              className="member-case-detail-meta-chip member-case-detail-meta-chip--call"
              title={callDateTime ? `STT 조회: ${callDateTime.searchKey}` : undefined}
            >
              <span className="member-case-detail-meta-kicker">상담시간</span>
              {callDateTime ? (
                <span className="review-calltime-val">
                  <time
                    className="review-calltime-date"
                    dateTime={callDateTime.iso || undefined}
                  >
                    {callDateTime.dateLabel}
                  </time>
                  <span className="review-calltime-sep" aria-hidden>
                    ·
                  </span>
                  <time
                    className="review-calltime-time"
                    dateTime={callDateTime.iso || undefined}
                  >
                    {callDateTime.timeLabel}
                  </time>
                </span>
              ) : (
                <span className="member-case-detail-meta-val">—</span>
              )}
            </span>
            <span className="member-case-detail-meta-sep" aria-hidden>
              ·
            </span>
            <span className="member-case-detail-meta-chip">
              <span className="member-case-detail-meta-kicker">접수</span>
              <span className="member-case-detail-meta-val">
                {formatSubmittedAt(caseData.submittedAt)}
              </span>
            </span>
          </div>
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
                    {caseData.description?.trim() || '내용이 없습니다.'}
                  </p>
                </div>
              </div>
            </section>

            <CaseScorePanel
              scores={scoreForm}
              totalScore={totalScore}
              certTone={scoreCertTone}
              status={caseData.status}
              minTotal={minTotal}
              readonly={false}
              onScoreChange={handleScoreChange}
              sectionTitle="평가 결과"
              scoreLayout="inline"
              compact
            />

            {error && (
              <div className="judge-error judge-error--compact" role="alert">
                <AlertTriangle size={13} aria-hidden />
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          className="review-modal-footer review-modal-footer--judge review-modal-footer--grid4"
          role="group"
          aria-label="인증·미인증 수동 선택 및 저장"
        >
            <div className="review-footer-col review-footer-col--score">
              <span className="review-footer-col__title">종합 {totalScore}점</span>
            </div>
            <button
              type="button"
              className={`judge-option judge-option--sel review-footer-col ${manualDecision === 'selected' ? 'is-active' : ''}`}
              onClick={() => {
                setError('');
                decisionTouchedRef.current = true;
                setManualDecision('selected');
              }}
              aria-pressed={manualDecision === 'selected'}
            >
              인증
            </button>
            <button
              type="button"
              className={`judge-option judge-option--rej review-footer-col ${manualDecision === 'rejected' ? 'is-active' : ''}`}
              onClick={() => {
                setError('');
                decisionTouchedRef.current = true;
                setManualDecision('rejected');
              }}
              aria-pressed={manualDecision === 'rejected'}
            >
              미인증
            </button>
            <div className="review-footer-col review-footer-col--actions">
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => submitEvaluation(true)}
                disabled={mutation.isPending}
                title="1차 검증 — pending 유지, 구성원 비공개"
              >
                {saveMode === 'draft' && mutation.isPending ? (
                  <Loader2 size={16} className="review-spin" aria-hidden />
                ) : (
                  <Save size={16} aria-hidden />
                )}
                1차 임시저장
              </button>
              <button
                type="button"
                className="btn btn-primary btn-compact"
                onClick={() => submitEvaluation(false)}
                disabled={mutation.isPending}
                title={isFinalized ? '2차 완료 건 수정 저장' : '2차 최종 — 구성원에게 결과 공개'}
              >
                {saveMode === 'final' && mutation.isPending
                  ? '저장 중…'
                  : isFinalized
                    ? '저장'
                    : '최종 저장'}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
