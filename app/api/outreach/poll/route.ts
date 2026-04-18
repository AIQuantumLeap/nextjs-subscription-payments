import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getNewReplies, extractTextBody, sendEmail } from '@/utils/outreach/gmail';
import { processIncomingEmail, type PersonaConfig, type MessageContext } from '@/utils/outreach/claude';

// Called by Vercel Cron (every 5 min) or manually.
// Secure with CRON_SECRET so only the cron job can call it.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const processed: string[] = [];
  const errors: string[] = [];

  // Find all active conversations across all users
  const { data: conversations, error } = await (supabase as any)
    .from('outreach_conversations')
    .select(`
      *,
      outreach_leads!inner(
        id, user_id, first_name, last_name, email, company, status, persona_id,
        outreach_personas(*)
      )
    `)
    .eq('status', 'active')
    .not('gmail_thread_id', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ message: 'No active conversations', processed: 0 });
  }

  for (const conv of conversations) {
    const lead = conv.outreach_leads;
    const persona = lead?.outreach_personas;
    if (!lead || !persona) continue;

    try {
      // Fetch Gmail connection for this user
      const { data: gmail } = await (supabase as any)
        .from('gmail_connections')
        .select('*')
        .eq('user_id', lead.user_id)
        .single();

      if (!gmail) continue;

      // Check schedule
      const { data: settings } = await (supabase as any)
        .from('outreach_settings')
        .select('*')
        .eq('user_id', lead.user_id)
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
          continue; // Outside schedule
        }
      }

      const lastProcessed = conv.last_processed_at
        ? new Date(conv.last_processed_at)
        : new Date(conv.created_at);

      // Get new replies from Gmail
      const newReplies = await getNewReplies(
        gmail.access_token,
        gmail.refresh_token,
        conv.gmail_thread_id,
        gmail.email,
        lastProcessed
      );

      if (newReplies.length === 0) continue;

      // Take the latest reply
      const latestReply = newReplies[newReplies.length - 1];
      const inboundBody = extractTextBody(latestReply.body);

      if (!inboundBody.trim()) continue;

      // Store inbound message
      await (supabase as any).from('outreach_messages').insert({
        conversation_id: conv.id,
        direction: 'inbound',
        subject: latestReply.subject,
        body: inboundBody,
        gmail_message_id: latestReply.id,
        sent_at: latestReply.internalDate.toISOString()
      });

      // Load full message history for Claude context
      const { data: allMessages } = await (supabase as any)
        .from('outreach_messages')
        .select('direction, subject, body')
        .eq('conversation_id', conv.id)
        .order('sent_at', { ascending: true });

      const messageHistory: MessageContext[] = (allMessages ?? []).slice(0, -1); // exclude just-stored inbound

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

      // Process with Claude
      const analysis = await processIncomingEmail(
        personaConfig,
        { first_name: lead.first_name, last_name: lead.last_name, company: lead.company, email: lead.email },
        messageHistory,
        { direction: 'inbound', subject: latestReply.subject, body: inboundBody },
        conv.exchange_count,
        conv.qualification_answers ?? {}
      );

      // Handle unsubscribe
      if (analysis.is_unsubscribe) {
        await (supabase as any).from('outreach_leads').update({ status: 'unsubscribed', updated_at: new Date().toISOString() }).eq('id', lead.id);
        await (supabase as any).from('outreach_conversations').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', conv.id);
        processed.push(`unsubscribe: ${lead.email}`);
        continue;
      }

      // Merge qualification answers
      const mergedAnswers = { ...(conv.qualification_answers ?? {}), ...analysis.qualification_answers };

      // Handle qualification decisions
      if (analysis.should_handoff || analysis.should_qualify) {
        const newStatus = analysis.should_qualify ? 'qualified' : 'handed_off';

        await (supabase as any).from('outreach_leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', lead.id);
        await (supabase as any).from('outreach_conversations').update({
          status: 'handed_off',
          qualification_answers: mergedAnswers,
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);

        // Create handoff record
        await (supabase as any).from('outreach_handoffs').insert({
          lead_id: lead.id,
          conversation_id: conv.id,
          summary: analysis.handoff_summary ?? `${lead.first_name} ${lead.last_name} from ${lead.company} has been qualified.`,
          qualification_answers: mergedAnswers,
          recommended_next_step: analysis.recommended_next_step ?? 'Schedule a discovery call'
        });

        // Update usage
        await (supabase as any).rpc('increment_outreach_usage', { p_user_id: lead.user_id, p_field: 'leads_qualified' });
        await (supabase as any).rpc('increment_outreach_usage', { p_user_id: lead.user_id, p_field: 'handoffs_made' });

        processed.push(`qualified/handoff: ${lead.email}`);
        continue;
      }

      if (analysis.should_disqualify) {
        await (supabase as any).from('outreach_leads').update({ status: 'disqualified', updated_at: new Date().toISOString() }).eq('id', lead.id);
        await (supabase as any).from('outreach_conversations').update({
          status: 'completed',
          qualification_answers: mergedAnswers,
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
        await (supabase as any).rpc('increment_outreach_usage', { p_user_id: lead.user_id, p_field: 'leads_disqualified' });
        processed.push(`disqualified: ${lead.email}`);
        continue;
      }

      // Send reply
      if (analysis.should_reply && analysis.email_body) {
        const { messageId } = await sendEmail(
          gmail.access_token,
          gmail.refresh_token,
          lead.email,
          analysis.email_subject,
          analysis.email_body,
          latestReply.messageIdHeader,
          conv.gmail_thread_id
        );

        await (supabase as any).from('outreach_messages').insert({
          conversation_id: conv.id,
          direction: 'outbound',
          subject: analysis.email_subject,
          body: analysis.email_body,
          gmail_message_id: messageId,
          sent_at: new Date().toISOString()
        });

        await (supabase as any).from('outreach_conversations').update({
          exchange_count: conv.exchange_count + 1,
          qualification_answers: mergedAnswers,
          last_processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
      } else {
        // No reply — update last_processed_at only
        await (supabase as any).from('outreach_conversations').update({
          qualification_answers: mergedAnswers,
          last_processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
      }

      processed.push(`replied: ${lead.email}`);
    } catch (err: any) {
      errors.push(`${lead?.email ?? conv.id}: ${err.message}`);
    }
  }

  return NextResponse.json({ processed: processed.length, results: processed, errors });
}
