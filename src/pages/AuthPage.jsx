import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { loginWithSkid } from '../api/authApi';

function decodeBase64Skid(encoded) {
  if (!encoded?.trim()) return null;
  try {
    let normalized = decodeURIComponent(encoded.trim()).replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    normalized += '='.repeat(padLen);
    return atob(normalized);
  } catch {
    return null;
  }
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const encodedSkid = searchParams.get('skid');
    if (!encodedSkid) {
      setLoading(false);
      setError('skid 파라미터가 필요합니다. 예: /auth?skid={base64 인코딩 사번}');
      return undefined;
    }

    const skid = decodeBase64Skid(encodedSkid);
    if (!skid?.trim()) {
      setLoading(false);
      setError('skid를 디코딩할 수 없습니다.');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    logout();

    (async () => {
      try {
        const userData = await loginWithSkid(skid.trim());
        if (cancelled) return;
        login(userData);
        navigate(userData.role === 'admin' ? '/admin' : '/member', { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || '로그인에 실패했습니다.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, login, logout, navigate]);

  if (loading && !error) {
    return (
      <div className="auth-page">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <p>로그인 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-page">
        <p className="auth-page-error">{error}</p>
      </div>
    );
  }

  return null;
}
