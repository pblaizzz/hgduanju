import type { Metadata } from 'next';
import { LibraryView } from '@/components/library-view';
export const metadata: Metadata = { title: '我的收藏' };
export default function LibraryPage() { return <LibraryView />; }
