import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2, Save } from 'lucide-react';
import { judgeCase } from '../../api/adminApi';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import CaseScorePanel from '../../components/case/CaseScorePanel';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
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

function formatJudgedAt(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return formatSubmittedAt(dateStr);
}

export default function CaseReviewModal({
  caseData,
  memberName,
  onClose,
  overlayClassName = '',
  onRefreshCase,
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [scoreForm, setScoreForm] = useState(emptyScoreForm);
  const [error, setError] = useState('');
  const [saveMode, setSaveMode] = useState(null);

  const isPending = caseData.status === 'pending';
  const minTotal =
    caseData.certificationMinTotalScore != null
      ? caseData.certificationMinTotalScore
      : DEFAULT_CERTIFICATION_MIN_TOTAL;

  const totalScore = useMemo(() => sumScores(scoreForm), [scoreForm]);
  const previewDecision = useMemo(
    () => decisionFromTotal(totalScore, minTotal),
    [totalScore, minTotal],
  );
  const previewCertTone = previewDecision === 'selected' ? 'cert' : 'uncert';

  const readonlyScores = useMemo(() => scoresFromCaseData(caseData), [caseData]);
  const readonlyTotal =
    caseData.totalScore != null && Number.isFinite(Number(caseData.totalScore))
      ? Number(caseData.totalScore)
      : null;

  const judgedAtLabel = formatJudgedAt(caseData.judgedAt);

  useEffect(() => {
    setScoreForm(scoresFromCaseData(caseData));
    setError('');
    setSaveMode(null);
  }, [caseData.id]);

  const mutation = useMutation({
    mutationFn: (payload) => judgeCase({ caseId: caseData.id, ...payload }),
    onSuccess: (_data, variables) => {
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
      const missing = CASE_SCORE_ITEMS.filter(({ key }) => parseScoreValue(scoreForm[key]) == null).map(
        (i) => i.label,
      );
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
      }),
    );
  };

  const modalHeading = `${memberName ?? caseData.memberName} · ${formatCaseCallDateTime(caseData.callDate)}`;
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
          <div className="review-modal-title-row">
            <h2 className="review-modal-title">{modalHeading}</h2>
            <StatusBadge status={caseData.status} />
            {draftBadge}
          </div>
          <p className="review-modal-sub">
            접수 {formatSubmittedAt(caseData.submittedAt)}
            {caseData.judgmentDraft ? ' · 관리자만 보는 임시 평가' : ''}
          </p>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="review-modal-body review-modal-body--single">
          <div className="mce-root review-case-body">
            <div className="member-case-detail-meta-row" aria-label="접수·통화·판정">
              <StatusBadge status={caseData.status} size="sm" />
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">접수</span>
                <span className="member-case-detail-meta-val">
                  {formatSubmittedAt(caseData.submittedAt)}
                </span>
              </span>
              <span className="member-case-detail-meta-sep" aria-hidden>
                ·
              </span>
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">통화</span>
                <span className="member-case-detail-meta-val">
                  {formatCaseCallDateTime(caseData.callDate)}
                </span>
              </span>
              <span className="member-case-detail-meta-sep" aria-hidden>
                ·
              </span>
              <span className="member-case-detail-meta-chip">
                <span className="member-case-detail-meta-kicker">판정</span>
                <span className="member-case-detail-meta-val">
                  {judgedAtLabel ?? (isPending ? '대기' : '—')}
                </span>
              </span>
            </div>

            <section className="mce-section" aria-labelledby="review-content-title">
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

            {isPending ? (
              <CaseScorePanel
                scores={scoreForm}
                totalScore={totalScore}
                certTone={previewCertTone}
                minTotal={minTotal}
                readonly={false}
                onScoreChange={handleScoreChange}
                sectionTitle="평가 결과"
              />
            ) : (
              <CaseScorePanel
                scores={readonlyScores}
                totalScore={readonlyTotal}
                status={caseData.status}
                minTotal={minTotal}
                readonly
                sectionTitle="평가 결과"
              />
            )}

            {error && (
              <div className="judge-error judge-error--compact" role="alert">
                <AlertTriangle size={13} aria-hidden />
                {error}
              </div>
            )}
          </div>
        </div>

        {isPending && (
          <div className="review-modal-footer">
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => submitEvaluation(true)}
              disabled={mutation.isPending}
            >
              {saveMode === 'draft' && mutation.isPending ? (
                <Loader2 size={16} className="review-spin" aria-hidden />
              ) : (
                <Save size={16} aria-hidden />
              )}
              임시저장
            </button>
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => submitEvaluation(false)}
              disabled={mutation.isPending}
            >
              {saveMode === 'final' && mutation.isPending ? '저장 중…' : '저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
