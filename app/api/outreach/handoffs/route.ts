import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const acknowledged = searchParams.get('acknowledged');

  const userLeadIds = (
    await (supabase as any).from('outreach_leads').select('id').eq('user_id', user.id)
  ).data?.map((l: any) => l.id) ?? [];

  if (userLeadIds.length === 0) return NextResponse.json([]);

  let query = (supabase as any)
    .from('outreach_handoffs')
    .select('*, outreach_leads(first_name, last_name, email, company, job_title)')
    .in('lead_id', userLeadIds)
    .order('created_at', { ascending: false });

  if (acknowledged === 'false') query = query.eq('acknowledged', false);
  if (acknowledged === 'true')  query = query.eq('acknowledged', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const userLeadIds = (
    await (supabase as any).from('outreach_leads').select('id').eq('user_id', user.id)
  ).data?.map((l: any) => l.id) ?? [];

  const { data, error } = await (supabase as any)
    .from('outreach_handoffs')
    .update({ acknowledged: true })
    .eq('id', id)
    .in('lead_id', userLeadIds)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
