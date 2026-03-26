import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchTeamDetail } from '../../api/adminApi';
import AdminMemberDetailCard from './AdminMemberDetailCard';
import './DashboardPage.css';
import './TeamDetailPage.css';

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
    <div className="page-container adm-dashboard--yp fade-in">
      <div className="team-detail-header">
        <button
          type="button"
          className="adm-back-btn team-detail-back"
          onClick={() => navigate('/admin')}
          aria-label="대시보드로 돌아가기"
        >
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          <span>뒤로</span>
        </button>
        <div className="team-detail-header-main">
          <p className="team-detail-kicker">YOU PRO</p>
          <h1 className="page-title">{team.name} 구성원 현황</h1>
          <p className="page-sub">
            총 {members.length}명 · {new Date().getFullYear()}년 기준 선정·접수 현황
          </p>
        </div>
      </div>

      <div className="member-cards-list">
        {members.map((m) => (
          <AdminMemberDetailCard key={m.id} member={m} />
        ))}
      </div>
    </div>
  );
}
