import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatusBadge from '../common/StatusBadge';
import CaseReviewStageBadge from '../common/CaseReviewStageBadge';
import { formatCaseDateTimeYyMmKorean, formatCaseListSwingId } from '../../utils/caseDisplay';

const SWING_COPY_FEEDBACK_MS = 2000;

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy failed');
}

/**
 * 사례 상세 상단 — 상태 · 스윙ID · 상담시간 · 접수시간
 */
export default function CaseDetailMetaRow({
  status,
  submittedAt,
  callDate,
  swingId = null,
  caseItem = null,
  statusMode = 'member',
  className = '',
  callTitle,
}) {
  const [swingCopied, setSwingCopied] = useState(false);
  const swingCopyTimerRef = useRef(null);
  const swingIdText = swingId?.trim() ?? '';
  const swingDisplay = formatCaseListSwingId(swingId);
  const swingHasValue = swingIdText.length > 0;

  useEffect(() => {
    setSwingCopied(false);
    if (swingCopyTimerRef.current) {
      clearTimeout(swingCopyTimerRef.current);
      swingCopyTimerRef.current = null;
    }
  }, [swingIdText]);

  useEffect(
    () => () => {
      if (swingCopyTimerRef.current) clearTimeout(swingCopyTimerRef.current);
    },
    []
  );

  const handleSwingIdCopy = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!swingHasValue) return;
      try {
        await copyTextToClipboard(swingIdText);
        setSwingCopied(true);
        if (swingCopyTimerRef.current) clearTimeout(swingCopyTimerRef.current);
        swingCopyTimerRef.current = setTimeout(() => {
          setSwingCopied(false);
          swingCopyTimerRef.current = null;
        }, SWING_COPY_FEEDBACK_MS);
      } catch {
        window.alert('스윙ID 복사에 실패했습니다.');
      }
    },
    [swingHasValue, swingIdText]
  );

  return (
    <div
      className={`member-case-detail-meta-row${className ? ` ${className}` : ''}`}
      aria-label="상태·스윙ID·상담시간·접수시간"
    >
      <div className="member-case-detail-meta-chip member-case-detail-meta-chip--status">
        <span className="member-case-detail-meta-kicker">상태</span>
        <span className="member-case-detail-meta-val member-case-detail-meta-val--status">
          {statusMode === 'review' && caseItem ? (
            <CaseReviewStageBadge caseItem={caseItem} size="sm" />
          ) : (
            <StatusBadge status={status} size="sm" />
          )}
        </span>
      </div>
      <span className="member-case-detail-meta-divider" aria-hidden />
      <div className="member-case-detail-meta-chip member-case-detail-meta-chip--swing">
        <span className="member-case-detail-meta-kicker">스윙ID</span>
        <span className="member-case-detail-meta-val-wrap member-case-detail-meta-val-wrap--swing">
          <button
            type="button"
            className={`member-case-detail-meta-val member-case-detail-meta-val--swing member-case-detail-meta-val--copyable${
              swingHasValue ? '' : ' is-empty'
            }${swingCopied ? ' is-copied' : ''}`}
            onClick={handleSwingIdCopy}
            disabled={!swingHasValue}
            title={
              swingCopied
                ? '복사되었습니다.'
                : swingHasValue
                  ? `클릭하여 복사: ${swingIdText}`
                  : '평가대상자 업로드 후 b_id가 반영됩니다'
            }
            aria-label={
              swingHasValue ? `스윙ID ${swingDisplay}, 클릭하여 복사` : '스윙ID 없음'
            }
          >
            {swingDisplay}
          </button>
          {swingCopied ? (
            <span className="member-case-detail-meta-copy-tip" role="status" aria-live="polite">
              복사되었습니다.
            </span>
          ) : null}
        </span>
      </div>
      <span className="member-case-detail-meta-divider" aria-hidden />
      <div
        className="member-case-detail-meta-chip member-case-detail-meta-chip--call"
        title={callTitle}
      >
        <span className="member-case-detail-meta-kicker">상담시간</span>
        <span
          className={`member-case-detail-meta-val member-case-detail-meta-val--call${
            formatCaseDateTimeYyMmKorean(callDate) === '—' ? ' is-empty' : ''
          }`}
        >
          {formatCaseDateTimeYyMmKorean(callDate)}
        </span>
      </div>
      <span className="member-case-detail-meta-divider" aria-hidden />
      <div className="member-case-detail-meta-chip member-case-detail-meta-chip--submitted">
        <span className="member-case-detail-meta-kicker">접수시간</span>
        <span className="member-case-detail-meta-val member-case-detail-meta-val--submitted">
          {formatCaseDateTimeYyMmKorean(submittedAt)}
        </span>
      </div>
    </div>
  );
}
