import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useViewAsStore from '../../store/viewAsStore';
import { fetchMemberSatisfaction } from '../../api/memberApi';
import { fetchCsSatisfactionMemberMonthlyRows } from '../../api/adminApi';
import CsSatisfactionModalDayStats from '../cs/CsSatisfactionModalDayStats';
import { problemResolvedNegRateClass, problemResolvedNegRateText } from '../../utils/caseDisplay';
import '../../pages/admin/AdminSatisfactionPage.css';

const PAGE_SIZE = 10;

function toNum(v, fallback = null) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return String(dt).replace('T', ' ');
}

function dateKeyFromDateTime(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 10);
}

function yesNo(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'Y';
  if (s === 'N') return 'N';
  return '—';
}

function ynClass(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'is-yes';
  if (s === 'N') return 'is-no';
  return 'is-na';
}

function buildUnsatTypeLabelMap(data) {
  const raw = Array.isArray(data?.unsatisfiedCategories) ? data.unsatisfiedCategories : [];
  const map = new Map();
  raw.forEach((c) => {
    const code = toNum(c?.dissatisfactionType);
    if (code == null) return;
    const label = String(c?.label ?? '').trim() || `유형 ${code}`;
    map.set(code, label);
  });
  return map;
}

function unsatTypeLabel(map, rawType) {
  const code = toNum(rawType);
  if (code == null || code < 1 || code > 5) return null;
  return map.get(code) ?? `유형 ${code}`;
}

function formatKoDateRange(start, end) {
  if (!start && !end) return '최근 상담 구간';
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return end || start || '—';
}

function flattenMemberRows(memberRowsData) {
  const months = memberRowsData?.months ?? [];
  return months.flatMap((m) => m.rows ?? []);
}

function isInMentWindow(row, windowStart, windowEnd) {
  const day = dateKeyFromDateTime(row?.consultDateTime);
  if (!day) return !windowStart && !windowEnd;
  if (windowStart && day < windowStart) return false;
  if (windowEnd && day > windowEnd) return false;
  return true;
}

function matchesMent(row, mentText, mentSource) {
  const field = mentSource === 'bad' ? row?.badMent : row?.goodMent;
  return String(field ?? '').trim() === String(mentText ?? '').trim();
}

