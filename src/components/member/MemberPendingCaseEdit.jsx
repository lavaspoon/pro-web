import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Save } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { updateMyCase } from '../../api/memberApi';
import '../../pages/member/SubmitCasePage.css';
import '../case/CaseScorePanel.css';
import './MemberCaseEvaluationView.css';
import './MemberPendingCaseEdit.css';

function buildCallDateTimeForApi(datePart, timePart) {
  if (!datePart || !timePart) return '';
  return `${datePart} ${timePart}:00`;
}

function parseCallDateParts(callDate) {
  if (!callDate) return { callDatePart: '', callTimePart: '' };
  const m = String(callDate).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return { callDatePart: '', callTimePart: '' };
  return { callDatePart: m[1], callTimePart: `${m[2]}:${m[3]}` };
}

export default function MemberPendingCaseEdit({ caseData }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [clientError, setClientError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    excellentContent: '',
    callDatePart: '',
    callTimePart: '',
  });

  useEffect(() => {
    const { callDatePart, callTimePart } = parseCallDateParts(caseData?.callDate);
    setForm({
      excellentContent: caseData?.description ?? '',
      callDatePart,
      callTimePart,
    });
    setClientError('');
    setSuccessMessage('');
  }, [caseData?.id, caseData?.description, caseData?.callDate]);

  const updateMutation = useMutation({
    mutationFn: (payload) => updateMyCase(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-cases'] });
      queryClient.invalidateQueries({ queryKey: ['member-home'] });
      queryClient.setQueryData(['case-detail', String(caseData.id)], data);
      setSuccessMessage('접수 내용이 저장되었습니다.');
      setClientError('');
    },
    onError: (err) => {
      setClientError(err.message || '저장에 실패했습니다.');
      setSuccessMessage('');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClientError('');
    setSuccessMessage('');
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setClientError('');
    setSuccessMessage('');
    if (updateMutation.isPending) return;

    const body = form.excellentContent.trim();
    if (body.length < 20) {
      setClientError('우수 상담내용을 최소 20자 이상 입력해 주세요.');
      return;
    }
    if (!form.callDatePart || !form.callTimePart) {
      setClientError('상담일과 상담시간을 모두 선택해 주세요.');
      return;
    }
    if (!user?.skid) {
      setClientError('로그인 정보가 없습니다. 다시 로그인해 주세요.');
      return;
    }

    const callDate = buildCallDateTimeForApi(form.callDatePart, form.callTimePart);
    if (!callDate) {
      setClientError('상담 일시 형식을 확인해 주세요.');
      return;
    }

    updateMutation.mutate({
      caseId: caseData.id,
      skid: user.skid,
      description: body,
      callDate,
    });
  };

  return (
    <form className="member-pending-edit" onSubmit={handleSave} noValidate>
      {(clientError || successMessage) && (
        <div
          className={`member-pending-edit-banner${clientError ? ' member-pending-edit-banner--err' : ' member-pending-edit-banner--ok'}`}
          role={clientError ? 'alert' : 'status'}
        >
          {clientError ? <AlertCircle size={16} aria-hidden /> : null}
          {clientError || successMessage}
        </div>
      )}

      <section className="mce-section" aria-labelledby="member-pending-edit-content-title">
        <h4 id="member-pending-edit-content-title" className="mce-section-label">
          접수 내용
        </h4>
        <div className="mce-panel">
          <div className="mce-panel-block">
            <label className="sr-only" htmlFor="member-pending-edit-content">
              접수 내용
            </label>
            <textarea
              id="member-pending-edit-content"
              name="excellentContent"
              className="form-textarea member-pending-edit-textarea"
              placeholder="우수 상담 내용을 입력해 주세요."
              value={form.excellentContent}
              onChange={handleChange}
              rows={6}
            />
            <div className="submit-field-meta">
              <span className="input-hint">최소 20자 · {form.excellentContent.trim().length}자</span>
            </div>
          </div>
        </div>
      </section>

      <section className="submit-section member-pending-edit-when" aria-labelledby="member-pending-edit-when-title">
        <header className="submit-section-head">
          <div className="submit-section-head-text">
            <h3 id="member-pending-edit-when-title" className="submit-section-title">
              통화 일시 <span className="required">*</span>
            </h3>
          </div>
        </header>
        <div className="submit-section-body">
          <div className="form-row form-row-call-datetime">
            <div className="form-group form-group-inline">
              <label className="form-sublabel" htmlFor="member-pending-edit-call-date">
                날짜
              </label>
              <input
                id="member-pending-edit-call-date"
                type="date"
                name="callDatePart"
                className="form-input"
                value={form.callDatePart}
                onChange={handleChange}
              />
            </div>
            <div className="form-group form-group-inline">
              <label className="form-sublabel" htmlFor="member-pending-edit-call-time">
                시각
              </label>
              <input
                id="member-pending-edit-call-time"
                type="time"
                name="callTimePart"
                className="form-input"
                step={60}
                value={form.callTimePart}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="member-pending-edit-actions">
        <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending} aria-busy={updateMutation.isPending}>
          <Save size={16} aria-hidden />
          {updateMutation.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
