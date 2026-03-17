import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/crew', '/portal', '/api/'],
      },
    ],
    sitemap: 'https://budsatwork.com/sitemap.xml',
  };
}
