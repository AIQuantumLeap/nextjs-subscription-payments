import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const db = supabase as any;
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const personaId = formData.get('persona_id') as string | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 });

  const text = await file.text();

  const { data: rows, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.toLowerCase().trim().replace(/\s+/g, '_')
  });

  if (errors.length && rows.length === 0) {
    return NextResponse.json({ error: 'CSV parse failed', details: errors[0]?.message }, { status: 400 });
  }

  // Normalise column names — accept common aliases
  const alias = (row: Record<string, string>, ...keys: string[]) =>
    keys.map((k) => row[k]).find((v) => v !== undefined && v !== '') ?? '';

  const leads = rows.map((row) => {
    const fullName = alias(row, 'full_name', 'name');
    const firstName = alias(row, 'first_name', 'firstname') || (fullName ? fullName.split(' ')[0] : '');
    const lastName  = alias(row, 'last_name', 'lastname')   || (fullName ? fullName.split(' ').slice(1).join(' ') : '');
    const email     = alias(row, 'email', 'email_address');

    // Remaining columns become context_fields
    const knownCols = new Set(['first_name','firstname','last_name','lastname','full_name','name','email','email_address','company','job_title','title']);
    const contextFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!knownCols.has(k) && v) contextFields[k] = v;
    }

    return {
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: email.toLowerCase().trim(),
      company: alias(row, 'company') || null,
      job_title: alias(row, 'job_title', 'title') || null,
      persona_id: personaId || null,
      context_fields: contextFields
    };
  }).filter((l) => l.first_name && l.email);

  if (leads.length === 0) {
    return NextResponse.json({ error: 'No valid leads found. Ensure CSV has first_name/email columns.' }, { status: 400 });
  }

  // Upsert in batches of 100 — skip duplicates
  let imported = 0;
  let skipped = 0;
  const batchSize = 100;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const { error, count } = await db
      .from('outreach_leads')
      .upsert(batch, { onConflict: 'user_id,email', ignoreDuplicates: true })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += count ?? batch.length;
    skipped += batch.length - (count ?? batch.length);
  }

  return NextResponse.json({ imported, skipped, total: leads.length });
}
