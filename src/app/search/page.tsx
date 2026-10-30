import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog-view';
export const metadata: Metadata = { title: '搜索好剧' };
export default function SearchPage() { return <CatalogView view="search" />; }
