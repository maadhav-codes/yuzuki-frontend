import type { Metadata } from 'next';
import './globals.css';

const siteName = 'Yuzuki';
const siteDescription =
  'Yuzuki is a production-ready Next.js starter with robust defaults for performance, SEO, and maintainability.';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  applicationName: siteName,
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteDescription,
    siteName,
    title: `${siteName} | Next.js Starter`,
    type: 'website',
    url: '/',
  },
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: `${siteName} | Next.js Starter`,
    template: `%s | ${siteName}`,
  },
  twitter: {
    card: 'summary_large_image',
    description: siteDescription,
    title: `${siteName} | Next.js Starter`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className='bg-slate-50 text-slate-900 antialiased'>{children}</body>
    </html>
  );
}
