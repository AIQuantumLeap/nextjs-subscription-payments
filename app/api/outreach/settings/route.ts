import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export async function GET() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await (supabase as any)
    .from('outreach_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: gmail } = await (supabase as any)
    .from('gmail_connections')
    .select('email, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    settings: settings ?? {
      handoff_email: null,
      active_days: [1, 2, 3, 4, 5],
      active_hours_start: 8,
      active_hours_end: 18,
      timezone: 'America/New_York'
    },
    gmail
  });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { handoff_email, active_days, active_hours_start, active_hours_end, timezone } = body;

  const { data, error } = await (supabase as any)
    .from('outreach_settings')
    .upsert(
      {
        user_id: user.id,
        handoff_email: handoff_email ?? null,
        active_days: active_days ?? [1, 2, 3, 4, 5],
        active_hours_start: active_hours_start ?? 8,
        active_hours_end: active_hours_end ?? 18,
        timezone: timezone ?? 'America/New_York',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
