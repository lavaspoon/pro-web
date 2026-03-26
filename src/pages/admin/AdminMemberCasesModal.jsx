import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, ChevronRight, Filter } from 'lucide-react';
import { fetchMyCases } from '../../api/memberApi';
import { fetchCaseForReview } from '../../api/adminApi';
import StatusBadge from '../../components/common/StatusBadge';
import CaseReviewModal from './CaseReviewModal';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import '../../pages/member/CaseListPage.css';
import '../../components/member/MemberCaseListModal.css';

const STATUS_FILTER = ['전체', '대기중', '선정', '비선정'];
const STATUS_MAP = { 대기중: 'pending', 선정: 'selected', 비선정: 'rejected' };

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function monthChip(month) {
  if (!month || typeof month !== 'string') return '—';
  const parts = month.split('-');
  if (parts.length >= 2) return `${parts[0]}년 ${parts[1]}월`;
  return month;
}

/**
 * 관리자 대시보드 — 구성원 카드 클릭 시 접수 내역 (구성원 MemberCaseListModal UI 참고)
 */
export default function AdminMemberCasesModal({ open, member, onClose }) {
  const [activeFilter, setActiveFilter] = useState('전체');
  const [reviewCase, setReviewCase] = useState(null);
  const [loadingCaseId, setLoadingCaseId] = useState(null);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['admin-member-cases', member?.id],
    queryFn: () => fetchMyCases(member.id),
    enabled: !!member?.id && open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (reviewCase) setReviewCase(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, reviewCase]);

  useEffect(() => {
    if (!open) {
      setActiveFilter('전체');
      setReviewCase(null);
      setLoadingCaseId(null);
    }
  }, [open]);

  const filtered =
    activeFilter === '전체'
      ? cases
      : cases.filter((c) => c.status === STATUS_MAP[activeFilter]);

  const openReview = async (c) => {
    setLoadingCaseId(c.id);
    try {
      const full = await fetchCaseForReview(c.id);
      setReviewCase(full);
    } catch {
      setReviewCase(c);
    } finally {
      setLoadingCaseId(null);
    }
  };

  if (!open || !member) return null;

  return (
    <>
      <div
        className="member-modal-root member-case-list-root admin-member-cases-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-member-case-list-title"
      >
        <button
          type="button"
          className="member-modal-backdrop member-modal-backdrop--list"
          aria-label="모달 닫기"
          onClick={onClose}
        />
        <div className="member-modal-panel member-case-list-modal">
          <span className="member-modal-blob member-modal-blob--list1" aria-hidden />
          <span className="member-modal-blob member-modal-blob--list2" aria-hidden />

          <div className="member-case-list-head">
            <div>
              <p className="member-cute-kicker">접수 현황</p>
              <h2 id="admin-member-case-list-title" className="member-cute-title">
                {member.name}님 사례 목록
              </h2>
              <p className="member-cute-sub">
                {member.teamName}
                {member.position ? ` · ${member.position}` : ''}
              </p>
            </div>
            <button type="button" className="member-modal-close" onClick={onClose} aria-label="닫기">
              <X size={20} strokeWidth={2.25} />
            </button>
          </div>

          <div className="member-case-list-meta">
            총 <strong>{cases.length}</strong>건 접수
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
                        ? cases.length
                        : cases.filter((c) => c.status === STATUS_MAP[f]).length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="member-case-list-body">
                {filtered.length === 0 ? (
                  <div className="empty-state member-case-empty member-case-empty--fixed-slot">
                    <FileText size={40} className="empty-icon" />
                    <h3>접수된 사례가 없습니다</h3>
                    <p>해당 구성원의 우수사례 접수 내역이 없습니다</p>
                  </div>
                ) : (
                  <div className="case-list member-case-list-scroll">
                    {filtered.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        className="case-item fade-in-up"
                        style={{ animationDelay: `${i * 0.04}s` }}
                        onClick={() => openReview(c)}
                        disabled={loadingCaseId === c.id}
                      >
                        <div className="case-item-left">
                          <div className="case-month-chip">{monthChip(c.month)}</div>
                          <div className="case-item-body">
                            <h3 className="case-item-title">{c.title}</h3>
                            <p className="case-item-desc">{c.description}</p>
                            <div className="case-item-meta">
                              <span>접수: {formatDate(c.submittedAt)}</span>
                              {c.callDate && (
                                <>
                                  <span>·</span>
                                  <span>통화 {formatCaseCallDateTime(c.callDate)}</span>
                                </>
                              )}
                              {!c.callDate && c.customerType && (
                                <>
                                  <span>·</span>
                                  <span>{c.customerType}</span>
                                </>
                              )}
                              {c.callDuration && (
                                <>
                                  <span>·</span>
                                  <span>통화시간 {c.callDuration}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="case-item-right">
                          <StatusBadge status={c.status} />
                          {c.judgedAt && (
                            <span className="judged-date">판정 {formatDate(c.judgedAt)}</span>
                          )}
                          <ChevronRight size={18} className="case-arrow" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {reviewCase && (
        <CaseReviewModal
          caseData={reviewCase}
          memberName={member.name}
          overlayClassName="modal-overlay--on-top"
          onClose={() => setReviewCase(null)}
          onRefreshCase={async () => {
            const full = await fetchCaseForReview(reviewCase.id);
            setReviewCase(full);
          }}
        />
      )}
    </>
  );
}
