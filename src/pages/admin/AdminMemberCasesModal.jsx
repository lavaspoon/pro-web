import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  Filter,
  Calendar,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { fetchMyCases, fetchCaseDetail } from '../../api/memberApi';
import StatusBadge from '../../components/common/StatusBadge';
import AiInsight from '../../components/member/AiInsight';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import '../../pages/member/CaseListPage.css';
import '../../components/member/MemberCaseListModal.css';
import '../../components/member/MemberCaseDetailModal.css';

const STATUS_FILTER = ['전체', '대기중', '선정', '비선정'];
const STATUS_MAP = { 대기중: 'pending', 선정: 'selected', 비선정: 'rejected' };

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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
            <div className="detail-hero member-case-detail-hero">
              <div className="member-case-detail-title-row">
                <h3 className="detail-title">{caseData.title}</h3>
                <StatusBadge status={caseData.status} size="sm" />
              </div>
              <p className="detail-desc">{caseData.description}</p>
              <div className="detail-meta-row">
                <span className="meta-item">
                  <Calendar size={13} />
                  접수 {formatDateTime(caseData.submittedAt)}
                </span>
                <span className="meta-item">
                  <CalendarClock size={13} />
                  통화 일시 {formatCaseCallDateTime(caseData.callDate)}
                </span>
                {showDuration && (
                  <span className="meta-item">
                    <Clock size={13} />
                    녹취 길이 {caseData.callDuration}
                  </span>
                )}
              </div>
            </div>

            {caseData.status === 'pending' && (
              <div className="pending-notice">
                <Clock size={16} />
                <div>
                  <strong>대기중</strong>
                  <p>담당자가 녹취콜을 청취하고 있습니다. 결과가 나오면 알려드립니다.</p>
                </div>
              </div>
            )}

            {caseData.status !== 'pending' && (
              <div className="member-case-ai-wrap">
                <AiInsight
                  judgmentReason={caseData.judgmentReason}
                  caseStatus={caseData.status}
                  judgedAtLabel={caseData.judgedAt ? formatDateTime(caseData.judgedAt) : null}
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
                  {member.name}님 사례 목록
                </h2>
                <p className="member-case-list-lede">
                  {member.teamName && `${member.teamName}`}
                  {member.position ? `${member.teamName ? ' · ' : ''}${member.position}` : ''}
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

            <div className="member-case-list-meta">
              해당 월 접수 <strong>{casesInMonth.length}</strong>건 · 전체 누적 <strong>{cases.length}</strong>건
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
                            <th className="mct-col-no">#</th>
                            <th className="mct-col-status">상태</th>
                            <th className="mct-col-title">사례 제목</th>
                            <th className="mct-col-date">접수일</th>
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
                              <td className="mct-title">{c.title}</td>
                              <td className="mct-date">{formatDate(c.submittedAt)}</td>
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
