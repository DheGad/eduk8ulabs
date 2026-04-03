import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/.next/'],
    },
    sitemap: 'https://os.streetmp.com/sitemap.xml',
  };
}
