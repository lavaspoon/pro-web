import React, { useMemo } from 'react';
import {
  CASE_SCORE_ITEMS,
  CASE_MAX_TOTAL_SCORE,
  DEFAULT_CERTIFICATION_MIN_TOTAL,
  parseScoreValue,
} from '../../utils/caseEvaluation';
import './CaseScorePanel.css';

function scoreSelectOptionsForMax(maxScore) {
  const opts = [0, 5];
  if (maxScore >= 10) opts.push(10);
  return opts;
}

function scoreSelectValue(raw, maxScore) {
  const n = parseScoreValue(raw, maxScore);
  const allowed = scoreSelectOptionsForMax(maxScore);
  if (n != null && allowed.includes(n)) return String(n);
  return '';
}

function resolveTotalTone({ status, certTone, totalScore, minTotal }) {
  if (certTone === 'neutral') return 'neutral';
  if (certTone === 'cert' || certTone === 'uncert') return certTone;
  if (status === 'selected') return 'cert';
  if (status === 'rejected') return 'uncert';
  const st = String(status ?? '').toLowerCase();
  if (st === 'pending') return 'neutral';
  if (totalScore != null && Number.isFinite(totalScore)) {
    return totalScore >= minTotal ? 'cert' : 'uncert';
  }
  return 'neutral';
}

function ScoreCell({ label, scoreKey, maxScore, raw, readonly, onScoreChange, inlineLayout }) {
  const n = parseScoreValue(raw, maxScore);
  const inputId = `case-score-${scoreKey}`;
  const filled = !readonly && parseScoreValue(raw, maxScore) != null;

  const control = readonly ? (
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
    <div className={`mce-score-cell-select-wrap${filled ? ' mce-score-cell-select-wrap--filled' : ''}`}>
      <select
        id={inputId}
        className="mce-score-cell-select"
        value={scoreSelectValue(raw, maxScore)}
        onChange={(e) => onScoreChange?.(scoreKey, e.target.value)}
        aria-label={`${label} 점수 선택`}
      >
        <option value="">-</option>
        {scoreSelectOptionsForMax(maxScore).map((v) => (
          <option key={v} value={String(v)}>
            {v}점
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <li
      className={[
        'mce-score-cell',
        readonly ? '' : 'mce-score-cell--editable',
        inlineLayout ? 'mce-score-cell--inline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
    >
      <label className="mce-score-cell-label" htmlFor={readonly ? undefined : inputId} title={`${label}(${maxScore})`}>
        <span className="mce-score-cell-label-text">{label}</span>
        <span className="mce-score-cell-max" aria-hidden>
          ({maxScore})
        </span>
      </label>
      <div className="mce-score-cell-control">{control}</div>
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
          placeholder=""
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
  scoreColumns = 3,
  scoreLayout = 'stacked',
  compact = false,
}) {
  const inlineLayout = scoreLayout === 'inline';
  const gridColumns = scoreColumns;
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
      ? Math.min(100, Math.round((totalDisplay / CASE_MAX_TOTAL_SCORE) * 100))
      : 0;

  const totalTone = useMemo(
    () => resolveTotalTone({ status, certTone, totalScore: totalDisplay, minTotal }),
    [status, certTone, totalDisplay, minTotal],
  );

  const remarksText = scores?.remarks?.trim() || '';

  const sectionClass = [
    'mce-section',
    compact ? 'mce-section--compact' : '',
    inlineLayout ? 'mce-section--inline-scores' : '',
    gridColumns > 2 ? 'mce-section--cols-variable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const sectionStyle =
    gridColumns > 2 ? { '--mce-score-cols': gridColumns } : undefined;

  return (
    <section
      className={sectionClass}
      style={sectionStyle}
      aria-labelledby="case-score-panel-title"
    >
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
            {!readonly && !inlineLayout && (
              <p className="mce-scores-hint">항목별 점수 선택 (총 {CASE_MAX_TOTAL_SCORE}점)</p>
            )}
          </div>
          <div className="mce-score-group">
            <ul className="mce-score-list" role="list">
              {CASE_SCORE_ITEMS.map(({ key, label, maxScore }) => (
                <ScoreCell
                  key={key}
                  scoreKey={key}
                  label={label}
                  maxScore={maxScore}
                  raw={scores[key]}
                  readonly={readonly}
                  onScoreChange={onScoreChange}
                  inlineLayout={inlineLayout}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
