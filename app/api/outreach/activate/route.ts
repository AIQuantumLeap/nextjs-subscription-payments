import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { sendEmail } from '@/utils/outreach/gmail';
import { generateFirstOutreach, type PersonaConfig } from '@/utils/outreach/claude';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const db = supabase as any;
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { persona_id } = await request.json();
  if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 });

  // Fetch persona
  const { data: persona, error: personaErr } = await db
    .from('outreach_personas')
    .select('*')
    .eq('id', persona_id)
    .eq('user_id', user.id)
    .single();

  if (personaErr || !persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 });

  // Fetch Gmail connection
  const { data: gmail } = await db
    .from('gmail_connections')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!gmail) return NextResponse.json({ error: 'Gmail not connected. Connect Gmail in Settings first.' }, { status: 400 });

  // Check schedule settings
  const { data: settings } = await db
    .from('outreach_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (settings) {
    const tz = settings.timezone ?? 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', hour12: false, weekday: 'narrow'
    }).formatToParts(new Date());
    const dayShort = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const dayNum = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].indexOf(dayShort ?? '');
    const activeDays: number[] = settings.active_days ?? [1, 2, 3, 4, 5];
    if (!activeDays.includes(dayNum) || hour < settings.active_hours_start || hour >= settings.active_hours_end) {
      return NextResponse.json({ error: 'Outside of configured sending schedule.' }, { status: 400 });
    }
  }

  // Fetch not_contacted leads for this persona
  const { data: leads, error: leadsErr } = await db
    .from('outreach_leads')
    .select('*')
    .eq('user_id', user.id)
    .eq('persona_id', persona_id)
    .eq('status', 'not_contacted');

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: 'No uncontacted leads for this persona.' });
  }

  const personaConfig: PersonaConfig = {
    name: persona.name,
    company_name: persona.company_name,
    product_description: persona.product_description,
    industry: persona.industry,
    tone: persona.tone,
    value_propositions: persona.value_propositions ?? [],
    objections: persona.objections ?? [],
    icp: persona.icp ?? {},
    qualification_criteria: persona.qualification_criteria ?? []
  };

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const lead of leads) {
    try {
      // Generate first email with Claude
      const { subject, body } = await generateFirstOutreach(personaConfig, {
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        job_title: lead.job_title,
        context_fields: lead.context_fields ?? {}
      });

      // Send via Gmail
      const { messageId, threadId } = await sendEmail(
        gmail.access_token,
        gmail.refresh_token,
        lead.email,
        subject,
        body
      );

      // Create conversation record
      const { data: conv } = await db
        .from('outreach_conversations')
        .insert({
          lead_id: lead.id,
          gmail_thread_id: threadId,
          exchange_count: 0,
          status: 'active',
          last_processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (conv) {
        // Store outbound message
        await (supabase as any).from('outreach_messages').insert({
          conversation_id: conv.id,
          direction: 'outbound',
          subject,
          body,
          gmail_message_id: messageId,
          sent_at: new Date().toISOString()
        });
      }

      // Update lead status
      await db
        .from('outreach_leads')
        .update({ status: 'in_conversation', updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      // Update usage stats
      await (supabase as any).rpc('increment_outreach_usage', {
        p_user_id: user.id,
        p_field: 'contacts_reached'
      });

      results.sent++;

      // Respect API rate limits — small delay between sends
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${lead.email}: ${err.message}`);
    }
  }

  // Mark persona active
  await db
    .from('outreach_personas')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', persona_id);

  return NextResponse.json(results);
}
