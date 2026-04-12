import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Lock,
  Percent,
  Upload,
} from 'lucide-react';
import {
  fetchCsSatisfactionMonthlyTargets,
  saveCsSatisfactionMonthlyTargets,
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

export default function AdminSatisfactionSetupPage() {
  const fileRef = useRef(null);
  const queryClient = useQueryClient();
  const [targetMonthStr, setTargetMonthStr] = useState(localYearMonth);
  const [targetInputs, setTargetInputs] = useState({});
  const [pickedName, setPickedName] = useState('');

  const monthlyTargetsQuery = useQuery({
    queryKey: ['cs-satisfaction-monthly-targets', targetMonthStr],
    queryFn: () => {
      const { year, month } = parseYearMonth(targetMonthStr);
      return fetchCsSatisfactionMonthlyTargets(year, month);
    },
  });

  useEffect(() => {
    const centers = monthlyTargetsQuery.data?.centers;
    if (!centers?.length) return;
    const next = {};
    centers.forEach((c) => {
      next[c.secondDepthDeptId] =
        c.targetPercent != null && c.targetPercent !== ''
          ? String(Number(c.targetPercent))
          : '';
    });
    setTargetInputs(next);
  }, [monthlyTargetsQuery.data]);

  const saveTargetsMutation = useMutation({
    mutationFn: (body) => saveCsSatisfactionMonthlyTargets(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-monthly-targets', targetMonthStr] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-summary'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadCsSatisfactionExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-center-month-detail'] });
      setPickedName('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const centers = monthlyTargetsQuery.data?.centers ?? [];
  const targetsReady = monthlyTargetsQuery.data?.allCentersSet === true;

  const allTargetsValid =
    centers.length > 0 &&
    centers.every((c) => {
      const raw = targetInputs[c.secondDepthDeptId];
      if (raw === '' || raw == null) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    });

  const onSaveTargets = () => {
    if (!allTargetsValid) return;
    const { year, month } = parseYearMonth(targetMonthStr);
    const targets = centers.map((c) => ({
      secondDepthDeptId: c.secondDepthDeptId,
      targetPercent: Number(targetInputs[c.secondDepthDeptId]),
    }));
    saveTargetsMutation.mutate({ year, month, targets });
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

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in pending-page sat-setup-page">
      <header className="adm-header adm-header--yp pending-header">
        <Link
          to="/admin/satisfaction"
          className="adm-back-btn pending-header-back"
          aria-label="만족도로 돌아가기"
        >
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          <span>만족도</span>
        </Link>
        <div className="adm-header-row pending-header-row">
          <div className="pending-header-body">
            <h1 className="adm-title">목표 · 엑셀 반영</h1>
            <p className="adm-sub sat-setup-lead">
              같은 연·월에 대해 <strong>목표를 저장</strong>한 뒤 <strong>엑셀을 업로드</strong>합니다.
            </p>
          </div>
        </div>
      </header>

      <div className="sat-setup-shell">
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

        <div className="sat-setup-pair">
          <section className="sat-setup-pane sat-setup-pane--targets" aria-labelledby="sat-setup-targets-title">
            <div className="sat-setup-pane-head">
              <span className="sat-setup-pane-ico sat-setup-pane-ico--targets" aria-hidden>
                <Percent size={18} strokeWidth={2.2} />
              </span>
              <div>
                <h2 id="sat-setup-targets-title" className="sat-setup-pane-title">
                  ① 월간 목표 %
                </h2>
                <p className="sat-setup-pane-sub">센터별 만족도 목표를 입력하고 저장합니다.</p>
              </div>
              <span className="sat-setup-step-num" aria-hidden>
                1
              </span>
            </div>
            <div className="sat-setup-pane-body">
              {monthlyTargetsQuery.isLoading ? (
                <p className="sat-setup-muted">불러오는 중…</p>
              ) : centers.length === 0 ? (
                <p className="sat-setup-muted">센터 없음</p>
              ) : (
                <ul className="sat-setup-target-list">
                  {centers.map((c) => (
                    <li key={c.secondDepthDeptId} className="sat-setup-target-row">
                      <span className="sat-setup-target-name">{c.secondDepthName}</span>
                      <div className="sat-setup-target-input-wrap">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className="sat-setup-target-input"
                          placeholder="0–100"
                          value={targetInputs[c.secondDepthDeptId] ?? ''}
                          onChange={(e) =>
                            setTargetInputs((prev) => ({
                              ...prev,
                              [c.secondDepthDeptId]: e.target.value,
                            }))
                          }
                          aria-label={`${c.secondDepthName} 목표 퍼센트`}
                        />
                        <span className="sat-setup-target-suffix">%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="sat-setup-pane-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm sat-setup-btn-primary"
                  disabled={!allTargetsValid || saveTargetsMutation.isPending || monthlyTargetsQuery.isLoading}
                  onClick={onSaveTargets}
                >
                  {saveTargetsMutation.isPending ? '저장 중…' : '목표 저장'}
                </button>
                {targetsReady ? (
                  <span className="sat-setup-saved" title="저장됨" aria-label="저장됨">
                    <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden />
                  </span>
                ) : null}
              </div>
              {saveTargetsMutation.isError ? (
                <p className="pending-inline-error sat-setup-inline-msg">{saveTargetsMutation.error?.message}</p>
              ) : null}
            </div>
          </section>

          <div className="sat-setup-bridge" aria-hidden>
            <span className="sat-setup-bridge-line" />
            <span className="sat-setup-bridge-icon">
              <ArrowRight size={18} strokeWidth={2.25} />
            </span>
            <span className="sat-setup-bridge-line" />
          </div>

          <section className="sat-setup-pane sat-setup-pane--upload" aria-labelledby="sat-setup-upload-title">
            <div className="sat-setup-pane-head">
              <span className="sat-setup-pane-ico sat-setup-pane-ico--upload" aria-hidden>
                <Upload size={18} strokeWidth={2.2} />
              </span>
              <div>
                <h2 id="sat-setup-upload-title" className="sat-setup-pane-title">
                  ② 엑셀 업로드
                </h2>
                <p className="sat-setup-pane-sub">① 저장 완료 후 같은 월 데이터를 반영합니다.</p>
              </div>
              <span className="sat-setup-step-num" aria-hidden>
                2
              </span>
            </div>
            <div className="sat-setup-pane-body">
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
                  <p className="sat-setup-drop-locked-text">먼저 ①에서 목표를 저장해 주세요.</p>
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
      </div>
    </div>
  );
}
