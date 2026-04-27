import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export async function GET() {
  const supabase = createClient();
  const db = supabase as any;
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [
    { data: usage },
    { count: totalLeads },
    { count: activeConvs },
    { count: unhandledHandoffs }
  ] = await Promise.all([
    db
      .from('outreach_usage')
      .select('*')
      .eq('user_id', user.id)
      .gte('month', thisMonth.toISOString().split('T')[0])
      .maybeSingle(),
    db
      .from('outreach_leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    db
      .from('outreach_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .in(
        'lead_id',
        (
          await db
            .from('outreach_leads')
            .select('id')
            .eq('user_id', user.id)
        ).data?.map((l: any) => l.id) ?? []
      ),
    db
      .from('outreach_handoffs')
      .select('*', { count: 'exact', head: true })
      .eq('acknowledged', false)
      .in(
        'lead_id',
        (
          await db
            .from('outreach_leads')
            .select('id')
            .eq('user_id', user.id)
        ).data?.map((l: any) => l.id) ?? []
      )
  ]);

  return NextResponse.json({
    this_month: usage ?? {
      contacts_reached: 0,
      conversations_active: 0,
      leads_qualified: 0,
      leads_disqualified: 0,
      handoffs_made: 0,
      meetings_booked: 0
    },
    total_leads: totalLeads ?? 0,
    active_conversations: activeConvs ?? 0,
    pending_handoffs: unhandledHandoffs ?? 0
  });
}
