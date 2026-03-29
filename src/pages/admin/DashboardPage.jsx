import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Award,
  BarChart2,
  FileText,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import {
  fetchAdminDashboard,
  fetchAdminLeafTeams,
  fetchAdminRanking,
  fetchTeamDetail,
} from '../../api/adminApi';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import AdminMemberDetailCard from './AdminMemberDetailCard';
import './DashboardPage.css';

const RANK_TOP_N = 3;

/** API 랭킹 항목 → 카드 행 (TB_YOU_PRO_CASE 접수 건수) */
function rankRowsFromApi(entries) {
  if (!entries?.length) return [];
  return entries.map((e) => ({
    id: e.skid,
    name: e.memberName,
    teamName: e.teamName,
    value: `${e.submittedCount}건`,
  }));
}

function enrichTeam(team) {
  const pendingSum = (team.members || []).reduce(
    (s, m) => s + Number(m.pendingCount || 0),
    0
  );
  return { ...team, pendingSum };
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
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  /** 2depth 부서 필터: 전체 | 백엔드 설정 dept_id */
  const [secondDepthKey, setSecondDepthKey] = useState('all');
  const [sortConfig, setSortConfig] = useState({
    key: 'totalSubmitted',
    direction: 'desc',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
  });

  const filterMeta = data?.filterMeta;
  const secondDepthOptions = useMemo(
    () => mergeSecondDepthOptions(filterMeta?.secondDepthDepts),
    [filterMeta?.secondDepthDepts]
  );

  const { year: dashYear } = data ?? {};

  const { data: rankingData } = useQuery({
    queryKey: ['admin-ranking', dashYear, RANK_TOP_N],
    queryFn: () => fetchAdminRanking(dashYear, RANK_TOP_N),
    enabled: dashYear != null,
  });

  const { data: leafPayload } = useQuery({
    queryKey: ['admin-leaf-teams', secondDepthKey],
    queryFn: () =>
      fetchAdminLeafTeams(secondDepthKey === 'all' ? null : Number(secondDepthKey)),
    enabled: data != null,
  });

  const teamsEnriched = useMemo(() => {
    const teams = leafPayload?.teams ?? [];
    return teams.map(enrichTeam);
  }, [leafPayload?.teams]);

  const sortedTeams = useMemo(() => {
    const list = [...teamsEnriched];
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const compare = (a, b) => {
      if (key === 'name') {
        return a.name.localeCompare(b.name, 'ko') * dir;
      }
      const va = Number(a[key] ?? 0);
      const vb = Number(b[key] ?? 0);
      return (va - vb) * dir;
    };
    return list.sort(compare);
  }, [teamsEnriched, sortConfig]);

  useEffect(() => {
    setSelectedTeamId((id) => {
      if (id == null) return null;
      const still = teamsEnriched.some((t) => Number(t.id) === Number(id));
      return still ? id : null;
    });
  }, [teamsEnriched]);

  const {
    data: teamDetailData,
    isLoading: teamDetailLoading,
    isError: teamDetailError,
    error: teamDetailErr,
  } = useQuery({
    queryKey: ['team-detail', selectedTeamId],
    queryFn: () => fetchTeamDetail(selectedTeamId),
    enabled: selectedTeamId != null,
  });

  /** 센터 전체 검토 대기 건수 — 대시보드 집계 팀 합산 */
  const totalPendingReview = useMemo(
    () => teamsEnriched.reduce((sum, t) => sum + Number(t.pendingSum ?? 0), 0),
    [teamsEnriched]
  );

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
  const selectedTeam = teamsEnriched.find((t) => Number(t.id) === Number(selectedTeamId));

  const secondDepthLabelHint =
    secondDepthOptions.length > 0
      ? secondDepthOptions.map((o) => o.id).join('·')
      : '—';
  const leafDepthHint = filterMeta?.leafTeamDepth ?? 4;

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="adm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">유프로 구성원 현황 대시보드</h1>
            <p className="adm-sub">
              STT·AI 기반 YOU프로 선정과 정기 연금형 인센티브 운영을 지원합니다. {year}년 기준 실(부서)별·
              구성원별 선정 실적을 확인하세요.
            </p>
          </div>
          <Link
            className="adm-header-link adm-header-link--pending-btn adm-pending-btn--cute"
            to="/admin/pending"
            aria-label={`검토 대기 ${totalPendingReview}건으로 이동`}
          >
            <span className="adm-pending-shine" aria-hidden />
            <span className="adm-pending-btn__inner">
              <span className="adm-pending-btn__label">검토 대기</span>
              <span className="adm-pending-btn__num">{totalPendingReview}</span>
              <span className="adm-pending-btn__unit">건</span>
            </span>
            <ChevronRight className="adm-pending-btn__chev" size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      </header>

      {/* 전체 센터 개요 */}
      <section className="adm-section adm-section--center-overview">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">전체 센터 현황</h2>
            <p className="adm-section-hint">
              2depth 부서 ID <strong>{secondDepthLabelHint}</strong> 하위 합산 · {year}년 기준
            </p>
          </div>
        </div>
        <div className="adm-overview-shell">
          <div className="adm-overview-grid adm-overview-grid--four">
            <div className="adm-kpi-card adm-kpi-card--tone-files">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <FileText className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">전체 신청 건수</span>
              </div>
              <div className="adm-kpi-value-row" aria-label={`전체 신청 ${totalSubmitted}건`}>
                <span className="adm-kpi-val">{totalSubmitted}</span>
                <span className="adm-kpi-suffix">건</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                해당 연도 접수
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-award">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <Award className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">전체 선정 건수</span>
              </div>
              <div className="adm-kpi-value-row" aria-label={`전체 선정 ${totalSelected}건`}>
                <span className="adm-kpi-val">{totalSelected}</span>
                <span className="adm-kpi-suffix">건</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                해당 연도 선정
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-chart">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <BarChart2 className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">목표 달성률</span>
              </div>
              <div
                className="adm-kpi-value-row"
                aria-label={`목표 달성률 ${((centerAvg / 36) * 100).toFixed(0)}%`}
              >
                <span className="adm-kpi-val">{((centerAvg / 36) * 100).toFixed(0)}</span>
                <span className="adm-kpi-suffix">%</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                인당 연간 선정 한도(36회) 대비 평균
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-users">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <Users className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">평가 대상자</span>
              </div>
              <div className="adm-kpi-value-row" aria-label={`평가 대상자 ${memberCount}명`}>
                <span className="adm-kpi-val">{memberCount}</span>
                <span className="adm-kpi-suffix">명</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                등록 구성원
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 누적 개인 랭킹 — TB_YOU_PRO_CASE 접수 건수 (2depth 센터별 통계) */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">랭킹</h2>
            <p className="adm-section-hint">
              {year}년 사례 접수 건수(TB_YOU_PRO_CASE) 기준 · 2depth 센터별 접수 합계 및 상위 {RANK_TOP_N}명
            </p>
          </div>
        </div>
        <div className="adm-ranking-row-three">
          {(rankingData?.bySecondDepth ?? []).map((block, i) => (
            <RankingCard
              key={block.secondDepthDeptId}
              title={`${block.secondDepthName} (ID ${block.secondDepthDeptId}) · 센터 접수 ${block.centerTotalSubmitted}건`}
              badgeClass={i % 3 === 0 ? 'adm-badge--lavender' : i % 3 === 1 ? 'adm-badge--rose' : 'adm-badge--combined'}
              icon={Trophy}
              rows={rankRowsFromApi(block.topMembers)}
              emptyHint={`${block.secondDepthName} 소속 구성원이 없거나 접수가 없습니다.`}
            />
          ))}
          <RankingCard
            title={`2depth 전체 합집합 · 센터 접수 ${rankingData?.combined?.totalSubmitted ?? 0}건`}
            badgeClass="adm-badge--combined"
            icon={Trophy}
            rows={rankRowsFromApi(rankingData?.combined?.topMembers)}
            emptyHint="해당 범위 구성원이 없거나 접수가 없습니다."
          />
        </div>
      </section>

      {/* 실별 성과 테이블 */}
      <section className="adm-section">
        <div className="adm-section-title adm-section-title--with-filter">
          <span className="adm-title-bar" />
          <div className="adm-section-title-text">
            <h2 className="adm-section-heading">실(부서)별 성과</h2>
            <p className="adm-section-hint">
              2depth 부서를 고르면 그 하위 depth {leafDepthHint} 팀만 표시 · 행을 클릭하면 해당 팀 구성원을 아래에 표시
            </p>
          </div>
          <div className="adm-dept-filter">
            <label className="adm-dept-filter-label" htmlFor="adm-dept-performance-filter">
              2depth 부서
            </label>
            <select
              id="adm-dept-performance-filter"
              className="adm-dept-filter-select"
              value={secondDepthKey}
              onChange={(e) => setSecondDepthKey(e.target.value)}
              aria-label="2depth 부서 필터"
            >
              <option value="all">전체 (설정 루트 합집합)</option>
              {secondDepthOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} (ID {o.id})
                </option>
              ))}
            </select>
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
                  label="연간 접수 건수"
                  sortKey="totalSubmitted"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="연간 선정 건수"
                  sortKey="totalSelected"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="이달 접수 건수"
                  sortKey="monthlySubmitted"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="이달 선정 건수"
                  sortKey="monthlySelected"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-table-empty">
                    {secondDepthKey === 'all'
                      ? 'leaf 팀이 없습니다. (부서 트리·depth 설정을 확인하세요)'
                      : `선택한 2depth 하위 depth ${leafDepthHint} 팀이 없습니다.`}
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
                    <td>{Number(team.totalSubmitted ?? 0)}건</td>
                    <td>{team.totalSelected}건</td>
                    <td>{Number(team.monthlySubmitted ?? 0)}건</td>
                    <td>{Number(team.monthlySelected ?? 0)}건</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 선택 실 구성원 — 팀 상세(실 상세 페이지와 동일 UI) */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">구성원 상세 현황</h2>
            {selectedTeamId != null && selectedTeam && (
              <p className="adm-section-hint">
                {teamDetailLoading && `${selectedTeam.name} · 구성원·사례를 불러오는 중…`}
                {!teamDetailLoading && teamDetailError && `${selectedTeam.name} · 정보를 불러오지 못했습니다.`}
                {!teamDetailLoading && teamDetailData && (
                  <>
                    {teamDetailData.team.name} · {teamDetailData.members?.length ?? 0}명 · 카드를 펼치면 사례
                    목록과 판정을 이용할 수 있어요
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {selectedTeamId == null ? (
          <div className="adm-select-prompt">
            <Users className="adm-select-prompt-ico" size={40} strokeWidth={1.25} />
            <h3>팀을 선택해 주세요</h3>
            <p>위 표에서 leaf 팀 행을 클릭하면 해당 팀 구성원·사례를 아래에서 바로 확인할 수 있습니다.</p>
          </div>
        ) : teamDetailLoading ? (
          <div className="adm-team-detail-loading">
            <div className="spinner" />
            <p>구성원·사례 정보를 불러오는 중…</p>
          </div>
        ) : teamDetailError ? (
          <p className="adm-team-detail-error">불러오기 실패: {teamDetailErr?.message ?? '알 수 없는 오류'}</p>
        ) : teamDetailData ? (
          <div className="adm-team-detail-embed member-cards-list">
            {teamDetailData.members.map((m) => (
              <AdminMemberDetailCard key={m.id} member={m} embedReadOnly />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
