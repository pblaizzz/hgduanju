import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog-view';
export const metadata: Metadata = { title: '人气榜单' };
export default function RankingPage() { return <CatalogView view="rank" />; }
