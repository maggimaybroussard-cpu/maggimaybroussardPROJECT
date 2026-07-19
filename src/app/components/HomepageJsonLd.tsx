'use client';

import { useEffect } from 'react';

export default function HomepageJsonLd() {
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

    const schemas = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Contract Paralegal Services',
        description:
          'Professional contract paralegal for law firms nationwide. Remote litigation support, legal research, document drafting, and case management assistance.',
        url: baseUrl,
        image: `${baseUrl}/assets/images/og-image.png`,
        publisher: {
          '@type': 'Organization',
          name: 'Broussard Legal Services',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/assets/images/app_logo.png`,
          },
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        name: 'Broussard Legal Services — Contract Paralegal Services',
        description: 'Remote contract paralegal services for law firms nationwide',
        url: baseUrl,
        image: `${baseUrl}/assets/images/app_logo.png`,
        areaServed: 'US',
        serviceType: [
          'Litigation Support',
          'Legal Research',
          'Document Drafting',
          'Case Management',
        ],
        priceRange: '$750–$2,800/month',
      },
    ];

    const existing = document.querySelectorAll('script[data-homepage-jsonld]');
    existing?.forEach((el) => el?.remove());

    schemas?.forEach((schema, i) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script?.setAttribute('data-homepage-jsonld', String(i));
      script.textContent = JSON.stringify(schema);
      document.head?.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-homepage-jsonld]')?.forEach((el) => el?.remove());
    };
  }, []);

  return null;
}
