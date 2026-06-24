import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/admin/', '/portal/', '/client-login/', '/payment-confirmation/', '/intake/'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials'],
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}