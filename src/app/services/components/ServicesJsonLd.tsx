'use client';

import { useEffect } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Broussard Legal Services — Contract Paralegal Services',
  description: 'Professional contract paralegal services for law firms nationwide.',
  url: baseUrl,
  image: `${baseUrl}/assets/images/og-image.png`,
  telephone: '+1-504-458-2831',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '900 Camp Street Suite 3rd Fl. PMB 70111',
    addressLocality: 'New Orleans',
    addressRegion: 'LA',
    postalCode: '70130',
    addressCountry: 'US',
  },
  areaServed: { '@type': 'Country', name: 'US' },
  priceRange: '$750–$2,800/month',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '10:00',
      closes: '18:00',
    },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Contract Paralegal Services',
  description:
    'Remote contract paralegal services for law firms nationwide including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, estate planning support, and more.',
  provider: {
    '@type': 'Organization',
    name: 'Broussard Legal Services',
    url: baseUrl,
    logo: `${baseUrl}/assets/images/app_logo.png`,
  },
  areaServed: { '@type': 'Country', name: 'US' },
  priceRange: '$750–$2,800/month',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What legal services does Broussard Legal Services provide?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Broussard Legal Services provides 12+ contract paralegal services including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, client intake, regulatory research, settlement letters, and estate & probate support.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the service available nationwide?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Broussard Legal Services provides remote contract paralegal services to law firms and attorneys across all 50 states.',
      },
    },
    {
      '@type': 'Question',
      name: 'How quickly can you start on a project?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most projects can begin within 24-48 hours of engagement. For urgent matters, expedited onboarding is available.',
      },
    },
    {
      '@type': 'Question',
      name: 'What practice areas do you support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Broussard Legal Services supports civil litigation, family law, real estate, estate planning, business & corporate, employment law, personal injury, criminal defense, immigration, intellectual property, healthcare, and environmental law.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can you handle confidential client matters?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. All work is handled under strict confidentiality agreements and attorney-client privilege protections. Broussard Legal Services maintains IOLTA compliance and secure document handling protocols.',
      },
    },
  ],
};

function injectScript(id: string, data: object) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export default function ServicesJsonLd() {
  useEffect(() => {
    injectScript('services-local-business-schema', localBusinessSchema);
    injectScript('services-service-schema', serviceSchema);
    injectScript('services-faq-schema', faqSchema);

    return () => {
      ['services-local-business-schema', 'services-service-schema', 'services-faq-schema'].forEach(
        (id) => document.getElementById(id)?.remove()
      );
    };
  }, []);

  return null;
}
