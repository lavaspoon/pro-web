import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { fetchCaseForReview } from '../../api/adminApi';
import StatusBadge from '../../components/common/StatusBadge';
import CaseReviewModal from './CaseReviewModal';
import './TeamDetailPage.css';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/**
 * 실(팀) 상세 — 구성원별 접기/펼치기 사례 목록 + 모달
 * TeamDetailPage · Dashboard 공통
 * @param {boolean} embedReadOnly 대시보드 임베드: 판정 위저드 대신 접수·판정·AI 요약 상세만 표시
 */
export default function AdminMemberDetailCard({ member, embedReadOnly = false }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewCase, setReviewCase] = useState(null);
  const [loadingCaseId, setLoadingCaseId] = useState(null);
  const limit = Number(member.monthlyLimit) > 0 ? Number(member.monthlyLimit) : 3;
  const monthPct = Math.min((Number(member.monthlySelected || 0) / limit) * 100, 100);
  const totalSubmitted = Number(member.totalSubmitted ?? 0);
  const monthlySubmitted = Number(member.monthlySubmitted ?? 0);

  return (
    <div className={`member-detail-card member-detail-card--metrics ${expanded ? 'expanded' : ''}`}>
      <div className="member-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="member-card-left">
          <div className="member-avatar-lg">{member.name[0]}</div>
          <div>
            <div className="member-card-name">{member.name}</div>
            <div className="member-card-pos">{member.position}</div>
          </div>
        </div>

        <div className="member-card-stats member-card-stats--metrics">
          <div className="mcs-item">
            <span className="mcs-label">연간 접수 건수</span>
            <span className="mcs-value">{totalSubmitted}건</span>
          </div>
          <div className="mcs-item">
            <span className="mcs-label">연간 선정 건수</span>
            <span className="mcs-value">{member.totalSelected}건</span>
          </div>
          <div className="mcs-item">
            <span className="mcs-label">이달 접수 건수</span>
            <span className="mcs-value">{monthlySubmitted}건</span>
          </div>
          <div className="mcs-item mcs-item--with-bar">
            <span className="mcs-label">이달 선정 건수</span>
            <div className="mcs-monthly">
              <span className="mcs-value blue">
                {member.monthlySelected} / {limit}
              </span>
              <div className="mcs-bar">
                <div className="mcs-bar-fill" style={{ width: `${monthPct}%` }} />
              </div>
            </div>
          </div>
          <div className="mcs-item">
            <span className="mcs-label">대기중</span>
            <span
              className={`mcs-value ${Number(member.pendingCount) > 0 ? 'amber' : ''}`}
            >
              {member.pendingCount}건
            </span>
          </div>
        </div>

        <button type="button" className="expand-btn" aria-label="상세 보기">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div className="member-cases-list fade-in-up">
          <div className="member-cases-header">
            <span>전체 사례 ({member.cases.length}건)</span>
          </div>
          {member.cases.length === 0 ? (
            <p className="no-cases">접수된 사례가 없습니다</p>
          ) : (
            member.cases.map((c) => (
              <div key={c.id} className="case-row">
                <div className="case-row-left">
                  <StatusBadge status={c.status} size="sm" />
                  <div>
                    <p className="case-row-title">{c.title}</p>
                    <p className="case-row-meta">
                      {c.month.replace('-', '년 ')}월 · 접수 {formatDate(c.submittedAt)}
                      {c.judgedAt && ` · 판정 ${formatDate(c.judgedAt)}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm review-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setLoadingCaseId(c.id);
                    try {
                      const full = await fetchCaseForReview(c.id);
                      setReviewCase(full);
                    } catch {
                      setReviewCase(c);
                    } finally {
                      setLoadingCaseId(null);
                    }
                  }}
                  disabled={loadingCaseId === c.id}
                >
                  <Eye size={14} />
                  {loadingCaseId === c.id
                    ? '…'
                    : embedReadOnly
                      ? '상세'
                      : c.status === 'pending'
                        ? '판정하기'
                        : '상세'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {reviewCase &&
        createPortal(
          <CaseReviewModal
            variant={embedReadOnly ? 'detail' : 'wizard'}
            caseData={reviewCase}
            memberName={member.name}
            onClose={() => setReviewCase(null)}
            onRefreshCase={async () => {
              const full = await fetchCaseForReview(reviewCase.id);
              setReviewCase(full);
            }}
          />,
          document.body
        )}
    </div>
  );
}
