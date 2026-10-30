import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SourceProvider } from '@/components/providers';
import { AppShell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '片刻剧场 · 给故事一点时间', template: '%s · 片刻剧场' },
  description: '发现好剧，接着上次的故事。片刻剧场，给故事一点时间。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" data-scroll-behavior="smooth"><body><Suspense fallback={<div className="app-boot">片刻剧场<span>正在打开好故事…</span></div>}><SourceProvider><AppShell>{children}</AppShell></SourceProvider></Suspense></body></html>;
}
