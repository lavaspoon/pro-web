import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import CaseScorePanel from '../case/CaseScorePanel';
import {
  CASE_SCORE_ITEMS,
  scoresFromCaseData,
} from '../../utils/caseEvaluation';
import './MemberCaseEvaluationView.css';

function hasPublishedEvaluation(caseData) {
  if (!caseData || caseData.status === 'pending') return false;
  if (caseData.totalScore != null) return true;
  return CASE_SCORE_ITEMS.some(({ key }) => caseData[key] != null);
}

export default function MemberCaseEvaluationView({ caseData }) {
  const scores = useMemo(() => scoresFromCaseData(caseData), [caseData]);
  const showEval = hasPublishedEvaluation(caseData);

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

      {showEval && (
        <CaseScorePanel
          scores={scores}
          totalScore={totalDisplay}
          status={caseData.status}
          readonly
        />
      )}
    </div>
  );
}
