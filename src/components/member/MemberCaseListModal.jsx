import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, ChevronRight, PlusCircle, Filter, Heart } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMyCases } from '../../api/memberApi';
import StatusBadge from '../common/StatusBadge';
import { useMemberModalStore } from '../../store/memberModalStore';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import '../../pages/member/CaseListPage.css';
import './MemberCaseListModal.css';

const STATUS_FILTER = ['전체', '검토 중', '선정', '비선정'];
const STATUS_MAP = { '검토 중': 'pending', 선정: 'selected', 비선정: 'rejected' };

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

export default function MemberCaseListModal() {
  const { user } = useAuthStore();
  const open = useMemberModalStore((s) => s.caseListOpen);
  const closeCaseList = useMemberModalStore((s) => s.closeCaseList);
  const openSubmit = useMemberModalStore((s) => s.openSubmit);
  const openCaseDetail = useMemberModalStore((s) => s.openCaseDetail);
  const [activeFilter, setActiveFilter] = useState('전체');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['my-cases', user?.skid],
    queryFn: () => fetchMyCases(user.skid),
    enabled: !!user?.skid && open,
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
      if (e.key === 'Escape') closeCaseList();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeCaseList]);

  const filtered =
    activeFilter === '전체'
      ? cases
      : cases.filter((c) => c.status === STATUS_MAP[activeFilter]);

  const goDetail = (id) => {
    closeCaseList();
    openCaseDetail(id);
  };

  const goSubmit = () => {
    closeCaseList();
    openSubmit();
  };

  if (!open) return null;

  return (
    <div
      className="member-modal-root member-case-list-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-case-list-title"
    >
      <button
        type="button"
        className="member-modal-backdrop member-modal-backdrop--list"
        aria-label="모달 닫기"
        onClick={closeCaseList}
      />
      <div className="member-modal-panel member-case-list-modal">
        <span className="member-modal-blob member-modal-blob--list1" aria-hidden />
        <span className="member-modal-blob member-modal-blob--list2" aria-hidden />
        <span className="member-modal-sticker member-modal-sticker--heart" aria-hidden>
          <Heart size={17} fill="currentColor" />
        </span>

        <div className="member-case-list-head">
          <div>
            <p className="member-cute-kicker">나만의 기록장</p>
            <h2 id="member-case-list-title" className="member-cute-title">
              내 사례 목록
            </h2>
            <p className="member-cute-sub">접수한 사례를 한눈에 볼 수 있어요</p>
          </div>
          <div className="member-case-list-head-actions">
            <button type="button" className="member-cute-mini-btn" onClick={goSubmit}>
              <PlusCircle size={15} />
              새 접수
            </button>
            <button type="button" className="member-modal-close" onClick={closeCaseList} aria-label="닫기">
              <X size={20} strokeWidth={2.25} />
            </button>
          </div>
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
                  <p>우수 응대 사례를 접수해 보세요</p>
                  <button type="button" className="btn btn-primary" onClick={goSubmit}>
                    <PlusCircle size={16} />
                    우수사례 접수
                  </button>
                </div>
              ) : (
                <div className="case-list member-case-list-scroll">
                  {filtered.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      className="case-item fade-in-up"
                      style={{ animationDelay: `${i * 0.04}s` }}
                      onClick={() => goDetail(c.id)}
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
  );
}
