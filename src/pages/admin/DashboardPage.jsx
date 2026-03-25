import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Award,
  BarChart2,
  FileText,
  ChevronRight,
  Trophy,
  Building2,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchAdminDashboard } from '../../api/adminApi';
import AdminMemberCasesModal from './AdminMemberCasesModal';
import './DashboardPage.css';

function enrichTeam(team) {
  const monthlySum = (team.members || []).reduce(
    (s, m) => s + Number(m.monthlySelected || 0),
    0
  );
  const pendingSum = (team.members || []).reduce(
    (s, m) => s + Number(m.pendingCount || 0),
    0
  );
  const monthlyAvg = team.memberCount > 0 ? monthlySum / team.memberCount : 0;
  return { ...team, monthlySum, pendingSum, monthlyAvg };
}

function SortTh({ label, sortKey, sortConfig, onSort }) {
  const active = sortConfig.key === sortKey;
  return (
    <th scope="col">
      <button
        type="button"
        className={`adm-th-btn ${active ? 'is-sorted' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active && (
          <span className="adm-sort-icon" aria-hidden>
            {sortConfig.direction === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  );
}

function MemberMiniCard({ member, onOpen }) {
  const monthPct = Math.min((member.monthlySelected / 3) * 100, 100);
  return (
    <button
      type="button"
      className="member-mini-card member-mini-card--clickable"
      onClick={onOpen}
      aria-label={`${member.name} 접수 내역 보기`}
    >
      <div className="member-mini-avatar">{member.name[0]}</div>
      <div className="member-mini-info">
        <span className="member-mini-name">{member.name}</span>
        <span className="member-mini-pos">{member.position}</span>
      </div>
      <div className="member-mini-stats">
        <div className="member-mini-stat">
          <span>{member.totalSelected}건</span>
          <span className="member-mini-label">연간</span>
        </div>
        <div className="member-mini-monthly">
          <span>{member.monthlySelected}/3</span>
          <div className="member-mini-bar">
            <div className="member-mini-bar-fill" style={{ width: `${monthPct}%` }} />
          </div>
          <span className="member-mini-label">이번 달</span>
        </div>
        {member.pendingCount > 0 && (
          <span className="pending-pill">{member.pendingCount} 대기</span>
        )}
      </div>
    </button>
  );
}

function RankingCard({ title, badgeClass, icon: Icon, rows, emptyHint }) {
  return (
    <div className="adm-ranking-card">
      <div className={`adm-ranking-badge ${badgeClass}`}>
        <Icon size={13} strokeWidth={2.2} />
        {title}
      </div>
      <div className="adm-ranking-list">
        {rows.length === 0 ? (
          <p className="adm-ranking-empty">{emptyHint}</p>
        ) : (
          rows.map((row, index) => (
            <div key={String(row.id)} className="adm-ranking-row">
              <span className={`adm-rank-num adm-rank-num--${index + 1}`}>{index + 1}</span>
              <div className="adm-rank-info">
                <span className="adm-rank-name">{row.name}</span>
                <span className="adm-rank-dept">{row.teamName}</span>
              </div>
              <span className="adm-rank-val">{row.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [casesModalMember, setCasesModalMember] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'totalSelected',
    direction: 'desc',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
  });

  const monthlyChartData = useMemo(() => {
    const points = data?.monthlyTrend;
    if (!points?.length) {
      return Array.from({ length: 12 }, (_, i) => ({
        label: `${i + 1}월`,
        submitted: 0,
        selected: 0,
      }));
    }
    return points.map((p) => ({
      label: `${p.month}월`,
      submitted: Number(p.submitted),
      selected: Number(p.selected),
    }));
  }, [data?.monthlyTrend]);

  const teamsEnriched = useMemo(() => {
    if (!data?.teams) return [];
    return data.teams.map(enrichTeam);
  }, [data?.teams]);

  const sortedTeams = useMemo(() => {
    const list = [...teamsEnriched];
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const compare = (a, b) => {
      if (key === 'name') {
        return a.name.localeCompare(b.name, 'ko') * dir;
      }
      const va = a[key];
      const vb = b[key];
      return (va - vb) * dir;
    };
    return list.sort(compare);
  }, [teamsEnriched, sortConfig]);

  const membersFlat = useMemo(
    () =>
      teamsEnriched.flatMap((t) =>
        (t.members || []).map((m) => ({
          ...m,
          teamName: t.name,
        }))
      ),
    [teamsEnriched]
  );

  /** 실(부서)별 연간 선정 건수 합계 상위 */
  const rankTeams = useMemo(() => {
    const sorted = [...teamsEnriched].sort((a, b) => b.totalSelected - a.totalSelected);
    return sorted.slice(0, 3).map((t) => ({
      id: `team-${t.id}`,
      name: t.name,
      teamName: `구성원 ${t.memberCount}명`,
      value: `${t.totalSelected}건`,
    }));
  }, [teamsEnriched]);

  /** 구성원 연간 선정 건수 상위 */
  const rankMemberYear = useMemo(() => {
    const sorted = [...membersFlat].sort((a, b) => b.totalSelected - a.totalSelected);
    return sorted.slice(0, 3).map((m) => ({
      ...m,
      value: `${m.totalSelected}건`,
    }));
  }, [membersFlat]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        const isText = key === 'name';
        return { key, direction: isText ? 'asc' : 'desc' };
      }
      return {
        key,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  if (isLoading || !data) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>데이터를 불러오는 중...</p>
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

  const {
    year,
    centerAvg = 0,
    totalSubmitted = 0,
    totalSelected = 0,
    memberCount = 0,
  } = data;
  const selectedTeam = teamsEnriched.find((t) => t.id === selectedTeamId);

  return (
    <div className="page-container adm-dashboard fade-in">
      <header className="adm-header">
        <div className="adm-header-text">
          <h1 className="adm-title">팀 관리 대시보드</h1>
          <p className="adm-sub">
            {year}년 기준 · 실(부서)별·구성원별 우수사례 선정 현황을 한눈에 확인하세요
          </p>
        </div>
      </header>

      {/* 전체 센터 개요 */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">전체 센터 현황</h2>
            <p className="adm-section-hint">{year}년 기준 신청·선정·목표·평가 대상 인원</p>
          </div>
        </div>
        <div className="adm-overview-grid adm-overview-grid--four">
          <div className="adm-kpi-card">
            <div className="adm-kpi-head">
              <FileText className="adm-kpi-ico" size={20} />
              <span>전체 신청 건수</span>
            </div>
            <div className="adm-kpi-val">{totalSubmitted}</div>
            <div className="adm-kpi-unit">건 (해당 연도 접수)</div>
          </div>
          <div className="adm-kpi-card">
            <div className="adm-kpi-head">
              <Award className="adm-kpi-ico" size={20} />
              <span>전체 선정 건수</span>
            </div>
            <div className="adm-kpi-val">{totalSelected}</div>
            <div className="adm-kpi-unit">건 (해당 연도 선정)</div>
          </div>
          <div className="adm-kpi-card">
            <div className="adm-kpi-head">
              <BarChart2 className="adm-kpi-ico" size={20} />
              <span>목표 달성률</span>
            </div>
            <div className="adm-kpi-val">{((centerAvg / 36) * 100).toFixed(0)}</div>
            <div className="adm-kpi-unit">% (인당 연 36건 기준 평균)</div>
          </div>
          <div className="adm-kpi-card">
            <div className="adm-kpi-head">
              <Users className="adm-kpi-ico" size={20} />
              <span>평가 대상자</span>
            </div>
            <div className="adm-kpi-val">{memberCount}</div>
            <div className="adm-kpi-unit">명 (등록 구성원)</div>
          </div>
        </div>
      </section>

      {/* 실별·구성원 랭킹 + 월별 추이 */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">랭킹</h2>
            <p className="adm-section-hint">
              실별·구성원 상위 (각 3위) · 우측: 전체 센터 월별 신청·선정 추이
            </p>
          </div>
        </div>
        <div className="adm-ranking-chart-row">
          <RankingCard
            title="실별 총 랭킹"
            badgeClass="adm-badge--lavender"
            icon={Building2}
            rows={rankTeams}
            emptyHint="등록된 실이 없습니다."
          />
          <RankingCard
            title="구성원 연간 선정"
            badgeClass="adm-badge--rose"
            icon={Trophy}
            rows={rankMemberYear}
            emptyHint="구성원 데이터가 없습니다."
          />
          <aside className="adm-monthly-chart-card" aria-label={`${year}년 월별 신청 및 선정 추이`}>
            <div className="adm-monthly-chart-head">
              <BarChart2 size={16} className="adm-monthly-chart-head-ico" aria-hidden />
              <span>전체 센터 월별 추이</span>
              <span className="adm-monthly-chart-year">{year}년</span>
            </div>
            <div className="adm-monthly-chart-body">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(131, 24, 67, 0.08)" vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9d174d' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(244, 114, 182, 0.35)' }}
                    interval={0}
                    height={28}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9d174d' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid rgba(244, 114, 182, 0.35)',
                    }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value, name) => [`${value}건`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Bar
                    dataKey="submitted"
                    name="신청"
                    fill="#c4b5fd"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
                  />
                  <Line
                    type="monotone"
                    dataKey="selected"
                    name="선정"
                    stroke="#db2777"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#db2777', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="adm-monthly-chart-note">막대: 신청 건수 · 꺾은선: 선정 건수 (1~12월)</p>
          </aside>
        </div>
      </section>

      {/* 실별 성과 테이블 */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">실(부서)별 성과</h2>
            <p className="adm-section-hint">헤더를 눌러 정렬 · 행을 클릭하면 해당 실 구성원을 아래에 표시</p>
          </div>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <SortTh
                  label="실명"
                  sortKey="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="인원"
                  sortKey="memberCount"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="연간 누적 선정"
                  sortKey="totalSelected"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="인당 평균(연간)"
                  sortKey="avgSelected"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="이번 달 합계"
                  sortKey="monthlySum"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="이번 달 인당"
                  sortKey="monthlyAvg"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="검토 대기"
                  sortKey="pendingSum"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="adm-table-empty">
                    등록된 실이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedTeams.map((team) => (
                  <tr
                    key={team.id}
                    className={`adm-tr ${selectedTeamId === team.id ? 'is-selected' : ''}`}
                    onClick={() =>
                      setSelectedTeamId((id) => (id === team.id ? null : team.id))
                    }
                  >
                    <td>
                      <span className="adm-team-name">{team.name}</span>
                      <span className="adm-member-badge">{team.memberCount}명</span>
                    </td>
                    <td>{team.memberCount}</td>
                    <td>{team.totalSelected}건</td>
                    <td>{team.avgSelected.toFixed(1)}건</td>
                    <td>{team.monthlySum}건</td>
                    <td>{team.monthlyAvg.toFixed(1)}건</td>
                    <td>
                      {team.pendingSum > 0 ? (
                        <span className="adm-pending-badge">{team.pendingSum}건</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 선택 실 구성원 */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div className="adm-section-title-row">
            <div>
              <h2 className="adm-section-heading">구성원 상세 현황</h2>
              {selectedTeam && (
                <p className="adm-section-hint">
                  {selectedTeam.name} · {selectedTeam.members?.length ?? 0}명 · 카드를 누르면 접수 내역을
                  확인할 수 있어요
                </p>
              )}
            </div>
            {selectedTeam && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/admin/team/${selectedTeam.id}`)}
              >
                실 상세 보기 <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {!selectedTeam ? (
          <div className="adm-select-prompt">
            <Users className="adm-select-prompt-ico" size={40} strokeWidth={1.25} />
            <h3>실을 선택해 주세요</h3>
            <p>위 표에서 실(부서) 행을 클릭하면 해당 실 구성원 카드가 표시됩니다.</p>
          </div>
        ) : (
          <div className="members-mini-grid">
            {selectedTeam.members.map((m) => (
              <MemberMiniCard
                key={m.id}
                member={m}
                onOpen={() =>
                  setCasesModalMember({
                    id: m.id,
                    name: m.name,
                    position: m.position,
                    teamName: selectedTeam.name,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <AdminMemberCasesModal
        open={!!casesModalMember}
        member={casesModalMember}
        onClose={() => setCasesModalMember(null)}
      />
    </div>
  );
}
