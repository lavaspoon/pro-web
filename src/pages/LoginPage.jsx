import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, ShieldCheck, LogIn, Award, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { loginWithSkid } from '../api/authApi';
import './LoginPage.css';

export default function LoginPage() {
  const [skid, setSkid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!skid.trim()) {
      setError('SKID를 입력해주세요.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const user = await loginWithSkid(skid.trim());
      login(user);
      navigate(user.role === 'admin' ? '/admin' : '/member');
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다. SKID를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shape shape1" />
      <div className="login-bg-shape shape2" />

      <div className="login-card">
        {/* 로고 */}
        <div className="login-logo">
          <div className="login-logo-icon">S</div>
          <div>
            <h1 className="login-logo-title">YouPro</h1>
            <p className="login-logo-sub">SKT 우수사례 관리 시스템</p>
          </div>
        </div>

        <div className="login-body fade-in-up">
          <p className="login-desc">SKID를 입력하여 로그인하세요</p>

          {/* 역할 안내 배지 */}
          <div className="role-hint-row">
            <div className="role-hint-item">
              <Headphones size={16} />
              <span>구성원</span>
            </div>
            <div className="role-hint-sep">·</div>
            <div className="role-hint-item">
              <ShieldCheck size={16} />
              <span>관리자</span>
            </div>
            <span className="role-hint-desc">SKID에 따라 자동 구분</span>
          </div>

          <form className="skid-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="skid-input">
                SK ID
              </label>
              <input
                id="skid-input"
                type="text"
                className="form-input"
                placeholder="예: EMP001"
                value={skid}
                onChange={(e) => setSkid(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg login-submit-btn"
              disabled={isLoading || !skid.trim()}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  로그인 중...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  로그인
                </>
              )}
            </button>
          </form>
        </div>

        <div className="login-footer">
          <Award size={14} />
          <span>연간 최대 36회 선정 · 월 최대 3회 · 연말 포상</span>
        </div>
      </div>
    </div>
  );
}
