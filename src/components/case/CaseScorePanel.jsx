import React, { useMemo } from 'react';
import {
  CASE_SCORE_ITEMS,
  DEFAULT_CERTIFICATION_MIN_TOTAL,
  parseScoreValue,
} from '../../utils/caseEvaluation';
import './CaseScorePanel.css';

const SCORE_MAIN_ITEMS = CASE_SCORE_ITEMS.filter(({ key }) => key !== 'bonus');
const SCORE_BONUS_ITEM = CASE_SCORE_ITEMS.find(({ key }) => key === 'bonus');

function resolveTotalTone({ status, certTone, totalScore, minTotal }) {
  if (certTone === 'cert' || certTone === 'uncert') return certTone;
  if (status === 'selected') return 'cert';
  if (status === 'rejected') return 'uncert';
  if (totalScore != null && Number.isFinite(totalScore)) {
    return totalScore >= minTotal ? 'cert' : 'uncert';
  }
  return 'neutral';
}

function ScoreCell({ label, scoreKey, raw, readonly, onScoreChange, isBonus }) {
  const n = parseScoreValue(raw);
  const inputId = `case-score-${scoreKey}`;
  const filled = !readonly && parseScoreValue(raw) != null;

  return (
    <li
      className={`mce-score-cell${isBonus ? ' mce-score-cell--bonus' : ''}${readonly ? '' : ' mce-score-cell--editable'}`}
      role="listitem"
    >
      <label className="mce-score-cell-label" htmlFor={readonly ? undefined : inputId}>
        <span className="mce-score-cell-label-text">{label}</span>
        {!readonly && <span className="mce-score-cell-label-tag">점수</span>}
      </label>
      {readonly ? (
        <span className={`mce-score-cell-val${n == null ? ' mce-score-cell-val--empty' : ''}`}>
          {n != null ? (
            <>
              <span className="mce-score-cell-num">{n}</span>
              <span className="mce-score-cell-unit">점</span>
            </>
          ) : (
            '—'
          )}
        </span>
      ) : (
        <div className={`mce-score-cell-input-wrap${filled ? ' mce-score-cell-input-wrap--filled' : ''}`}>
          <input
            id={inputId}
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            className="mce-score-cell-input"
            value={raw ?? ''}
            onChange={(e) => onScoreChange?.(scoreKey, e.target.value)}
            placeholder="0–100"
            aria-label={`${label} 점수 0~100`}
          />
          <span className="mce-score-cell-input-suffix" aria-hidden>
            점
          </span>
        </div>
      )}
    </li>
  );
}

function SummaryRemarks({ readonly, remarksText, value, onChange }) {
  return (
    <div className="mce-summary-remarks">
      <span className="mce-summary-remarks-label">비고</span>
      {readonly ? (
        <p
          className={`mce-summary-remarks-body${remarksText ? '' : ' mce-summary-remarks-body--empty'}`}
        >
          {remarksText || '등록된 비고가 없습니다.'}
        </p>
      ) : (
        <textarea
          className="mce-summary-remarks-input"
          value={value ?? ''}
          onChange={(e) => onChange?.('remarks', e.target.value)}
          placeholder="평가 메모 (선택)"
          aria-label="비고"
        />
      )}
    </div>
  );
}

/**
 * 사례 평가표 — 구성원 조회·관리자 입력 공통 레이아웃
 */
export default function CaseScorePanel({
  scores,
  totalScore,
  status,
  certTone,
  minTotal = DEFAULT_CERTIFICATION_MIN_TOTAL,
  readonly = true,
  onScoreChange,
  sectionTitle = '평가 결과',
  className = '',
}) {
  const totalDisplay = useMemo(() => {
    if (totalScore == null || !Number.isFinite(Number(totalScore))) {
      return readonly ? null : 0;
    }
    return Number(totalScore);
  }, [totalScore, readonly]);

  const showTotalBlock = totalDisplay != null;
  const showSummaryRow = showTotalBlock || !readonly;

  const totalBarPct =
    showTotalBlock
      ? Math.min(100, Math.round((totalDisplay / minTotal) * 100))
      : 0;

  const totalTone = useMemo(
    () => resolveTotalTone({ status, certTone, totalScore: totalDisplay, minTotal }),
    [status, certTone, totalDisplay, minTotal],
  );

  const remarksText = scores?.remarks?.trim() || '';

  return (
    <section className={`mce-section ${className}`.trim()} aria-labelledby="case-score-panel-title">
      <h4 id="case-score-panel-title" className="mce-section-label">
        {sectionTitle}
      </h4>
      <div className="mce-panel mce-panel--eval">
        {showSummaryRow && (
          <>
            <div className="mce-panel-block mce-panel-block--summary">
              <div
                className={`mce-summary-row${showTotalBlock ? '' : ' mce-summary-row--remarks-only'}`}
              >
                {showTotalBlock && (
                  <div
                    className={`mce-summary-total mce-summary-total--${totalTone}`}
                    aria-label={`종합점수 ${totalDisplay}점${totalTone === 'cert' ? ', 인증' : totalTone === 'uncert' ? ', 미인증' : ''}`}
                  >
                    <span className="mce-summary-total-label">종합점수</span>
                    <span className="mce-summary-total-val">
                      {totalDisplay}
                      <span className="mce-summary-total-unit">점</span>
                    </span>
                    <div className="mce-summary-total-bar" aria-hidden>
                      <span
                        className="mce-summary-total-bar-fill"
                        style={{ width: `${totalBarPct}%` }}
                      />
                    </div>
                    <span className="mce-summary-total-hint">{minTotal}점 이상</span>
                  </div>
                )}
                <SummaryRemarks
                  readonly={readonly}
                  remarksText={remarksText}
                  value={scores?.remarks}
                  onChange={onScoreChange}
                />
              </div>
            </div>
            <div className="mce-hairline" role="separator" />
          </>
        )}

        <div
          className={`mce-panel-block mce-panel-block--scores${readonly ? '' : ' mce-panel-block--scores-edit'}`}
        >
          <div className="mce-scores-head">
            <p className="mce-group-caption">평가 항목</p>
            {!readonly && (
              <p className="mce-scores-hint">각 항목에 0~100점을 입력하세요</p>
            )}
          </div>
          <div className="mce-score-group">
            <ul className="mce-score-list" role="list">
              {SCORE_MAIN_ITEMS.map(({ key, label }) => (
                <ScoreCell
                  key={key}
                  scoreKey={key}
                  label={label}
                  raw={scores[key]}
                  readonly={readonly}
                  onScoreChange={onScoreChange}
                />
              ))}
            </ul>
          </div>

          {SCORE_BONUS_ITEM && (
            <>
              <div className="mce-scores-head mce-scores-head--spaced">
                <p className="mce-group-caption mce-group-caption--inline">가점</p>
                {!readonly && <p className="mce-scores-hint">0~100점</p>}
              </div>
              <div className="mce-score-group mce-score-group--bonus">
                <ul className="mce-score-list" role="list">
                  <ScoreCell
                    scoreKey={SCORE_BONUS_ITEM.key}
                    label={SCORE_BONUS_ITEM.label}
                    raw={scores[SCORE_BONUS_ITEM.key]}
                    readonly={readonly}
                    onScoreChange={onScoreChange}
                    isBonus
                  />
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