export default function MemberCsMentDetailModal({
  open,
  onClose,
  mentText,
  mentSource = 'good',
  windowStart = null,
  windowEnd = null,
  year,
  month,
}) {
  const { user } = useAuthStore();
  const { viewAsSkid } = useViewAsStore();
  const effectiveSkid = viewAsSkid || user?.skid;
  const [page, setPage] = useState(1);

  const satQuery = useQuery({
    queryKey: ['member-satisfaction', effectiveSkid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: effectiveSkid, year, month }),
    enabled: open && !!effectiveSkid,
    staleTime: 60_000,
  });

  const memberRowsQuery = useQuery({
    queryKey: ['member-sat-rows', effectiveSkid, year],
    queryFn: () => fetchCsSatisfactionMemberMonthlyRows(effectiveSkid, year),
    enabled: open && !!effectiveSkid && !!satQuery.data && !satQuery.isError,
    staleTime: 60_000,
  });

  const unsatTypeLabelMap = useMemo(
    () => buildUnsatTypeLabelMap(satQuery.data),
    [satQuery.data],
  );

  const matchingRows = useMemo(() => {
    const allRows = flattenMemberRows(memberRowsQuery.data);
    return allRows
      .filter((row) => String(row?.useYn ?? '').trim().toUpperCase() === 'Y')
      .filter((row) => isInMentWindow(row, windowStart, windowEnd))
      .filter((row) => matchesMent(row, mentText, mentSource))
      .sort((a, b) => String(b.consultDateTime ?? '').localeCompare(String(a.consultDateTime ?? ''), 'ko'));
  }, [memberRowsQuery.data, windowStart, windowEnd, mentText, mentSource]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(matchingRows.length / PAGE_SIZE)),
    [matchingRows],
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return matchingRows.slice(start, start + PAGE_SIZE);
  }, [matchingRows, page]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    setPage(1);
  }, [mentText, mentSource, windowStart, windowEnd]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  if (!open) return null;

  const personalTargetPercent = satQuery.data?.monthlyTargetPct ?? satQuery.data?.target ?? null;
  const isLoading = satQuery.isLoading || memberRowsQuery.isLoading;
  const isError = satQuery.isError || memberRowsQuery.isError;
  const errorMessage = satQuery.error?.message ?? memberRowsQuery.error?.message;

  return (
    <div
      className="adm-sat-row-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="adm-sat-row-modal"
        role="dialog"
        aria-modal="true"
        aria-label="실시간 고객 만족 상세"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="adm-sat-row-modal-head">
          <div>
            <h3 className="adm-sat-row-modal-title">실시간 고객 만족</h3>
            <p className="adm-sat-row-modal-sub">
              {formatKoDateRange(windowStart, windowEnd)} · {mentSource === 'bad' ? '고객 제안' : 'Good 멘트'}
            </p>
          </div>
          <button
            type="button"
            className="adm-sat-row-modal-close"
            onClick={onClose}
            aria-label="모달 닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="adm-sat-row-modal-body">
          <blockquote className="member-cs-ment-modal-quote">
            <span className="member-cs-ment-modal-quote-label">고객 멘트</span>
            <p>{mentText}</p>
          </blockquote>

          {isLoading ? (
            <div className="adm-team-detail-loading">
              <div className="spinner" />
              <p>상담 내역을 불러오는 중…</p>
            </div>
          ) : isError ? (
            <p className="adm-team-detail-error">
              {errorMessage ?? '상담 내역을 불러오지 못했습니다.'}
            </p>
          ) : matchingRows.length === 0 ? (
            <p className="adm-sat-query-empty">해당 멘트와 일치하는 상담 내역이 없습니다.</p>
          ) : (
            <div className="adm-sat-member-month-bucket">
              <CsSatisfactionModalDayStats
                rows={matchingRows}
                personalTargetPercent={personalTargetPercent}
              />
              <div className="adm-table-wrap adm-sat-modal-table-wrap">
                <table className="adm-table adm-sat-modal-rows-table">
                  <thead>
                    <tr>
                      <th><span className="adm-sat-modal-th-wrap">상담일시</span></th>
                      <th><span className="adm-sat-modal-th-wrap">상담유형</span></th>
                      <th><span className="adm-sat-modal-th-wrap">만족</span></th>
                      <th><span className="adm-sat-modal-th-wrap">5대도시</span></th>
                      <th><span className="adm-sat-modal-th-wrap">5060</span></th>
                      <th><span className="adm-sat-modal-th-wrap">문제해결 부정비율</span></th>
                      <th><span className="adm-sat-modal-th-wrap">Good 멘트</span></th>
                      <th><span className="adm-sat-modal-th-wrap">불만족 유형</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr key={row.id}>
                        <td className="adm-sat-modal-cell-dt">{formatDateTime(row.consultDateTime)}</td>
                        <td className="adm-sat-modal-cell-type">
                          {[row.consultType1, row.consultType2, row.consultType3]
                            .filter((v) => String(v ?? '').trim() !== '')
                            .join(' / ') || '—'}
                        </td>
                        <td><span className={`adm-sat-yn-chip ${ynClass(row.satisfiedYn)}`}>{yesNo(row.satisfiedYn)}</span></td>
                        <td><span className={`adm-sat-yn-chip ${ynClass(row.fiveMajorCitiesYn)}`}>{yesNo(row.fiveMajorCitiesYn)}</span></td>
                        <td><span className={`adm-sat-yn-chip ${ynClass(row.gen5060Yn)}`}>{yesNo(row.gen5060Yn)}</span></td>
                        <td>
                          <span className={problemResolvedNegRateClass(row.problemResolvedYn)}>
                            {problemResolvedNegRateText(row.problemResolvedYn)}
                          </span>
                        </td>
                        <td className="adm-sat-modal-cell-ment">{row.goodMent?.trim() ? row.goodMent : '—'}</td>
                        <td className="adm-sat-modal-cell-untype">
                          {String(row.satisfiedYn ?? '').trim().toUpperCase() === 'N'
                            ? (() => {
                                const label = unsatTypeLabel(unsatTypeLabelMap, row.dissatisfactionType);
                                return label
                                  ? <span className="adm-sat-untype-chip">{label}</span>
                                  : '—';
                              })()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {matchingRows.length > PAGE_SIZE ? (
                <div className="adm-sat-modal-pagination">
                  <button
                    type="button"
                    className="adm-sat-modal-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    이전
                  </button>
                  <span className="adm-sat-modal-page-label">{page} / {totalPages}</span>
                  <button
                    type="button"
                    className="adm-sat-modal-page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    다음
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
