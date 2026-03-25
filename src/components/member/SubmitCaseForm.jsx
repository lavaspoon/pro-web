import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertCircle, Send, Info, Lightbulb } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { submitCase } from '../../api/memberApi';
import '../../pages/member/SubmitCasePage.css';

/**
 * STT TB_STT_RESULT.call_time 과 동일하게 맞추기 위해
 * "YYYY-MM-DD HH:mm:00" 형태로 전송한다.
 */
function buildCallDateTimeForApi(datePart, timePart) {
  if (!datePart || !timePart) return '';
  return `${datePart} ${timePart}:00`;
}

/**
 * @param {{ className?: string, onGoToCaseList?: () => void, compact?: boolean }} props
 */
export default function SubmitCaseForm({ className = '', onGoToCaseList, compact = false }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    callDatePart: '',
    callTimePart: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (data) => submitCase({ ...data, skid: user.skid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-cases'] });
      queryClient.invalidateQueries({ queryKey: ['member-home'] });
      setSubmitted(true);
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    const callDate = buildCallDateTimeForApi(form.callDatePart, form.callTimePart);
    if (!callDate) return;
    mutation.mutate({
      title: form.title,
      description: form.description,
      callDate,
    });
  };

  const resetForm = () => {
    setForm({ title: '', description: '', callDatePart: '', callTimePart: '' });
    setSubmitted(false);
  };

  const canSubmit =
    form.title.trim() &&
    form.description.trim() &&
    form.callDatePart &&
    form.callTimePart;

  if (submitted) {
    return (
      <div className={`submit-success ${className}`.trim()}>
        <div className="success-icon">
          <CheckCircle size={48} />
        </div>
        <h2>접수 완료!</h2>
        <p>
          우수사례가 성공적으로 접수되었습니다.
          <br />
          담당자 검토 후 결과를 알려드립니다.
        </p>
        <div className="success-actions">
          <button type="button" className="btn btn-primary" onClick={onGoToCaseList}>
            내 사례 목록 보기
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm}>
            추가 접수하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={compact ? 'submit-layout submit-layout-modal' : 'submit-layout'}>
        <form className="submit-form" onSubmit={handleSubmit}>
          {mutation.isError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {mutation.error?.message}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              사례 제목 <span className="required">*</span>
            </label>
            <input
              type="text"
              name="title"
              className="form-input"
              placeholder="예: 고객 불만 신속 해결 및 감동 응대"
              value={form.title}
              onChange={handleChange}
              maxLength={60}
              required
            />
            <span className="input-hint">{form.title.length}/60자</span>
          </div>

          <div className="form-group">
            <label className="form-label">
              응대 내용 요약 <span className="required">*</span>
            </label>
            <textarea
              name="description"
              className="form-textarea"
              placeholder="어떤 상황에서 어떻게 고객을 응대했는지 구체적으로 작성해주세요. (최소 50자 이상 권장)"
              value={form.description}
              onChange={handleChange}
              rows={compact ? 4 : 5}
              required
            />
            <span className="input-hint">{form.description.length}자</span>
          </div>

          <div className="form-group">
            <label className="form-label">
              통화 일시 <span className="required">*</span>
            </label>
            <p className="form-field-hint">
              녹취(STT)와 맞추려면 실제 통화가 시작된 날짜·시각(24시간, 분 단위)을 입력해 주세요.
            </p>
            <div className="form-row form-row-call-datetime">
              <div className="form-group form-group-inline">
                <label className="form-sublabel" htmlFor="submit-call-date">
                  날짜
                </label>
                <input
                  id="submit-call-date"
                  type="date"
                  name="callDatePart"
                  className="form-input"
                  value={form.callDatePart}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group form-group-inline">
                <label className="form-sublabel" htmlFor="submit-call-time">
                  시각 (HH:mm)
                </label>
                <input
                  id="submit-call-time"
                  type="time"
                  name="callTimePart"
                  className="form-input"
                  step={60}
                  value={form.callTimePart}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg submit-btn"
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                접수 중...
              </>
            ) : (
              <>
                <Send size={18} />
                우수사례 접수하기
              </>
            )}
          </button>
        </form>

        {!compact && (
          <div className="submit-guide">
            <div className="guide-card">
              <div className="guide-header">
                <Info size={16} />
                <strong>접수 안내</strong>
              </div>
              <ul className="guide-list">
                <li>
                  월 최대 <strong>3회</strong> 선정 가능 (신청 횟수 제한 없음)
                </li>
                <li>
                  연간 최대 <strong>36회</strong> 선정 가능
                </li>
                <li>
                  <strong>통화 일시</strong>는 STT 녹취 시각과 같게 적어야 매칭됩니다
                </li>
                <li>담당자가 녹취콜을 청취 후 선정 여부 판정</li>
                <li>AI 분석 결과가 참고 자료로 제공됨</li>
                <li>선정 결과는 마이페이지에서 확인 가능</li>
                <li>연말 포상은 선정 건수 기준으로 적금식 지급</li>
              </ul>
            </div>

            <div className="guide-card tips-card">
              <div className="guide-header">
                <Lightbulb size={16} />
                <strong>우수 사례 작성 팁</strong>
              </div>
              <ul className="guide-list">
                <li>고객의 문제 상황을 구체적으로 기술</li>
                <li>해결 과정과 고객 반응 포함</li>
                <li>고객이 표현한 만족/감사 내용 기재</li>
                <li>추가 서비스 안내나 가치 제공 내용 포함</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
