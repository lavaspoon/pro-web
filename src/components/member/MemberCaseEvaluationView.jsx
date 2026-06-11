import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import CaseScorePanel from '../case/CaseScorePanel';
import {
  CASE_SCORE_ITEMS,
  scoresFromCaseData,
} from '../../utils/caseEvaluation';
import './MemberCaseEvaluationView.css';
import '../case/CaseScorePanel.css';

function hasPublishedEvaluation(caseData) {
  if (!caseData || caseData.status === 'pending') return false;
  if (caseData.status === 'returned') return false;
  if (caseData.totalScore != null) return true;
  return CASE_SCORE_ITEMS.some(({ key }) => caseData[key] != null);
}

function resolveReturnedRemarks(caseData) {
  const remarks = caseData?.remarks?.trim();
  if (remarks) return remarks;
  const reason = caseData?.judgmentReason?.trim();
  if (reason) return reason;
  return '';
}

export default function MemberCaseEvaluationView({ caseData }) {
  const scores = useMemo(() => scoresFromCaseData(caseData), [caseData]);
  const showEval = hasPublishedEvaluation(caseData);
  const isReturned = caseData.status === 'returned';
  const returnedRemarks = useMemo(
    () => (isReturned ? resolveReturnedRemarks(caseData) : ''),
    [caseData, isReturned],
  );

  const totalDisplay =
    caseData.totalScore != null && Number.isFinite(Number(caseData.totalScore))
      ? Number(caseData.totalScore)
      : null;

  return (
    <div className="mce-root">
      <section className="mce-section" aria-labelledby="mce-content-title">
        <h4 id="mce-content-title" className="mce-section-label">
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

      {caseData.status === 'pending' && (
        <div className="mce-pending" role="status">
          <Clock size={16} strokeWidth={2.2} aria-hidden />
          <span>청취·평가 대기 중입니다.</span>
        </div>
      )}

      {isReturned ? (
        <section className="mce-section" aria-labelledby="mce-returned-remarks-title">
          <h4 id="mce-returned-remarks-title" className="mce-section-label">
            비고
          </h4>
          <div className="mce-panel">
            <div className="mce-panel-block">
              <p
                className={`mce-panel-text mce-returned-remarks${returnedRemarks ? '' : ' mce-returned-remarks--empty'}`}
              >
                {returnedRemarks || '등록된 비고가 없습니다.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {showEval && (
        <CaseScorePanel
          scores={scores}
          totalScore={totalDisplay}
          status={caseData.status}
          readonly
          scoreColumns={3}
        />
      )}
    </div>
  );
}
