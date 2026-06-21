import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Pencil, Download, Trophy } from 'lucide-react';
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
    // [year, month, day, hour, minute, second?, nano?]
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
  if (s.length === 16) return `${s}:00`;   // "yyyy-MM-ddTHH:mm" → 초 보충
  if (s.length >= 19) return s.slice(0, 19); // 초 이상 이미 있으면 자름
  return s;
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

export default function AdminContestModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingContest, setEditingContest] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const contestsQuery = useQuery({
    queryKey: ['admin-contests'],
    queryFn: fetchAdminContests,
    enabled: open,
  });

  const contests = contestsQuery.data?.contests ?? contestsQuery.data ?? [];

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
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="contest-modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="contest-modal"
        role="dialog"
        aria-modal="true"
        aria-label="콘테스트 관리"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="contest-modal-head">
          <div className="contest-modal-head-left">
            <Trophy size={16} strokeWidth={2.25} className="contest-modal-head-icon" aria-hidden />
            <h3 className="contest-modal-title">
              {view === 'list' ? '콘테스트 이벤트 관리' : (editingContest ? '이벤트 수정' : '이벤트 등록')}
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
                  이벤트 등록
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
                  <Trophy size={32} strokeWidth={1.4} className="contest-empty-icon" />
                  <p>등록된 이벤트가 없습니다.</p>
                  <p className="contest-empty-sub">이벤트 등록 버튼을 눌러 첫 콘테스트를 만들어 보세요.</p>
                </div>
              ) : (
                <div className="contest-table-wrap">
                  <table className="contest-table">
                    <thead>
                      <tr>
                        <th className="contest-th contest-th--status">상태</th>
                        <th className="contest-th contest-th--title">프로모션 주제</th>
                        <th className="contest-th contest-th--start">시작일</th>
                        <th className="contest-th contest-th--end">종료일</th>
                        <th className="contest-th contest-th--count">참여</th>
                        <th className="contest-th contest-th--actions">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contests.map((c) => {
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
                                return <>
                                  <span className="contest-td-period-date">{s[0] ?? '—'}</span>
                                  <span className="contest-td-period-time">{s[1] ?? ''}</span>
                                </>;
                              })()}
                            </td>
                            <td className="contest-td contest-td--period">
                              {(() => {
                                const s = formatDatetime(c.endDate).split(' ');
                                return <>
                                  <span className="contest-td-period-date">{s[0] ?? '—'}</span>
                                  <span className="contest-td-period-time">{s[1] ?? ''}</span>
                                </>;
                              })()}
                            </td>
                            <td className="contest-td contest-td--count">
                              <strong className="contest-td-count-num">{Number(c.entryCount ?? 0)}</strong>
                              <span className="contest-td-count-unit">건</span>
                            </td>
                            <td className="contest-td contest-td--actions">
                              <button
                                type="button"
                                className="contest-icon-btn"
                                onClick={() => handleOpenEdit(c)}
                                title="수정"
                                aria-label="수정"
                              >
                                <Pencil size={13} strokeWidth={2} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="contest-icon-btn contest-icon-btn--dl"
                                onClick={() => handleDownload(c)}
                                disabled={downloadingId === c.id}
                                title="접수 내역 엑셀 다운로드"
                                aria-label="엑셀 다운로드"
                              >
                                <Download size={13} strokeWidth={2} aria-hidden />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                      onChange={(e) => handleFormChange('startDate', e.target.value)}
                      aria-label="시작일시"
                    />
                  </div>
                  <div className="contest-form-period-field">
                    <span className="contest-form-period-label">종료</span>
                    <input
                      type="datetime-local"
                      className="contest-form-input contest-form-input--datetime"
                      value={form.endDate}
                      onChange={(e) => handleFormChange('endDate', e.target.value)}
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
                  {isMutating ? '처리 중…' : (editingContest ? '수정 완료' : '등록')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
