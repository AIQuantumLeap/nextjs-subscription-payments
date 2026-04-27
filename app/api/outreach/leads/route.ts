import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const personaId = searchParams.get('persona_id');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const offset = (page - 1) * limit;

  let query = (supabase as any)
    .from('outreach_leads')
    .select('*, outreach_personas(name)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (personaId) query = query.eq('persona_id', personaId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count, page, limit });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { first_name, last_name, email, company, job_title, persona_id, context_fields } = body;

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'first_name, last_name, and email are required' }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from('outreach_leads')
    .insert({
      user_id: user.id,
      first_name, last_name, email,
      company: company ?? null,
      job_title: job_title ?? null,
      persona_id: persona_id ?? null,
      context_fields: context_fields ?? {}
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Lead with this email already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
