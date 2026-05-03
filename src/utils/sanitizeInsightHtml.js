import DOMPurify from 'dompurify';

const INSIGHT_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i',
  'ul', 'ol', 'li',
  'span', 'div', 'section',
];

/** 모델이 ```html ... ``` 로 감싼 경우 제거 */
function unwrapMarkdownFence(raw) {
  let s = String(raw ?? '').trim();
  const re = /^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = s.match(re);
  if (m) return m[1].trim();
  return s;
}

/**
 * AI 인사이트용 HTML만 허용·정제 (속성 제거로 XSS 최소화)
 * @param {string} dirty
 * @returns {string}
 */
export function sanitizeInsightHtml(dirty) {
  const input = unwrapMarkdownFence(dirty);
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: INSIGHT_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * 화면 가독성: 단락·목록 길이 제한 (모델이 길게 줄 때도 UI는 짧게 유지)
 */
export function finalizeInsightHtml(dirty) {
  const safe = sanitizeInsightHtml(dirty);
  if (!safe.trim()) return '';

  if (typeof DOMParser === 'undefined') return safe;

  try {
    const doc = new DOMParser().parseFromString(`<div id="__ins">${safe}</div>`, 'text/html');
    const root = doc.body.querySelector('#__ins');
    if (!root) return safe;

    root.querySelectorAll('h3, h4, h5').forEach((h) => {
      const p = doc.createElement('p');
      while (h.firstChild) p.appendChild(h.firstChild);
      h.replaceWith(p);
    });

    const ps = [...root.querySelectorAll('p')];
    ps.slice(1).forEach((p) => p.remove());

    const lists = [...root.querySelectorAll('ul, ol')];
    lists.slice(1).forEach((list) => list.remove());
    const firstList = lists[0];
    if (firstList) {
      [...firstList.querySelectorAll(':scope > li')].slice(2).forEach((li) => li.remove());
    }

    const out = root.innerHTML.replace(/\s{2,}/g, ' ').trim();
    return out || safe;
  } catch {
    return safe;
  }
}
