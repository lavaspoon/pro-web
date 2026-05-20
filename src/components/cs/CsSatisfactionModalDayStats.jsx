import React from 'react';
import {
  computePersonalDaySatisfaction,
  fmtCount,
  fmtPct,
  isDualSatisfactionTargetMet,
} from '../../utils/csSatisfactionModalDayStats';

/**
 * 구성원 상세 모달 — 선택 일자 만족도 요약 (테이블 상단).
 */
export default function CsSatisfactionModalDayStats({
  rows = [],
  personalTargetPercent = null,
  deptSummary = null,
  deptTargetPercent = null,
}) {
  const personal = computePersonalDaySatisfaction(rows);
  const deptRate = deptSummary?.satisfactionRate ?? null;
  const deptTarget = deptTargetPercent ?? deptSummary?.targetPercent ?? null;

  const dualOk = isDualSatisfactionTargetMet({
    personalRate: personal.satisfactionRate,
    personalTarget: personalTargetPercent,
    deptRate,
    deptTarget,
  });
  const rateTone = dualOk ? 'is-ok' : 'is-no';

  return (
    <div className="adm-sat-modal-day-stats-panel" aria-label="선택 일자 만족도 요약">
      <div className="adm-sat-modal-day-stats-head">
        <span className="adm-sat-modal-day-stats-kicker">당일 만족도</span>
        <span className="adm-sat-modal-day-stats-note">평가시간 적용 건 기준</span>
      </div>
      <div className="adm-sat-modal-day-metrics">
        <div className="adm-sat-modal-day-metric adm-sat-modal-day-metric--eval">
          <span className="adm-sat-modal-day-metric-label">평가 건수</span>
          <strong className="adm-sat-modal-day-metric-val">{fmtCount(personal.evalCount)}</strong>
        </div>
        <div className="adm-sat-modal-day-metric adm-sat-modal-day-metric--sat">
          <span className="adm-sat-modal-day-metric-label">만족 건수</span>
          <strong className="adm-sat-modal-day-metric-val">{fmtCount(personal.satisfiedCount)}</strong>
        </div>
        <div className={`adm-sat-modal-day-metric adm-sat-modal-day-metric--rate ${rateTone}`}>
          <span className="adm-sat-modal-day-metric-label">만족도</span>
          <strong className="adm-sat-modal-day-metric-val adm-sat-modal-day-metric-val--pct">
            {fmtPct(personal.satisfactionRate)}
          </strong>
        </div>
      </div>
    </div>
  );
}
