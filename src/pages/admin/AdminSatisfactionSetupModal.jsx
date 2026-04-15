import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Lock, Upload, X } from 'lucide-react';
import {
  fetchCsSatisfactionTargetsUnified,
  saveCsSatisfactionTargetsUnified,
  uploadCsSatisfactionExcel,
} from '../../api/adminApi';
import './DashboardPage.css';
import './PendingCasesPage.css';
import './AdminSatisfactionSetupPage.css';

function localYearMonth() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
}

function parseYearMonth(ym) {
  const parts = String(ym).split('-');
  return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
}

function formatYearMonthLabel(ym) {
  const { year, month } = parseYearMonth(ym);
  if (!year || !month) return ym;
  return `${year}년 ${month}월`;
}

/**
 * 목표 설정 · 만족도 엑셀 업로드 (모달)
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {'targets' | 'upload'} [initialTab] — 기본: 만족도업로드
 */
export default function AdminSatisfactionSetupModal({ open, onClose, initialTab = 'upload' }) {
  const fileRef = useRef(null);
  const queryClient = useQueryClient();
  const [targetMonthStr, setTargetMonthStr] = useState(localYearMonth);
  const [pickedName, setPickedName] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab);

  const [deptInputs, setDeptInputs] = useState({});
  const [skillInputs, setSkillInputs] = useState({});
  const [annualInputs, setAnnualInputs] = useState({});

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const targetsQuery = useQuery({
    queryKey: ['cs-satisfaction-targets-unified', targetMonthStr],
    queryFn: () => {
      const { year, month } = parseYearMonth(targetMonthStr);
      return fetchCsSatisfactionTargetsUnified(year, month);
    },
    enabled: open,
  });

  useEffect(() => {
    const data = targetsQuery.data;
    if (!data) return;

    const nextDept = {};
    (data.deptTargets || []).forEach((d) => {
      nextDept[d.deptId] = d.targetPercent != null ? String(Number(d.targetPercent)) : '';
    });
    setDeptInputs(nextDept);

    const nextSkill = {};
    (data.skillTargets || []).forEach((s) => {
      nextSkill[s.skillName] = s.targetPercent != null ? String(Number(s.targetPercent)) : '';
    });
    setSkillInputs(nextSkill);

    const nextAnnual = {};
    (data.annualTargets || []).forEach((a) => {
      nextAnnual[a.taskCode] = a.targetPercent != null ? String(Number(a.targetPercent)) : '';
    });
    setAnnualInputs(nextAnnual);
  }, [targetsQuery.data]);

  const saveTargetsMutation = useMutation({
    mutationFn: (body) => saveCsSatisfactionTargetsUnified(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-targets-unified'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-monthly-overview'] });
    },
  });

  useEffect(() => {
    if (!open) {
      saveTargetsMutation.reset();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    saveTargetsMutation.reset();
  }, [targetMonthStr]);

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadCsSatisfactionExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-center-month-detail'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-monthly-overview'] });
      setPickedName('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const data = targetsQuery.data;
  const targetsReady = data?.allTargetsSet === true;

  const deptTargets = data?.deptTargets || [];
  const deptValid =
    deptTargets.length > 0 &&
    deptTargets.every((d) => {
      const raw = deptInputs[d.deptId];
      if (!raw) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    });

  const skillTargets = data?.skillTargets || [];
  const skillValid =
    skillTargets.length > 0 &&
    skillTargets.every((s) => {
      const raw = skillInputs[s.skillName];
      if (!raw) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    });

  const annualTargets = data?.annualTargets || [];
  const annualValid =
    annualTargets.length > 0 &&
    annualTargets.every((a) => {
      const raw = annualInputs[a.taskCode];
      if (!raw) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    });

  const allTargetsValid = deptValid && skillValid && annualValid;

  const onSaveTargets = () => {
    if (!allTargetsValid) return;
    const { year, month } = parseYearMonth(targetMonthStr);
    const payload = {
      year,
      month,
      deptTargets: deptTargets.map((d) => ({
        deptId: d.deptId,
        targetPercent: Number(deptInputs[d.deptId]),
      })),
      skillTargets: skillTargets.map((s) => ({
        skillName: s.skillName,
        targetPercent: Number(skillInputs[s.skillName]),
      })),
      annualTargets: annualTargets.map((a) => ({
        taskCode: a.taskCode,
        targetPercent: Number(annualInputs[a.taskCode]),
      })),
    };
    saveTargetsMutation.mutate(payload);
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    setPickedName(f ? f.name : '');
  };

  const onUpload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f || !targetsReady) return;
    uploadMutation.mutate(f);
  };

  if (!open) return null;

  return (
    <div
      className="sat-setup-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sat-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sat-setup-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sat-setup-modal-header">
          <div className="sat-setup-modal-header-text">
            <h2 id="sat-setup-modal-title" className="sat-setup-modal-title">
              목표 · 엑셀 반영
            </h2>
            <p className="sat-setup-modal-lead">
              {activeTab === 'upload'
                ? '엑셀 파일을 올려 만족도 데이터를 반영합니다. (목표를 먼저 저장해야 업로드할 수 있어요)'
                : '총 9개 항목에 목표 %를 입력하고 저장하세요. 월간 6개 · 연간 3개입니다.'}
            </p>
          </div>
          <button
            type="button"
            className="sat-setup-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={22} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="sat-setup-modal-body">
          <div className="sat-setup-shell sat-setup-shell--modal">
            <div className="sat-setup-ribbon">
              <div className="sat-setup-ribbon-inner">
                <span className="sat-setup-ribbon-badge" aria-hidden>
                  <Calendar size={15} strokeWidth={2.2} />
                </span>
                <div className="sat-setup-ribbon-text">
                  <span className="sat-setup-ribbon-kicker">적용 기준</span>
                  <span className="sat-setup-ribbon-title">{formatYearMonthLabel(targetMonthStr)}</span>
                </div>
                <label className="sat-setup-ribbon-month">
                  <span className="visually-hidden">연·월 변경</span>
                  <input
                    type="month"
                    value={targetMonthStr}
                    onChange={(e) => setTargetMonthStr(e.target.value)}
                    aria-label="목표 및 업로드에 적용할 연도와 월"
                  />
                </label>
              </div>
            </div>

            <div className="sat-setup-modal-tabs" role="tablist" aria-label="목표 및 업로드 구분">
              <button
                type="button"
                role="tab"
                id="sat-tab-upload"
                aria-selected={activeTab === 'upload'}
                aria-controls="sat-panel-upload"
                className={`sat-setup-modal-tab ${activeTab === 'upload' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                만족도업로드
              </button>
              <button
                type="button"
                role="tab"
                id="sat-tab-targets"
                aria-selected={activeTab === 'targets'}
                aria-controls="sat-panel-targets"
                className={`sat-setup-modal-tab ${activeTab === 'targets' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('targets')}
              >
                목표설정
              </button>
            </div>

            <div
              id="sat-panel-upload"
              role="tabpanel"
              aria-labelledby="sat-tab-upload"
              hidden={activeTab !== 'upload'}
              className="sat-setup-modal-panel"
            >
              <section className="sat-setup-pane sat-setup-pane--upload sat-setup-pane--modal" aria-labelledby="sat-setup-upload-title">
                <div className="sat-setup-pane-head sat-setup-pane-head--minimal">
                  <div>
                    <h3 id="sat-setup-upload-title" className="sat-setup-pane-title">
                      엑셀 업로드
                    </h3>
                    <p className="sat-setup-pane-sub">같은 연·월 기준으로 파일을 반영합니다.</p>
                  </div>
                </div>
                <div className="sat-setup-pane-body sat-setup-pane-body--upload">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sat-setup-file-input"
                    onChange={onPickFile}
                    aria-label="만족도 엑셀 파일"
                    disabled={!targetsReady}
                  />

                  {!targetsReady ? (
                    <div className="sat-setup-drop sat-setup-drop--locked" role="status">
                      <Lock size={20} strokeWidth={2.1} className="sat-setup-drop-lock-ico" aria-hidden />
                      <p className="sat-setup-drop-locked-text">
                        「목표설정」에서 9개 항목을 모두 입력한 뒤 저장하면 업로드할 수 있어요.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sat-setup-drop sat-setup-drop--active"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={22} strokeWidth={2.1} className="sat-setup-drop-ico" aria-hidden />
                      <span className="sat-setup-drop-title">파일 선택</span>
                      <span className="sat-setup-drop-hint">.xlsx</span>
                    </button>
                  )}

                  <div className="sat-setup-upload-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm sat-setup-btn-primary"
                      disabled={!targetsReady || !pickedName || uploadMutation.isPending}
                      onClick={onUpload}
                    >
                      {uploadMutation.isPending ? '업로드 중…' : '업로드 실행'}
                    </button>
                  </div>

                  {pickedName && targetsReady ? (
                    <p className="sat-setup-picked">
                      <span className="sat-setup-picked-label">선택됨</span>
                      {pickedName}
                    </p>
                  ) : null}
                  {uploadMutation.isError ? (
                    <p className="pending-inline-error sat-setup-inline-msg">{uploadMutation.error?.message}</p>
                  ) : null}
                  {uploadMutation.isSuccess ? (
                    <p className="sat-setup-ok sat-setup-inline-msg">
                      반영 {uploadMutation.data?.inserted ?? 0} · 스킵 {uploadMutation.data?.skipped ?? 0}
                      {(uploadMutation.data?.warnings?.length ?? 0) > 0
                        ? ` · 경고 ${uploadMutation.data.warnings.length}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <div
              id="sat-panel-targets"
              role="tabpanel"
              aria-labelledby="sat-tab-targets"
              hidden={activeTab !== 'targets'}
              className="sat-setup-modal-panel"
            >
              <section className="sat-setup-pane sat-setup-pane--targets sat-setup-pane--modal" aria-labelledby="sat-setup-targets-title">
                <div className="sat-setup-pane-head sat-setup-pane-head--minimal">
                  <div>
                    <h3 id="sat-setup-targets-title" className="sat-setup-pane-title">
                      목표 입력
                    </h3>
                    <p className="sat-setup-pane-sub sat-compact-intro">
                      위에서 선택한 <strong>월</strong>에 적용되는 항목은 <em>월간 6개</em>, <strong>연도</strong> 기준은{' '}
                      <em>연간 3개</em>입니다. 모두 0~100%로 채운 뒤 저장하세요.
                    </p>
                  </div>
                </div>
                <div className="sat-setup-pane-body sat-setup-pane-body--compact">
                  {targetsQuery.isLoading ? (
                    <p className="sat-setup-muted">불러오는 중…</p>
                  ) : (
                    <>
                      <div className="sat-compact-card">
                        <div className="sat-compact-card-top">
                          <span className="sat-compact-section-idx" aria-hidden>
                            ①
                          </span>
                          <span className="sat-compact-pill sat-compact-pill--month">월간</span>
                          <span className="sat-compact-card-title">부서 목표</span>
                          <span className="sat-compact-card-hint">센터(부서)별</span>
                        </div>
                        <div className="sat-compact-grid sat-compact-grid--dept">
                          {deptTargets.map((d) => (
                            <label key={d.deptId} className="sat-compact-field">
                              <span className="sat-compact-label">{d.deptName}</span>
                              <span className="sat-compact-input-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  className="sat-compact-input"
                                  placeholder="0"
                                  value={deptInputs[d.deptId] ?? ''}
                                  onChange={(e) =>
                                    setDeptInputs((prev) => ({
                                      ...prev,
                                      [d.deptId]: e.target.value,
                                    }))
                                  }
                                  aria-label={`${d.deptName} 목표 퍼센트`}
                                />
                                <span className="sat-compact-unit">%</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="sat-compact-card">
                        <div className="sat-compact-card-top">
                          <span className="sat-compact-section-idx" aria-hidden>
                            ②
                          </span>
                          <span className="sat-compact-pill sat-compact-pill--month">월간</span>
                          <span className="sat-compact-card-title">스킬 목표</span>
                          <span className="sat-compact-card-hint">4개 스킬</span>
                        </div>
                        <div className="sat-compact-grid sat-compact-grid--skill">
                          {skillTargets.map((s) => (
                            <label key={s.skillName} className="sat-compact-field">
                              <span className="sat-compact-label">{s.skillName}</span>
                              <span className="sat-compact-input-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  className="sat-compact-input"
                                  placeholder="0"
                                  value={skillInputs[s.skillName] ?? ''}
                                  onChange={(e) =>
                                    setSkillInputs((prev) => ({
                                      ...prev,
                                      [s.skillName]: e.target.value,
                                    }))
                                  }
                                  aria-label={`${s.skillName} 목표 퍼센트`}
                                />
                                <span className="sat-compact-unit">%</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="sat-compact-card sat-compact-card--annual">
                        <div className="sat-compact-card-top">
                          <span className="sat-compact-section-idx sat-compact-section-idx--annual" aria-hidden>
                            ③
                          </span>
                          <span className="sat-compact-pill sat-compact-pill--year">연간</span>
                          <span className="sat-compact-card-title">중점 추진</span>
                          <span className="sat-compact-card-hint">{parseYearMonth(targetMonthStr).year}년 한 해</span>
                        </div>
                        <div className="sat-compact-grid sat-compact-grid--annual">
                          {annualTargets.map((a) => (
                            <label key={a.taskCode} className="sat-compact-field">
                              <span className="sat-compact-label">{a.taskName}</span>
                              <span className="sat-compact-input-wrap">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  className="sat-compact-input"
                                  placeholder="0"
                                  value={annualInputs[a.taskCode] ?? ''}
                                  onChange={(e) =>
                                    setAnnualInputs((prev) => ({
                                      ...prev,
                                      [a.taskCode]: e.target.value,
                                    }))
                                  }
                                  aria-label={`${a.taskName} 목표 퍼센트`}
                                />
                                <span className="sat-compact-unit">%</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="sat-setup-pane-actions sat-setup-pane-actions--compact">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm sat-setup-btn-primary"
                      disabled={!allTargetsValid || saveTargetsMutation.isPending || targetsQuery.isLoading}
                      onClick={onSaveTargets}
                    >
                      {saveTargetsMutation.isPending ? '저장 중…' : '목표 저장'}
                    </button>
                    {targetsReady || saveTargetsMutation.isSuccess ? (
                      <span className="sat-compact-saved" title="저장됨">
                        <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden />
                        저장됨
                      </span>
                    ) : null}
                  </div>
                  {saveTargetsMutation.isSuccess ? (
                    <p className="sat-setup-inline-msg sat-setup-ok" role="status" aria-live="polite">
                      목표가 저장되었습니다.
                    </p>
                  ) : null}
                  {saveTargetsMutation.isError ? (
                    <p className="pending-inline-error sat-setup-inline-msg">{saveTargetsMutation.error?.message}</p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
