'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export async function POST(req: NextRequest) {
  try {
    const { fileData, fileName, fileType } = await req.json();

    if (!fileData) {
      return NextResponse.json({ error: 'No file data provided' }, { status: 400 });
    }

    const systemPrompt = `You are a senior legal analyst specializing in extracting structured information from court documents and legal files. 
Your task is to analyze the provided document and extract key information with precision and accuracy.
Always respond with valid JSON matching the exact schema requested. Do not include any text outside the JSON.`;

    const userPrompt = `Analyze this legal document "${fileName || 'document'}" and extract all key information.

Return a JSON object with this exact structure:
{
  "document_type": "string (e.g., Contract, Court Order, Complaint, Motion, Agreement, Lease, etc.)",
  "summary": "string (2-3 sentence overview of the document)",
  "parties": [
    {
      "name": "string",
      "role": "string (e.g., Plaintiff, Defendant, Attorney, Judge, Party A, Lessor, etc.)",
      "contact": "string or null (email, address, phone if present)"
    }
  ],
  "key_dates": [
    {
      "date": "string (formatted date)",
      "description": "string (what this date represents)",
      "type": "string (e.g., Filing Date, Hearing Date, Deadline, Effective Date, Expiration Date, etc.)"
    }
  ],
  "clauses": [
    {
      "title": "string (clause name/number)",
      "summary": "string (brief description of what this clause covers)",
      "importance": "high | medium | low"
    }
  ],
  "obligations": [
    {
      "party": "string (who has this obligation)",
      "obligation": "string (what they must do)",
      "deadline": "string or null (when it must be done)",
      "consequence": "string or null (consequence of non-compliance)"
    }
  ],
  "monetary_amounts": [
    {
      "amount": "string (formatted currency)",
      "description": "string (what this amount is for)",
      "party": "string or null (who pays/receives)"
    }
  ],
  "jurisdiction": "string or null",
  "case_number": "string or null",
  "governing_law": "string or null",
  "risk_flags": [
    {
      "flag": "string (description of potential risk or issue)",
      "severity": "high | medium | low"
    }
  ]
}

Extract ALL information present. If a section has no relevant data, use an empty array [].`;

    const contentBlocks: any[] = [
      { type: 'text', text: userPrompt },
    ];

    // Attach the document
    if (fileType === 'application/pdf' || fileType === 'text/plain') {
      contentBlocks.push({
        type: 'file',
        file: { file_data: fileData },
      });
    } else if (fileType?.startsWith('image/')) {
      contentBlocks.push({
        type: 'image_url',
        image_url: { url: fileData },
      });
    } else {
      // Fallback: treat as document
      contentBlocks.push({
        type: 'file',
        file: { file_data: fileData },
      });
    }

    const response = await getChatCompletion(
      'ANTHROPIC',
      'claude-sonnet-4-6',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentBlocks },
      ],
      {
        temperature: 0.1,
        max_tokens: 2048,
      }
    );

    const rawContent = response?.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response
    let extracted: Record<string, unknown>;
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse extraction result', raw: rawContent },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, extracted, fileName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[extract-document] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
