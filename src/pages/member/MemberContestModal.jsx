import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertCircle, ClipboardList, CheckCircle2, ArrowLeft } from 'lucide-react';
import { submitContestEntry, fetchMyContestEntries } from '../../api/memberApi';
import './MemberContestModal.css';

function parseDt(dt) {
  if (!dt) return null;
  if (Array.isArray(dt)) {
    const [y, mo, d, h = 0, mi = 0] = dt;
    return new Date(y, mo - 1, d, h, mi);
  }
  return new Date(String(dt).replace(' ', 'T'));
}

function formatDate(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function formatDatetime(d) {
  const dt = parseDt(d);
  if (!dt || isNaN(dt)) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/** yy.mm.dd HH:mm 포맷 (모달 헤더 기간 표시용) */
function formatDatetimeShort(d) {
  const dt = parseDt(d);
  if (!dt || isNaN(dt.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  return `${yy}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function formatSubmittedAt(d) {
  return formatDatetime(d);
}

/** yy-mm-dd 포맷 (참여 내역 목록용) */
function formatSubmittedAtShort(d) {
  const dt = parseDt(d);
  if (!dt || isNaN(dt.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  return `${yy}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const EMPTY_FORM = { consultDate: '', recordingTime: '', content: '' };

export default function MemberContestModal({ open, onClose, contest, skid }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null); // 상세 보기 대상

  const myEntriesQuery = useQuery({
    queryKey: ['my-contest-entries', skid],
    queryFn: () => fetchMyContestEntries(skid),
    enabled: open && !!skid,
  });

  const myEntries = myEntriesQuery.data?.entries ?? myEntriesQuery.data ?? [];
  const thisContestEntries = myEntries.filter(
    (e) => String(e.contestId) === String(contest?.id),
  );

  const submitMutation = useMutation({
    mutationFn: (body) => submitContestEntry(contest.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-contest-entries', skid] });
      setSubmitted(true);
      setForm(EMPTY_FORM);
      setFormErr('');
    },
    onError: (e) =>
      setFormErr(e?.response?.data?.message ?? e?.message ?? '접수 중 오류가 발생했습니다.'),
  });

  const handleChange = (field, value) => {
    let safeValue = value;
    if (field === 'consultDate' && value) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        safeValue = parts.join('-');
      }
    }
    setForm((prev) => ({ ...prev, [field]: safeValue }));
    setFormErr('');
    setSubmitted(false);
  };

  const handleConsultDateKeyDown = (e) => {
    const input = e.currentTarget;
    const val = input.value || '';
    const yearPart = val.split('-')[0] ?? '';
    if (
      yearPart.length >= 4 &&
      /^\d$/.test(e.key) &&
      input.selectionStart <= 3
    ) {
      e.preventDefault();
    }
  };

  const handleSubmit = () => {
    const { consultDate, recordingTime, content } = form;
    if (!consultDate) { setFormErr('상담날짜를 입력해 주세요.'); return; }
    if (!recordingTime) { setFormErr('녹취시간을 입력해 주세요.'); return; }
    if (!content.trim()) { setFormErr('내용을 입력해 주세요.'); return; }
    submitMutation.mutate({ skid, consultDate, recordingTime, content });
  };

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErr('');
      setSubmitted(false);
      setSelectedEntry(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open || !contest) return null;

  const isPending = submitMutation.isPending;

  return (
    <div className="mc-modal-backdrop" role="presentation">
      <section
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="콘테스트 참여"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="mc-modal-head">
          <div className="mc-modal-head-left">
            <h3 className="mc-modal-title">{contest.title}</h3>
          </div>
          <div className="mc-modal-head-right">
            <div className="mc-modal-period-block">
              <span className="mc-modal-period-label">참여 기간</span>
              <span className="mc-modal-period-range">
                {formatDatetimeShort(contest.startDate)}
                <span className="mc-modal-period-sep" aria-hidden> ~ </span>
                {formatDatetimeShort(contest.endDate)}
              </span>
            </div>
            <button
              type="button"
              className="mc-modal-close"
              onClick={onClose}
              aria-label="닫기"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        {/* 바디 — 좌우 2패널 */}
        <div className="mc-modal-body">

          {/* ── 좌: 접수 폼 ── */}
          <div className="mc-panel mc-panel--form">
            <div className="mc-panel-head">
              <span className="mc-panel-title">접수 양식</span>
            </div>

            <div className="mc-panel-body">
              <div className="mc-notice">
                <AlertCircle size={13} strokeWidth={2.25} aria-hidden />
                고객정보 기재하지 마세요.
              </div>

              <div className="mc-form-section">
                <div className="mc-form-row">
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="mc-consult-date">
                      상담날짜 <span className="mc-form-required">*</span>
                    </label>
                    <input
                      id="mc-consult-date"
                      type="date"
                      className="mc-form-input"
                      value={form.consultDate}
                      onChange={(e) => handleChange('consultDate', e.target.value)}
                      onKeyDown={handleConsultDateKeyDown}
                      max="9999-12-31"
                    />
                  </div>
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="mc-recording-time">
                      녹취시간 <span className="mc-form-required">*</span>
                    </label>
                    <input
                      id="mc-recording-time"
                      type="time"
                      className="mc-form-input"
                      value={form.recordingTime}
                      onChange={(e) => handleChange('recordingTime', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mc-form-divider" />

                <div className="mc-form-group mc-form-group--content">
                  <label className="mc-form-label" htmlFor="mc-content">
                    내용 <span className="mc-form-required">*</span>
                  </label>
                  <textarea
                    id="mc-content"
                    className="mc-form-textarea"
                    placeholder={contest.content || '접수 내용을 입력하세요'}
                    value={form.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                    rows={6}
                    maxLength={2000}
                  />
                  <span className="mc-form-char-count">{form.content.length} / 2000</span>
                </div>

                {formErr && <p className="mc-form-err">{formErr}</p>}
                {submitted && (
                  <div className="mc-form-ok">
                    <CheckCircle2 size={14} strokeWidth={2.25} aria-hidden />
                    접수가 완료되었습니다.
                  </div>
                )}

                <div className="mc-form-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mc-submit-btn"
                    onClick={handleSubmit}
                    disabled={isPending}
                  >
                    {isPending ? '접수 중…' : '참여 접수'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 우: 참여 내역 / 상세 보기 ── */}
          <div className="mc-panel mc-panel--list">

            {/* 상세 보기 */}
            {selectedEntry ? (
              <>
                <div className="mc-panel-head">
                  <button
                    type="button"
                    className="mc-detail-back"
                    onClick={() => setSelectedEntry(null)}
                    aria-label="목록으로 돌아가기"
                  >
                    <ArrowLeft size={14} strokeWidth={2.5} aria-hidden />
                    목록으로
                  </button>
                  <span className="mc-panel-count">접수 상세</span>
                </div>
                <div className="mc-panel-body">
                  <div className="mc-detail-card">
                    <dl className="mc-detail-dl">
                      <div className="mc-detail-row">
                        <dt className="mc-detail-dt">접수일시</dt>
                        <dd className="mc-detail-dd">
                          {formatSubmittedAt(selectedEntry.submittedAt ?? selectedEntry.createdAt)}
                        </dd>
                      </div>
                      <div className="mc-detail-row">
                        <dt className="mc-detail-dt">상담날짜</dt>
                        <dd className="mc-detail-dd">{formatDate(selectedEntry.consultDate)}</dd>
                      </div>
                      <div className="mc-detail-row">
                        <dt className="mc-detail-dt">녹취시간</dt>
                        <dd className="mc-detail-dd">{selectedEntry.recordingTime ?? '—'}</dd>
                      </div>
                    </dl>
                    <div className="mc-detail-content-wrap">
                      <p className="mc-detail-content-label">접수 내용</p>
                      <div className="mc-detail-content-body">
                        {selectedEntry.content}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* 리스트 뷰 */
              <>
                <div className="mc-panel-head">
                  <span className="mc-panel-title">참여 내역</span>
                  <span className="mc-panel-count">{thisContestEntries.length}건</span>
                </div>

                <div className="mc-panel-body">
                  {myEntriesQuery.isLoading ? (
                    <div className="mc-list-loading">
                      <div className="spinner spinner--sm" />
                      <span>불러오는 중…</span>
                    </div>
                  ) : thisContestEntries.length === 0 ? (
                    <div className="mc-list-empty">
                      <ClipboardList size={28} strokeWidth={1.4} className="mc-list-empty-icon" />
                      <p>아직 접수 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="mc-list-table-wrap">
                      <table className="mc-list-table">
                        <thead>
                          <tr>
                            <th className="mc-list-th">상담날짜</th>
                            <th className="mc-list-th">녹취시간</th>
                            <th className="mc-list-th mc-list-th--content">내용</th>
                            <th className="mc-list-th">접수일시</th>
                          </tr>
                        </thead>
                        <tbody>
                          {thisContestEntries.map((entry) => (
                            <tr
                              key={entry.id}
                              className="mc-list-tr mc-list-tr--clickable"
                              onClick={() => setSelectedEntry(entry)}
                              title="클릭하여 상세 보기"
                            >
                              <td className="mc-list-td mc-list-td--date">
                                {formatDate(entry.consultDate)}
                              </td>
                              <td className="mc-list-td mc-list-td--time">
                                {entry.recordingTime ?? '—'}
                              </td>
                              <td className="mc-list-td mc-list-td--content">
                                {entry.content}
                              </td>
                              <td className="mc-list-td mc-list-td--dt">
                                {formatSubmittedAtShort(entry.submittedAt ?? entry.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
