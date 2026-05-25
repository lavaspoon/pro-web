import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  Filter,
} from 'lucide-react';
import { fetchMyCases, fetchCaseDetail } from '../../api/memberApi';
import StatusBadge from '../../components/common/StatusBadge';
import AiInsight from '../../components/member/AiInsight';
import CaseDetailMetaRow from '../../components/case/CaseDetailMetaRow';
import MemberCaseEvaluationView from '../../components/member/MemberCaseEvaluationView';
import { formatCaseDateTimeMmDdKorean, formatCaseDateTimeYyMmKorean } from '../../utils/caseDisplay';
import { caseDescriptionExcerpt } from '../../utils/caseEvaluation';
import '../../pages/member/CaseListPage.css';
import '../../components/member/MemberCaseListModal.css';
import '../../components/member/MemberCaseDetailModal.css';

const STATUS_FILTER = ['전체', '대기중', '인증', '미인증'];
const STATUS_MAP = {
  대기중: 'pending',
  인증: 'selected',
  미인증: 'rejected',
  선정: 'selected',
  비선정: 'rejected',
};


function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function caseMonthKey(c) {
  const raw = c.month || c.submittedAt || '';
  if (typeof raw === 'string' && raw.length >= 7) return raw.slice(0, 7);
  return '';
}

function formatMonthBarLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${y}년 ${m}월`;
}

function formatCaseListScoreDisplay(caseItem) {
  const raw = caseItem?.totalScore;
  if (raw != null && Number.isFinite(Number(raw))) {
    return `${Number(raw)}점`;
  }
  return '-';
}

function CaseDetailView({ caseId, onBack, onClose }) {
  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: ['admin-case-detail', caseId],
    queryFn: () => fetchCaseDetail(caseId),
    enabled: !!caseId,
  });

  const showDuration = Boolean(caseData?.callDuration && String(caseData.callDuration).trim());

  return (
    <>
      <div className="member-case-detail-head">
        <button
          type="button"
          className="member-case-detail-back"
          onClick={onBack}
          aria-label="목록으로 돌아가기"
        >
          <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
          <span>목록</span>
        </button>
        <h2 className="member-case-detail-heading">사례 상세</h2>
        <button type="button" className="member-modal-close" onClick={onClose} aria-label="닫기">
          <X size={20} strokeWidth={2.25} />
        </button>
      </div>

      <div className="member-case-detail-body">
        {isLoading && (
          <div className="member-case-detail-loading">
            <div className="spinner" />
            <p>불러오는 중...</p>
          </div>
        )}
        {isError && (
          <p className="member-case-detail-error">{error?.message || '사례를 불러올 수 없습니다.'}</p>
        )}
        {!isLoading && !isError && caseData && (
          <>
            <CaseDetailMetaRow
              status={caseData.status}
              submittedAt={caseData.submittedAt}
              callDate={caseData.callDate}
            />
            {showDuration ? (
              <p className="member-case-detail-duration">녹취 길이 {caseData.callDuration}</p>
            ) : null}
            <MemberCaseEvaluationView caseData={caseData} />
            {caseData.status !== 'pending' && (
              <div className="admin-member-case-ai-wrap">
                <AiInsight
                  judgmentReason={caseData.judgmentReason}
                  caseStatus={caseData.status}
                  judgedAtLabel={caseData.judgedAt ? formatCaseDateTimeYyMmKorean(caseData.judgedAt) : null}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function AdminMemberCasesModal({ open, member, onClose }) {
  const [activeFilter, setActiveFilter] = useState('전체');
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [detailCaseId, setDetailCaseId] = useState(null);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['admin-member-cases', member?.id],
    queryFn: () => fetchMyCases(member.id),
    enabled: !!member?.id && open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (detailCaseId) setDetailCaseId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, detailCaseId]);

  useEffect(() => {
    if (open) {
      setMonthKey(currentMonthKey());
      setActiveFilter('전체');
      setDetailCaseId(null);
    }
  }, [open]);

  const { minMonthKey, maxMonthKey } = useMemo(() => {
    const max = currentMonthKey();
    const keys = cases.map(caseMonthKey).filter(Boolean);
    const earliest = keys.length ? [...keys].sort()[0] : max;
    const minWindow = addMonths(max, -36);
    const min = earliest < minWindow ? earliest : minWindow;
    return { minMonthKey: min, maxMonthKey: max };
  }, [cases]);

  const canPrevMonth = monthKey > minMonthKey;
  const canNextMonth = monthKey < maxMonthKey;

  const casesInMonth = useMemo(
    () => cases.filter((c) => caseMonthKey(c) === monthKey),
    [cases, monthKey],
  );

  const filtered =
    activeFilter === '전체'
      ? casesInMonth
      : casesInMonth.filter((c) => c.status === STATUS_MAP[activeFilter]);

  if (!open || !member) return null;

  return (
    <div
      className="member-modal-root member-case-list-root admin-member-cases-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-member-case-list-title"
    >
      <button
        type="button"
        className="member-modal-backdrop member-modal-backdrop--list"
        aria-label={detailCaseId ? '뒤로' : '모달 닫기'}
        onClick={() => (detailCaseId ? setDetailCaseId(null) : onClose())}
      />
      <div
        className={
          detailCaseId
            ? 'member-modal-panel member-case-detail-panel member-case-detail-panel--embedded'
            : 'member-modal-panel member-case-list-modal'
        }
      >
        {detailCaseId ? (
          <CaseDetailView
            caseId={detailCaseId}
            onBack={() => setDetailCaseId(null)}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="member-case-list-head">
              <div className="member-case-list-head-main">
                <h2 id="admin-member-case-list-title" className="member-case-list-title">
                  {member.name}님 접수 현황
                </h2>
                <p className="member-case-list-lede">
                  {member.teamName && `${member.teamName}`}
                </p>
              </div>
              <button
                type="button"
                className="member-case-list-close"
                onClick={onClose}
                aria-label="닫기"
              >
                <span className="member-case-list-close__ring" aria-hidden />
                <X className="member-case-list-close__icon" size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="member-case-month-bar">
              <button
                type="button"
                className="member-case-month-btn"
                disabled={!canPrevMonth}
                onClick={() => setMonthKey((k) => addMonths(k, -1))}
                aria-label="이전 달"
              >
                <ChevronLeft size={20} strokeWidth={2.25} />
              </button>
              <span className="member-case-month-label">{formatMonthBarLabel(monthKey)}</span>
              <button
                type="button"
                className="member-case-month-btn"
                disabled={!canNextMonth}
                onClick={() => setMonthKey((k) => addMonths(k, 1))}
                aria-label="다음 달"
              >
                <ChevronRight size={20} strokeWidth={2.25} />
              </button>
            </div>
            
            {isLoading ? (
              <div className="member-case-list-body member-case-list-body--loading">
                <div className="member-case-list-loading">
                  <div className="spinner" />
                  <p>사례를 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="filter-tabs member-case-filter-tabs">
                  <Filter size={14} className="filter-icon" />
                  {STATUS_FILTER.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`filter-tab ${activeFilter === f ? 'active' : ''}`}
                      onClick={() => setActiveFilter(f)}
                    >
                      {f}
                      <span className="filter-count">
                        {f === '전체'
                          ? casesInMonth.length
                          : casesInMonth.filter((c) => c.status === STATUS_MAP[f]).length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="member-case-list-body">
                  {filtered.length === 0 ? (
                    <div className="empty-state member-case-empty member-case-empty--fixed-slot">
                      <FileText size={40} className="empty-icon" />
                      <h3>
                        {cases.length === 0
                          ? '접수된 사례가 없습니다'
                          : `${formatMonthBarLabel(monthKey)} 접수 건이 없습니다`}
                      </h3>
                      <p>
                        {cases.length === 0
                          ? '해당 구성원의 우수사례 접수 내역이 없습니다'
                          : '다른 월을 선택해 보세요'}
                      </p>
                    </div>
                  ) : (
                    <div className="member-case-table-wrap member-case-list-scroll">
                      <table className="member-case-table">
                        <thead>
                          <tr>
                            <th className="mct-col-no">순번</th>
                            <th className="mct-col-status">상태</th>
                            <th className="mct-col-score">총점</th>
                            <th className="mct-col-title">접수 내용</th>
                            <th className="mct-col-call-date">상담일자</th>
                            <th className="mct-col-date">접수일자</th>
                            <th className="mct-col-action" aria-hidden />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((c, i) => (
                            <tr
                              key={c.id}
                              className="mct-row fade-in-up"
                              style={{ animationDelay: `${i * 0.04}s` }}
                              onClick={() => setDetailCaseId(c.id)}
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setDetailCaseId(c.id)}
                            >
                              <td className="mct-no">{i + 1}</td>
                              <td className="mct-status">
                                <StatusBadge status={c.status} size="sm" />
                              </td>
                              <td
                                className={`mct-score${
                                  c.totalScore == null || Number.isNaN(Number(c.totalScore))
                                    ? ' mct-score--empty'
                                    : ''
                                }`}
                              >
                                {formatCaseListScoreDisplay(c)}
                              </td>
                              <td className="mct-title">{caseDescriptionExcerpt(c.description)}</td>
                              <td className="mct-call-date">{formatCaseDateTimeMmDdKorean(c.callDate)}</td>
                              <td className="mct-date">{formatCaseDateTimeMmDdKorean(c.submittedAt)}</td>
                              <td className="mct-action" aria-hidden>
                                <ChevronRight size={14} strokeWidth={2} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
