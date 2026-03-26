import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertCircle, Send, Info, Lightbulb } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { submitCase } from '../../api/memberApi';
import '../../pages/member/SubmitCasePage.css';

/** STT TB_STT_RESULT.call_time 과 맞추기: "YYYY-MM-DD HH:mm:00" */
function buildCallDateTimeForApi(datePart, timePart) {
  if (!datePart || !timePart) return '';
  return `${datePart} ${timePart}:00`;
}

/** API 호환용 제목: 우수 상담내용 앞부분에서 자동 생성 */
function deriveTitleFromExcellentContent(text) {
  const t = String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return 'YOU PRO 우수사례';
  const firstSentence = t.split(/[.!?。\n]/)[0].trim() || t;
  const maxLen = 58;
  if (firstSentence.length > maxLen) {
    return `${firstSentence.slice(0, maxLen)}…`;
  }
  return firstSentence.slice(0, 60);
}

/**
 * @param {{ className?: string, onGoToCaseList?: () => void, compact?: boolean }} props
 */
export default function SubmitCaseForm({ className = '', onGoToCaseList, compact = false }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    excellentContent: '',
    callDatePart: '',
    callTimePart: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [clientError, setClientError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => {
      const skid = user?.skid;
      if (!skid) {
        return Promise.reject(new Error('로그인 정보가 없습니다. 다시 로그인해 주세요.'));
      }
      return submitCase({ ...data, skid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-cases'] });
      queryClient.invalidateQueries({ queryKey: ['member-home'] });
      setSubmitted(true);
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClientError('');
    if (mutation.isError) {
      mutation.reset();
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setClientError('');
    if (mutation.isPending) return;
    const body = form.excellentContent.trim();
    if (body.length < 30) {
      setClientError('우수 상담내용을 최소 30자 이상 입력해 주세요.');
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
    const title = deriveTitleFromExcellentContent(body);
    mutation.mutate({
      title,
      description: body,
      callDate,
    });
  };

  const resetForm = () => {
    setForm({ excellentContent: '', callDatePart: '', callTimePart: '' });
    setSubmitted(false);
    setClientError('');
  };

  const canSubmit =
    form.excellentContent.trim().length >= 30 && form.callDatePart && form.callTimePart;

  if (submitted) {
    return (
      <div className={`submit-success ${className}`.trim()}>
        <div className="success-icon">
          <CheckCircle size={48} />
        </div>
        <h2>접수 완료</h2>
        <p>
          YOU PRO 사례가 접수되었습니다.
          <br />
          녹취(STT) 매칭 후 AI·관리자 검토가 진행됩니다.
        </p>
        <div className="success-actions">
          <button type="button" className="btn btn-primary" onClick={onGoToCaseList}>
            내 사례 목록
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm}>
            추가 접수
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={compact ? 'submit-layout submit-layout-modal' : 'submit-layout'}>
        <form className="submit-form" onSubmit={handleSubmit} noValidate>
          {(mutation.isError || clientError) && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {clientError || mutation.error?.message}
            </div>
          )}

          {!compact && (
            <p className="submit-form-overview">
              <strong>① 사례 내용</strong>을 작성한 뒤, <strong>② 통화 일시</strong>를 입력하고 접수합니다.
            </p>
          )}

          <section className="submit-section" aria-labelledby="submit-section-story-title">
            <header className="submit-section-head">
              <span className="submit-step-badge" aria-hidden>
                1
              </span>
              <div className="submit-section-head-text">
                <h3 id="submit-section-story-title" className="submit-section-title">
                  사례 내용 <span className="required">*</span>
                </h3>
                <p className="submit-section-lead">
                  우수 상담으로 제출할 내용입니다. 상황·응대·결과를 구체적으로 적어 주세요. STT와 비교·AI 분석에
                  쓰입니다.
                </p>
              </div>
            </header>
            <div className="submit-section-body">
              <label className="sr-only" htmlFor="submit-excellent-content">
                우수 상담내용
              </label>
              <textarea
                id="submit-excellent-content"
                name="excellentContent"
                className="form-textarea"
                placeholder="예: 불만 고객에게 먼저 공감을 표한 뒤, 원인·해결 절차를 단계별로 안내하고, 후속 확인까지 약속한 사례 등"
                value={form.excellentContent}
                onChange={handleChange}
                rows={compact ? 5 : 6}
              />
              <div className="submit-field-meta">
                <span className="input-hint">최소 30자 · {form.excellentContent.trim().length}자</span>
              </div>
            </div>
          </section>

          <section className="submit-section" aria-labelledby="submit-section-when-title">
            <header className="submit-section-head">
              <span className="submit-step-badge" aria-hidden>
                2
              </span>
              <div className="submit-section-head-text">
                <h3 id="submit-section-when-title" className="submit-section-title">
                  통화 일시 <span className="required">*</span>
                </h3>
                <p className="submit-section-lead">
                  녹취(STT)에 기록된 통화 <strong>시작</strong> 시각과 같게 맞춰 주세요. (날짜 + 24시간제 시·분)
                </p>
              </div>
            </header>
            <div className="submit-section-body">
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
                  />
                </div>
                <div className="form-group form-group-inline">
                  <label className="form-sublabel" htmlFor="submit-call-time">
                    시각
                  </label>
                  <input
                    id="submit-call-time"
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

          <div className="submit-form-actions">
            <button
              type="submit"
              className={`btn btn-primary btn-lg submit-btn${!canSubmit ? ' submit-btn--soft' : ''}`}
              aria-busy={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  접수 중...
                </>
              ) : (
                <>
                  <Send size={18} />
                  접수하기
                </>
              )}
            </button>
            {compact && (
              <p className="submit-form-footnote">선정 한도: 월 3회 · 연 36회 · 상담 일시는 STT와 동일해야 매칭됩니다.</p>
            )}
          </div>
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
                  선정 한도: 월 <strong>{3}</strong>회 · 연 <strong>{36}</strong>회
                </li>
                <li>
                  <strong>통화 일시</strong>는 STT에 찍힌 통화 시작 시각과 같아야 녹취가 연결됩니다.
                </li>
                <li>관리자 측 녹취·STT 적재 후 매칭·AI 검토가 이어집니다.</li>
                <li>판정·피드백은 내 사례 상세에서 확인할 수 있습니다.</li>
              </ul>
            </div>

            <div className="guide-card tips-card">
              <div className="guide-header">
                <Lightbulb size={16} />
                <strong>작성 팁</strong>
              </div>
              <ul className="guide-list">
                <li>고객 감정·문제 상황을 먼저 짚어 주세요.</li>
                <li>실제로 한 안내·조치를 순서대로 적으면 STT 대조에 유리합니다.</li>
                <li>고객 반응·만족 표현이 있다면 함께 적어 주세요.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
