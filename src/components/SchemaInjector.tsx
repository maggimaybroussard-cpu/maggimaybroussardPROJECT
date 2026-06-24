import React from 'react';
import Header from '@/components/Header';


interface SchemaInjectorProps {
  schemas: Array<{
    id: string;
    data: Record<string, unknown>;
  }>;
}

/**
 * SchemaInjector Component
 * 
 * Injects multiple JSON-LD schema types for GEO/AEO optimization.
 * Place this as the first child in your page wrapper, before <Header />.
 * 
 * Usage:
 * <SchemaInjector schemas={[
 *   { id: 'schema-organization', data: organizationSchema },
 *   { id: 'schema-webpage', data: webpageSchema },
 *   { id: 'schema-service', data: serviceSchema },
 *   { id: 'schema-faq', data: faqSchema },
 * ]} />
 */
export default function SchemaInjector({ schemas }: SchemaInjectorProps) {
  return (
    <>
      {schemas.map((schema) => (
        <script
          key={schema.id}
          id={schema.id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema.data),
          }}
        />
      ))}
    </>
  );
}
