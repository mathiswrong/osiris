import type { Metadata } from 'next';
import DocsClient from './DocsClient';
import { ENDPOINT_COUNT } from './apiCatalog';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description: `KNUCKLETAT documentation — self-hosting guide, interface reference, and an API reference for ${ENDPOINT_COUNT} open source intelligence endpoints.`,
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'KNUCKLETAT — Documentation & API Reference',
    description: `Self-hosting guide, interface reference, and ${ENDPOINT_COUNT} open source intelligence endpoints.`,
    url: '/docs',
    type: 'article',
    images: [{ url: '/knuckletat-og.png', width: 1200, height: 630 }],
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
