import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export async function GET() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('outreach_personas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, company_name, product_description, industry, tone,
    value_propositions, objections, icp, qualification_criteria
  } = body;

  if (!name || !company_name || !product_description || !industry || !tone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from('outreach_personas')
    .insert({
      user_id: user.id,
      name,
      company_name,
      product_description,
      industry,
      tone,
      value_propositions: value_propositions ?? [],
      objections: objections ?? [],
      icp: icp ?? {},
      qualification_criteria: qualification_criteria ?? []
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
