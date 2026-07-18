import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/services', '/pricing', '/contact', '/case-studies', '/testimonials', '/features'],
        disallow: ['/api/', '/_next/', '/admin/', '/portal/', '/client-login/', '/payment-confirmation/', '/intake/'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials', '/features'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials', '/features'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials', '/features'],
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials', '/features'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/blog', '/services'],
        crawlDelay: 0,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}