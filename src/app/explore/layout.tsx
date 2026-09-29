import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KNUCKLETAT | Map Explorer',
  description: 'Explore live open source intelligence on the KNUCKLETAT map.',
  openGraph: {
    url: '/explore',
    title: 'KNUCKLETAT | Map Explorer',
    description: 'Explore live open source intelligence on the KNUCKLETAT map.',
  },
  twitter: {
    title: 'KNUCKLETAT | Map Explorer',
    description: 'Explore live open source intelligence on the KNUCKLETAT map.',
  },
};

export default function ExploreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
