'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="empty-state" role="alert"><h1>故事稍等片刻</h1><p>页面暂时遇到问题，请重新打开。</p><button className="button primary" onClick={reset}>重新打开</button></div>;
}
