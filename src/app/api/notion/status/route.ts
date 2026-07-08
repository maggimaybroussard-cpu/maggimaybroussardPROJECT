import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NOTION_API_KEY;
  const configured = Boolean(key && key !== 'your-notion-api-key-here');
  return NextResponse?.json({ configured });
}
