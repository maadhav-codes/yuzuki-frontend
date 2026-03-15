import type { Metadata } from 'next';
import './globals.css';
import { Noto_Sans } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const notoSans = Noto_Sans({ variable: '--font-sans' });

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
    <html className={notoSans.variable} lang='en'>
      <body className='bg-slate-50 text-slate-900 antialiased'>
        <Script src='/cubism4/live2dcubismcore.min.js' strategy='beforeInteractive' />
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
