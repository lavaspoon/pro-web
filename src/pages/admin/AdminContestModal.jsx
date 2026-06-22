import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Pencil, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchAdminContests,
  createAdminContest,
  updateAdminContest,
  downloadContestEntriesExport,
} from '../../api/adminApi';
import './AdminContestModal.css';

/**
 * 백엔드 LocalDateTime 응답(ISO 문자열 또는 배열) → Date 객체
 * Jackson 기본: [2026,6,22,9,0,0] / @JsonFormat 지정: "2026-06-22T09:00:00"
 */
function parseDt(dt) {
  if (!dt) return null;
  if (Array.isArray(dt)) {
    const [y, mo, d, h = 0, mi = 0] = dt;
    return new Date(y, mo - 1, d, h, mi);
  }
  return new Date(String(dt).replace(' ', 'T'));
}

/** 표시용: "2026-06-22 09:00" */
function formatDatetime(dt) {
  const d = parseDt(dt);
  if (!d || isNaN(d)) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local input 값 형식 "yyyy-MM-ddTHH:mm" */
function toDatetimeLocal(dt) {
  const d = parseDt(dt);
  if (!d || isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local input 값 → API 전송용 ISO 문자열 "yyyy-MM-ddTHH:mm:ss" */
function toApiDatetime(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (s.length === 16) return `${s}:00`;
  if (s.length >= 19) return s.slice(0, 19);
  return s;
}

/** datetime-local 연도 4자리 초과 방지 — 값 보정 */
function sanitizeDatetimeLocal(val) {
  if (!val) return val;
  const [datePart = '', timePart = ''] = val.split('T');
  const segments = datePart.split('-');
  if (segments[0] && segments[0].length > 4) {
    segments[0] = segments[0].slice(0, 4);
  }
  return segments.join('-') + (timePart ? `T${timePart}` : '');
}

/**
 * datetime-local onInput 핸들러 — 매 입력마다 DOM 값을 직접 보정.
 * selectionStart가 null을 반환하는 datetime-local 특성상 onKeyDown으로는
 * 연도 영역을 구분할 수 없으므로 onInput에서 교정한다.
 */
function handleDatetimeLocalInput(e) {
  const input = e.currentTarget;
  const sanitized = sanitizeDatetimeLocal(input.value);
  if (sanitized !== input.value) {
    input.value = sanitized;
  }
}

function isContestActive(contest) {
  const start = parseDt(contest?.startDate);
  const end = parseDt(contest?.endDate);
  if (!start || !end) return false;
  const now = new Date();
  return start <= now && now <= end;
}

function isContestUpcoming(contest) {
  const start = parseDt(contest?.startDate);
  if (!start) return false;
  return start > new Date();
}

const EMPTY_FORM = { title: '', content: '', startDate: '', endDate: '' };
const PAGE_SIZE = 5;

export default function AdminContestModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingContest, setEditingContest] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [page, setPage] = useState(1);

  const contestsQuery = useQuery({
    queryKey: ['admin-contests'],
    queryFn: fetchAdminContests,
    enabled: open,
  });

  const contests = contestsQuery.data?.contests ?? contestsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(contests.length / PAGE_SIZE));
  const pagedContests = contests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: createAdminContest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contests'] });
      setView('list');
      setEditingContest(null);
      setForm(EMPTY_FORM);
      setFormErr('');
    },
    onError: (e) => setFormErr(e?.response?.data?.message ?? e?.message ?? '등록 중 오류가 발생했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateAdminContest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contests'] });
      setView('list');
      setEditingContest(null);
      setForm(EMPTY_FORM);
      setFormErr('');
    },
    onError: (e) => setFormErr(e?.response?.data?.message ?? e?.message ?? '수정 중 오류가 발생했습니다.'),
  });

  const handleOpenCreate = () => {
    setEditingContest(null);
    setForm(EMPTY_FORM);
    setFormErr('');
    setView('form');
  };

  const handleOpenEdit = useCallback((contest) => {
    setEditingContest(contest);
    setForm({
      title: contest.title ?? '',
      content: contest.content ?? '',
      startDate: toDatetimeLocal(contest.startDate),
      endDate: toDatetimeLocal(contest.endDate),
    });
    setFormErr('');
    setView('form');
  }, []);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErr('');
  };

  const handleSubmit = () => {
    const { title, content, startDate, endDate } = form;
    if (!title.trim()) { setFormErr('프로모션 주제를 입력해 주세요.'); return; }
    if (!startDate || !endDate) { setFormErr('프로모션 기간을 설정해 주세요.'); return; }
    if (startDate > endDate) { setFormErr('시작일이 종료일보다 늦을 수 없습니다.'); return; }
    if (!content.trim()) { setFormErr('내용을 입력해 주세요.'); return; }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      startDate: toApiDatetime(startDate),
      endDate: toApiDatetime(endDate),
    };

    if (editingContest) {
      updateMutation.mutate({ id: editingContest.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDownload = async (contest) => {
    if (downloadingId != null) return;
    setDownloadingId(contest.id);
    try {
      await downloadContestEntriesExport(contest.id, contest.title);
    } catch (e) {
      alert(e?.response?.data?.message ?? e?.message ?? '다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = () => {
    setView('list');
    setEditingContest(null);
    setForm(EMPTY_FORM);
    setFormErr('');
  };

  useEffect(() => {
    if (!open) {
      setView('list');
      setEditingContest(null);
      setForm(EMPTY_FORM);
      setFormErr('');
      setPage(1);
    }
  }, [open]);

  /* 목록이 바뀌면 페이지 범위 보정 */
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(contests.length / PAGE_SIZE))));
  }, [contests.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') e.stopPropagation(); };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="contest-modal-backdrop" role="presentation">
      <section
        className="contest-modal"
        role="dialog"
        aria-modal="true"
        aria-label="콘테스트 등록/수정"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="contest-modal-head">
          <div className="contest-modal-head-left">
            <h3 className="contest-modal-title">
              {view === 'list' ? '콘테스트 등록/수정' : (editingContest ? '콘테스트 수정' : '콘테스트 등록')}
            </h3>
          </div>
          <button
            type="button"
            className="contest-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {/* 바디 */}
        <div className="contest-modal-body">
          {view === 'list' ? (
            <>
              <div className="contest-list-toolbar">
                <button
                  type="button"
                  className="btn btn-primary btn-sm contest-add-btn"
                  onClick={handleOpenCreate}
                >
                  <Plus size={14} aria-hidden />
                  콘테스트 등록
                </button>
              </div>

              {contestsQuery.isLoading ? (
                <div className="contest-loading">
                  <div className="spinner" />
                  <p>불러오는 중…</p>
                </div>
              ) : contestsQuery.isError ? (
                <p className="contest-err">{contestsQuery.error?.message ?? '불러오지 못했습니다.'}</p>
              ) : contests.length === 0 ? (
                <div className="contest-empty">
                  <p>등록된 이벤트가 없습니다.</p>
                  <p className="contest-empty-sub">이벤트 등록 버튼을 눌러 첫 콘테스트를 만들어 보세요.</p>
                </div>
              ) : (
                <>
                  <div className="contest-table-wrap">
                    <table className="contest-table">
                      <thead>
                        <tr>
                          <th className="contest-th contest-th--status">상태</th>
                          <th className="contest-th contest-th--title">프로모션 주제</th>
                          <th className="contest-th contest-th--start">시작일</th>
                          <th className="contest-th contest-th--end">종료일</th>
                          <th className="contest-th contest-th--count">참여</th>
                          <th className="contest-th contest-th--excel">RAW 엑셀</th>
                          <th className="contest-th contest-th--edit">수정</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedContests.map((c) => {
                          const active = isContestActive(c);
                          const upcoming = isContestUpcoming(c);
                          return (
                            <tr key={c.id} className={`contest-tr${active ? ' contest-tr--active' : ''}`}>
                              <td className="contest-td contest-td--status">
                                {active ? (
                                  <span className="contest-status-chip contest-status-chip--active">진행 중</span>
                                ) : upcoming ? (
                                  <span className="contest-status-chip contest-status-chip--upcoming">대기</span>
                                ) : (
                                  <span className="contest-status-chip contest-status-chip--ended">완료</span>
                                )}
                              </td>
                              <td className="contest-td contest-td--title">
                                <span className="contest-td-title-text" title={c.title}>{c.title}</span>
                              </td>
                              <td className="contest-td contest-td--period">
                                {(() => {
                                  const s = formatDatetime(c.startDate).split(' ');
                                  return (
                                    <>
                                      <span className="contest-td-period-date">{s[0] ?? '—'}</span>
                                      <span className="contest-td-period-time">{s[1] ?? ''}</span>
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="contest-td contest-td--period">
                                {(() => {
                                  const s = formatDatetime(c.endDate).split(' ');
                                  return (
                                    <>
                                      <span className="contest-td-period-date">{s[0] ?? '—'}</span>
                                      <span className="contest-td-period-time">{s[1] ?? ''}</span>
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="contest-td contest-td--count">
                                <strong className="contest-td-count-num">{Number(c.entryCount ?? 0)}</strong>
                                <span className="contest-td-count-unit">건</span>
                              </td>
                              <td className="contest-td contest-td--excel">
                                <button
                                  type="button"
                                  className="contest-action-btn contest-action-btn--excel"
                                  onClick={() => handleDownload(c)}
                                  disabled={downloadingId === c.id}
                                  aria-label="RAW 엑셀 다운로드"
                                >
                                  <Download size={12} strokeWidth={2} aria-hidden />
                                  {downloadingId === c.id ? '처리 중…' : 'RAW 엑셀'}
                                </button>
                              </td>
                              <td className="contest-td contest-td--edit">
                                <button
                                  type="button"
                                  className="contest-action-btn contest-action-btn--edit"
                                  onClick={() => handleOpenEdit(c)}
                                  aria-label="수정"
                                >
                                  <Pencil size={12} strokeWidth={2} aria-hidden />
                                  수정
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이징 */}
                  {totalPages > 1 && (
                    <div className="contest-pagination">
                      <button
                        type="button"
                        className="contest-page-btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        aria-label="이전 페이지"
                      >
                        <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
                      </button>
                      <span className="contest-page-label">{page} / {totalPages}</span>
                      <button
                        type="button"
                        className="contest-page-btn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        aria-label="다음 페이지"
                      >
                        <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="contest-form">
              <div className="contest-form-group">
                <label className="contest-form-label" htmlFor="cf-title">
                  프로모션 주제 <span className="contest-form-required">*</span>
                </label>
                <input
                  id="cf-title"
                  type="text"
                  className="contest-form-input"
                  placeholder="이벤트 주제를 입력하세요"
                  value={form.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="contest-form-group">
                <span className="contest-form-label">
                  프로모션 기간 <span className="contest-form-required">*</span>
                </span>
                <div className="contest-form-period-grid">
                  <div className="contest-form-period-field">
                    <span className="contest-form-period-label">시작</span>
                    <input
                      type="datetime-local"
                      className="contest-form-input contest-form-input--datetime"
                      value={form.startDate}
                      max="9999-12-31T23:59"
                      onChange={(e) => handleFormChange('startDate', sanitizeDatetimeLocal(e.target.value))}
                      onInput={handleDatetimeLocalInput}
                      aria-label="시작일시"
                    />
                  </div>
                  <div className="contest-form-period-field">
                    <span className="contest-form-period-label">종료</span>
                    <input
                      type="datetime-local"
                      className="contest-form-input contest-form-input--datetime"
                      value={form.endDate}
                      max="9999-12-31T23:59"
                      onChange={(e) => handleFormChange('endDate', sanitizeDatetimeLocal(e.target.value))}
                      onInput={handleDatetimeLocalInput}
                      aria-label="종료일시"
                    />
                  </div>
                </div>
              </div>

              <div className="contest-form-group">
                <label className="contest-form-label" htmlFor="cf-content">
                  내용 <span className="contest-form-required">*</span>
                </label>
                <textarea
                  id="cf-content"
                  className="contest-form-textarea"
                  placeholder="구성원에게 안내할 이벤트 내용을 입력하세요 (접수 시 placeholder로 표시됩니다)"
                  value={form.content}
                  onChange={(e) => handleFormChange('content', e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
                <span className="contest-form-char-count">{form.content.length} / 2000</span>
              </div>

              {formErr && <p className="contest-form-err">{formErr}</p>}

              <div className="contest-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancel}
                  disabled={isMutating}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={isMutating}
                >
                  {isMutating ? '처리 중…' : (editingContest ? '수정 완료' : '콘테스트 등록')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
