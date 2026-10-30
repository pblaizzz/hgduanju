import Link from 'next/link';
export default function NotFound() {
  return <div className="empty-state"><h1>这个故事还没开场</h1><p>页面可能已经离开，回首页找找其他好剧吧。</p><Link className="button primary" href="/">返回首页</Link></div>;
}
