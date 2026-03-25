import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { fetchTeamDetail } from '../../api/adminApi';
import StatusBadge from '../../components/common/StatusBadge';
import CaseReviewModal from './CaseReviewModal';
import './TeamDetailPage.css';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function MemberDetailCard({ member }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewCase, setReviewCase] = useState(null);
  const monthPct = Math.min((member.monthlySelected / 3) * 100, 100);

  return (
    <div className={`member-detail-card ${expanded ? 'expanded' : ''}`}>
      <div className="member-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="member-card-left">
          <div className="member-avatar-lg">{member.name[0]}</div>
          <div>
            <div className="member-card-name">{member.name}</div>
            <div className="member-card-pos">{member.position}</div>
          </div>
        </div>

        <div className="member-card-stats">
          <div className="mcs-item">
            <span className="mcs-label">연간 누적</span>
            <span className="mcs-value">{member.totalSelected}건</span>
          </div>
          <div className="mcs-item">
            <span className="mcs-label">이번 달</span>
            <div className="mcs-monthly">
              <span className="mcs-value blue">{member.monthlySelected} / 3</span>
              <div className="mcs-bar">
                <div className="mcs-bar-fill" style={{ width: `${monthPct}%` }} />
              </div>
            </div>
          </div>
          {member.pendingCount > 0 && (
            <div className="mcs-item">
              <span className="mcs-label">대기 중</span>
              <span className="mcs-value amber">{member.pendingCount}건</span>
            </div>
          )}
        </div>

        <button className="expand-btn" aria-label="상세 보기">
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
                  className="btn btn-secondary btn-sm review-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewCase(c);
                  }}
                >
                  <Eye size={14} />
                  {c.status === 'pending' ? '판정하기' : '상세'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {reviewCase && (
        <CaseReviewModal
          caseData={reviewCase}
          memberName={member.name}
          onClose={() => setReviewCase(null)}
        />
      )}
    </div>
  );
}

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['team-detail', teamId],
    queryFn: () => fetchTeamDetail(teamId),
  });

  if (isLoading || !data) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>팀 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <p style={{ color: '#ef4444' }}>오류: {error?.message}</p>
      </div>
    );
  }

  const { team, members = [] } = data;

  return (
    <div className="page-container fade-in">
      <div className="team-detail-header">
        <button className="back-link" onClick={() => navigate('/admin')}>
          <ArrowLeft size={16} />
          대시보드
        </button>
        <div>
          <h1 className="page-title">{team.name} 구성원 현황</h1>
          <p className="page-sub">총 {members.length}명 · 2026년 기준</p>
        </div>
      </div>

      <div className="member-cards-list">
        {members.map((m) => (
          <MemberDetailCard key={m.id} member={m} />
        ))}
      </div>
    </div>
  );
}
