import type { Metadata } from 'next';
import { LibraryView } from '@/components/library-view';
export const metadata: Metadata = { title: '观看记录' };
export default function HistoryPage() { return <LibraryView historyMode />; }
