import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  Trophy,
  Clock,
  ChevronRight,
  X,
  BadgeCheck,
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

const RANK_TOP_N = 15;

/** 좌→우: 1~5위 | 6~10위 | 11~15위 (열당 5행 고정) */
const RANK_BLOCKS = [
  { id: 'r1-5', title: '1 ~ 5위', startRank: 1, endRank: 5 },
  { id: 'r6-10', title: '6 ~ 10위', startRank: 6, endRank: 10 },
  { id: 'r11-15', title: '11 ~ 15위', startRank: 11, endRank: 15 },
];

/** API 랭킹 항목 → 카드 행 (인센티브 반영 누적 선정 건수) */
function rankRowsFromApi(entries) {
  if (!entries?.length) return [];
  return entries.map((e) => ({
    id: e.skid,
    name: e.memberName,
    teamName: e.teamName,
    value: `${Number(e.cumulativeCount ?? 0)}건`,
  }));
}

function enrichTeam(team) {
  const pendingSum = (team.members || []).reduce(
    (s, m) => s + Number(m.pendingCount || 0),
    0
  );
  return { ...team, pendingSum };
}

/** 센터·그룹 필터용 정규화 (빈 값은 '') */
function normFilterKey(v) {
  return String(v ?? '').trim();
}

/** 동차 시 항상 센터 → 그룹 → 실명(팀명) 오름차순 */
function localeKo(a, b) {
  return String(a ?? '').trim().localeCompare(String(b ?? '').trim(), 'ko');
}

