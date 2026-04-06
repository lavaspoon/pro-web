import React from 'react';
import './CsSatisfactionPage.css';

/**
 * CS 만족도 — 상단 카테고리 전용 화면 (추후 지표·설문 등 연동)
 */
export default function CsSatisfactionPage() {
  return (
    <div className="page-container cs-sat-page fade-in">
      <header className="cs-sat-head">
        <h1 className="cs-sat-title">CS 만족도</h1>
        <p className="cs-sat-sub">이 영역에 CS 만족도 관련 콘텐츠를 구성할 수 있습니다.</p>
      </header>
    </div>
  );
}
