import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: 'daily',
      lastModified: new Date(),
      priority: 1,
      url: siteUrl,
    },
  ];
}