function deptHierarchyTiebreak(a, b) {
  let d = localeKo(a.centerName, b.centerName);
  if (d !== 0) return d;
  d = localeKo(a.groupName, b.groupName);
  if (d !== 0) return d;
  return localeKo(a.name, b.name);
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

export default function DashboardPage() {
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  /** null = 미적용, 문자열(빈 문자열 포함) = 해당 값과 일치하는 행만 */
  const [filterCenter, setFilterCenter] = useState(null);
  const [filterGroup, setFilterGroup] = useState(null);
  const [filterSkill, setFilterSkill] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'centerName',
    direction: 'asc',
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

  const rankingRows = useMemo(
    () => rankRowsFromApi(rankingData?.combined?.topMembers),
    [rankingData?.combined?.topMembers]
  );

  const { data: leafPayload } = useQuery({
    queryKey: ['admin-leaf-teams'],
    queryFn: () => fetchAdminLeafTeams(null),
    enabled: data != null,
  });

  const teamsEnriched = useMemo(() => {
    const teams = leafPayload?.teams ?? [];
    return teams.map(enrichTeam);
  }, [leafPayload?.teams]);

  const teamsFiltered = useMemo(() => {
    return teamsEnriched.filter((t) => {
      if (filterCenter !== null) {
        const c = normFilterKey(t.centerName);
        if (filterCenter === '' ? c !== '' : c !== filterCenter) return false;
      }
      if (filterGroup !== null) {
        const g = normFilterKey(t.groupName);
        if (filterGroup === '' ? g !== '' : g !== filterGroup) return false;
      }
      if (filterSkill !== null) {
        const s = normFilterKey(t.skill);
        if (filterSkill === '' ? s !== '' : s !== filterSkill) return false;
      }
      return true;
    });
  }, [teamsEnriched, filterCenter, filterGroup, filterSkill]);

  const sortedTeams = useMemo(() => {
    const list = [...teamsFiltered];
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const compare = (a, b) => {
      let primary;
      if (key === 'name' || key === 'centerName' || key === 'groupName' || key === 'skill') {
        primary = localeKo(a[key], b[key]) * dir;
      } else {
        const va = Number(a[key] ?? 0);
        const vb = Number(b[key] ?? 0);
        primary = (va - vb) * dir;
      }
      if (primary !== 0) return primary;
      return deptHierarchyTiebreak(a, b);
    };
    return list.sort(compare);
  }, [teamsFiltered, sortConfig]);

  const teamTableTotals = useMemo(() => {
    return sortedTeams.reduce(
      (acc, t) => ({
        reflectCumulativeTotal:
          acc.reflectCumulativeTotal + Number(t.reflectCumulativeTotal ?? 0),
        evalTargetMemberSum: acc.evalTargetMemberSum + Number(t.memberCount ?? 0),
        certifiedEvalTargetSum:
          acc.certifiedEvalTargetSum + Number(t.certifiedEvalTargetCount ?? 0),
      }),
      {
        reflectCumulativeTotal: 0,
        evalTargetMemberSum: 0,
        certifiedEvalTargetSum: 0,
      }
    );
  }, [sortedTeams]);

  const teamTableFooterCertRate =
    teamTableTotals.evalTargetMemberSum === 0
      ? null
      : Math.round(
          (1000 * teamTableTotals.certifiedEvalTargetSum) /
            teamTableTotals.evalTargetMemberSum
        ) / 10;

  useEffect(() => {
    setSelectedTeamId((id) => {
      if (id == null) return null;
      const still = teamsFiltered.some((t) => Number(t.id) === Number(id));
      return still ? id : null;
    });
  }, [teamsFiltered]);

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

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        const isText = key === 'name' || key === 'centerName' || key === 'groupName' || key === 'skill';
        return { key, direction: isText ? 'asc' : 'desc' };
      }
      return {
        key,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  const handleCenterFilterClick = (e, team) => {
    e.stopPropagation();
    const key = normFilterKey(team.centerName);
    setFilterCenter((prev) => (prev === key ? null : key));
  };

  const handleGroupFilterClick = (e, team) => {
    e.stopPropagation();
    const key = normFilterKey(team.groupName);
    setFilterGroup((prev) => (prev === key ? null : key));
  };

  const handleSkillFilterClick = (e, team) => {
    e.stopPropagation();
    const key = normFilterKey(team.skill);
    setFilterSkill((prev) => (prev === key ? null : key));
  };

  const clearDeptFilters = () => {
    setFilterCenter(null);
    setFilterGroup(null);
    setFilterSkill(null);
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
    memberCount = 0,
    currentMonth = new Date().getMonth() + 1,
    monthlySubmitted = 0,
    monthlySelected = 0,
    annualCertificationRate = null,
  } = data;
  const selectedTeam = teamsFiltered.find((t) => Number(t.id) === Number(selectedTeamId));

  const secondDepthLabelHint =
    secondDepthOptions.length > 0
      ? secondDepthOptions.map((o) => o.name).join(' · ')
      : '—';
  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="adm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">YOU프로 대시보드</h1>
            <p className="adm-sub">
              {year}년 기준 실별·
              구성원별 선정 실적을 확인하세요.
            </p>
          </div>
          <Link
            to="/admin/pending"
            className="adm-header-link adm-pending-btn--cute"
            aria-label="검토 대기 화면으로 이동"
          >
            <span className="adm-pending-shine" aria-hidden />
            <span className="adm-pending-btn__inner">
              <Clock size={18} strokeWidth={2.25} aria-hidden />
              <span className="adm-pending-btn__label">검토 대기</span>
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
              <strong>{secondDepthLabelHint}</strong> · {year}년 기준
            </p>
          </div>
        </div>
        <div className="adm-overview-shell">
          <div className="adm-overview-grid adm-overview-grid--four">
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
                현재 평가대상자
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-chart">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <BadgeCheck className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">연간 인증률</span>
              </div>
              <div
                className="adm-kpi-value-row"
                aria-label={
                  annualCertificationRate != null
                    ? `연간 인증률 ${annualCertificationRate}%`
                    : '연간 인증률 해당 없음'
                }
              >
                <span className="adm-kpi-val">
                  {annualCertificationRate != null ? annualCertificationRate.toFixed(1) : '—'}
                </span>
                <span className="adm-kpi-suffix">%</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                인증 인원 ÷ {year}년 1~{currentMonth}월 평가대상자 평균
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-files">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <FileText className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">{currentMonth}월 접수</span>
              </div>
              <div
                className="adm-kpi-value-row"
                aria-label={`${currentMonth}월 접수 ${monthlySubmitted}건`}
              >
                <span className="adm-kpi-val">{monthlySubmitted}</span>
                <span className="adm-kpi-suffix">건</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                {year}년 {currentMonth}월 · 사례 접수 건수
              </div>
            </div>
            <div className="adm-kpi-card adm-kpi-card--tone-award">
              <div className="adm-kpi-head">
                <span className="adm-kpi-icon-wrap" aria-hidden>
                  <Trophy className="adm-kpi-ico" size={18} strokeWidth={2.25} />
                </span>
                <span className="adm-kpi-title">{currentMonth}월 선정</span>
              </div>
              <div
                className="adm-kpi-value-row"
                aria-label={`${currentMonth}월 선정 ${monthlySelected}건`}
              >
                <span className="adm-kpi-val">{monthlySelected}</span>
                <span className="adm-kpi-suffix">건</span>
              </div>
              <div className="adm-kpi-unit">
                <span className="adm-kpi-unit-line" />
                {year}년 {currentMonth}월 · 선정 건수
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 누적 개인 랭킹 — tb_you_incentive_reflect 최신 월 cumulative_count (센터 구분 없이 1~15위) */}
      <section className="adm-section adm-section--ranking">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">랭킹</h2>
          </div>
        </div>
        <div className="adm-rank-compact">
          <div className="adm-rank-compact__head">
            <Trophy className="adm-rank-compact__ico" size={19} strokeWidth={2.25} aria-hidden />
            <span>
              누적 합계 <strong>{rankingData?.combined?.totalCumulative ?? 0}</strong>건
            </span>
          </div>
          {rankingRows.length === 0 ? (
            <p className="adm-rank-compact__empty">해당 범위 구성원이 없거나 반영 실적이 없습니다.</p>
          ) : (
            <div className="adm-rank-compact__grid-wrap">
              <div className="adm-rank-compact__grid">
                {RANK_BLOCKS.map((block) => (
                  <div key={block.id} className="adm-rank-compact__col">
                    <div className="adm-rank-compact__block-title">{block.title}</div>
                    <table className="adm-rank-compact__table">
                      <thead>
                        <tr>
                          <th scope="col" className="adm-rank-compact__th adm-rank-compact__th--rank">
                            순위
                          </th>
                          <th scope="col" className="adm-rank-compact__th">
                            이름
                          </th>
                          <th scope="col" className="adm-rank-compact__th">
                            소속
                          </th>
                          <th scope="col" className="adm-rank-compact__th adm-rank-compact__th--num">
                            누적
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          { length: block.endRank - block.startRank + 1 },
                          (_, i) => block.startRank + i
                        ).map((rank) => {
                          const row = rankingRows[rank - 1];
                          if (!row) {
                            return (
                              <tr key={`ph-${block.id}-${rank}`} className="adm-rank-compact__tr adm-rank-compact__tr--placeholder">
                                <td className="adm-rank-compact__td adm-rank-compact__td--rank">
                                  <span className="adm-rank-pill adm-rank-pill--rest">{rank}</span>
                                </td>
                                <td className="adm-rank-compact__td adm-rank-compact__td--placeholder" colSpan={3}>
                                  —
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={`r-${rank}-${row.id}`} className="adm-rank-compact__tr">
                              <td className="adm-rank-compact__td adm-rank-compact__td--rank">
                                <span
                                  className={`adm-rank-pill ${
                                    rank <= 3 ? `adm-rank-pill--${rank}` : 'adm-rank-pill--rest'
                                  }`}
                                >
                                  {rank}
                                </span>
                              </td>
                              <td className="adm-rank-compact__td adm-rank-compact__td--name">{row.name}</td>
                              <td className="adm-rank-compact__td adm-rank-compact__td--team">{row.teamName}</td>
                              <td className="adm-rank-compact__td adm-rank-compact__td--val">{row.value}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 실별 성과 테이블 */}
      <section className="adm-section">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 className="adm-section-heading">실별 성과</h2>
          </div>
        </div>
        {(filterCenter !== null || filterGroup !== null || filterSkill !== null) && (
          <div className="adm-dept-filter-bar" aria-label="적용 중인 필터">
            <span className="adm-dept-filter-bar__label">필터</span>
            {filterCenter !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterCenter(null)}
                aria-label={`센터 필터 해제: ${filterCenter === '' ? '없음' : filterCenter}`}
              >
                센터: {filterCenter === '' ? '없음' : filterCenter}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {filterGroup !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterGroup(null)}
                aria-label={`그룹 필터 해제: ${filterGroup === '' ? '없음' : filterGroup}`}
              >
                그룹: {filterGroup === '' ? '없음' : filterGroup}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {filterSkill !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterSkill(null)}
                aria-label={`스킬 필터 해제: ${filterSkill === '' ? '없음' : filterSkill}`}
              >
                스킬: {filterSkill === '' ? '없음' : filterSkill}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            <button type="button" className="adm-dept-filter-clear" onClick={clearDeptFilters}>
              전체 해제
            </button>
          </div>
        )}
        <div className="adm-table-wrap">
          <table className="adm-table adm-table--dept-performance">
            <thead>
              <tr>
                <SortTh
                  label="센터"
                  sortKey="centerName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="그룹"
                  sortKey="groupName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="스킬"
                  sortKey="skill"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="팀명"
                  sortKey="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="평가대상자"
                  sortKey="memberCount"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="인증자"
                  sortKey="certifiedEvalTargetCount"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="인증률"
                  sortKey="certificationRate"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="누적 인증 건수"
                  sortKey="reflectCumulativeTotal"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
                    {teamsEnriched.length === 0
                      ? 'leaf 팀이 없습니다. (부서 트리·depth 설정을 확인하세요)'
                      : '조건에 맞는 실이 없습니다. 필터를 해제하거나 다른 값을 선택해 보세요.'}
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
                      <button
                        type="button"
                        className={`adm-dept-filter-btn ${
                          filterCenter !== null && normFilterKey(team.centerName) === filterCenter
                            ? 'is-active'
                            : ''
                        }`}
                        onClick={(e) => handleCenterFilterClick(e, team)}
                        title="이 센터만 보기 (같은 값을 다시 클릭하면 해제)"
                      >
                        {team.centerName?.trim() ? team.centerName : '—'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`adm-dept-filter-btn ${
                          filterGroup !== null && normFilterKey(team.groupName) === filterGroup
                            ? 'is-active'
                            : ''
                        }`}
                        onClick={(e) => handleGroupFilterClick(e, team)}
                        title="이 그룹만 보기 (같은 값을 다시 클릭하면 해제)"
                      >
                        {team.groupName?.trim() ? team.groupName : '—'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`adm-dept-filter-btn ${
                          filterSkill !== null && normFilterKey(team.skill) === filterSkill
                            ? 'is-active'
                            : ''
                        }`}
                        onClick={(e) => handleSkillFilterClick(e, team)}
                        title="이 스킬만 보기 (같은 값을 다시 클릭하면 해제)"
                      >
                        {team.skill?.trim() ? team.skill : '—'}
                      </button>
                    </td>
                    <td>
                      <span className="adm-team-name">{team.name}</span>
                    </td>
                    <td>{Number(team.memberCount ?? 0)}명</td>
                    <td>{Number(team.certifiedEvalTargetCount ?? 0)}명</td>
                    <td>
                      {team.certificationRate != null
                        ? `${Number(team.certificationRate).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td>{Number(team.reflectCumulativeTotal ?? 0)}건</td>
                  </tr>
                ))
              )}
            </tbody>
            {sortedTeams.length > 0 && (
              <tfoot>
                <tr className="adm-table-total-row">
                  <td colSpan={4}>
                    <span className="adm-table-total-label">합계</span>
                    <span className="adm-table-total-sublabel">{sortedTeams.length}개 실</span>
                  </td>
                  <td>{teamTableTotals.evalTargetMemberSum}명</td>
                  <td>{teamTableTotals.certifiedEvalTargetSum}명</td>
                  <td>
                    {teamTableFooterCertRate != null
                      ? `${teamTableFooterCertRate.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td>{teamTableTotals.reflectCumulativeTotal}건</td>
                </tr>
              </tfoot>
            )}
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
                    {teamDetailData.team.name} · 평가대상자 {teamDetailData.members?.length ?? 0}명 · 카드를 누르면 사례
                    목록이 열려요
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
          teamDetailData.members?.length > 0 ? (
            <div className="adm-team-detail-embed member-cards-list">
              {teamDetailData.members.map((m) => (
                <AdminMemberDetailCard key={m.id} member={m} />
              ))}
            </div>
          ) : (
            <p className="adm-team-detail-empty">이 실에는 표시할 평가대상자가 없습니다.</p>
          )
        ) : null}
      </section>
    </div>
  );
}
