import React from 'react';
import './Skeleton.css';

/**
 * 뼈대 UI — 로딩 중 콘텐츠 자리를 잡아주는 플레이스홀더.
 *
 * - variant: "text" | "circle" | "rect" (기본 "rect")
 * - width/height: number(px) 또는 "50%" 같은 문자열
 * - radius: 모서리 둥글기 (숫자 px), 미지정 시 기본값
 * - className: 추가 클래스 (레이아웃 조정용)
 */
export default function Skeleton({
  variant = 'rect',
  width,
  height,
  radius,
  className = '',
  style,
}) {
  const resolved = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: radius != null ? (typeof radius === 'number' ? `${radius}px` : radius) : undefined,
    ...style,
  };
  return <span className={`sk sk--${variant} ${className}`.trim()} style={resolved} aria-hidden />;
}

/** 여러 줄 텍스트 스켈레톤 */
export function SkeletonLines({ lines = 3, lastWidth = '60%', gap = 6, lineHeight = 12 }) {
  return (
    <span className="sk-lines" style={{ gap: `${gap}px` }} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={lineHeight}
          width={i === lines - 1 ? lastWidth : '100%'}
        />
      ))}
    </span>
  );
}
