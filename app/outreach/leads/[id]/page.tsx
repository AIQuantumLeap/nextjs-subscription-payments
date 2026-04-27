import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import ConversationThread from '@/components/outreach/ConversationThread';
import Link from 'next/link';

export const metadata = { title: 'Lead Detail — OutreachOS' };

const STATUS_STYLES: Record<string, string> = {
  not_contacted:   'bg-zinc-800 text-zinc-400',
  in_conversation: 'bg-blue-900/50 text-blue-300',
  qualified:       'bg-emerald-900/50 text-emerald-300',
  disqualified:    'bg-red-900/30 text-red-400',
  handed_off:      'bg-amber-900/40 text-amber-300',
  unsubscribed:    'bg-zinc-800 text-zinc-600'
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/outreach/leads/${params.id}`,
    { headers: { cookie: '' }, cache: 'no-store' }
  );

  // Fallback: query directly from server
  const { data: lead } = await (supabase as any)
    .from('outreach_leads')
    .select('*, outreach_personas(name, tone)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!lead) redirect('/outreach/leads');

  const { data: conversations } = await (supabase as any)
    .from('outreach_conversations')
    .select('*, outreach_messages(*)')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false });

  const { data: handoff } = await (supabase as any)
    .from('outreach_handoffs')
    .select('*')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestConv = conversations?.[0];
  const messages = latestConv?.outreach_messages
    ? [...latestConv.outreach_messages].sort(
        (a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      )
    : [];

  const personaName = lead.outreach_personas?.name ?? 'AI Agent';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/outreach/leads" className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
          ←
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[lead.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
              {lead.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">
            {lead.job_title ? `${lead.job_title} · ` : ''}{lead.company ?? ''} · {lead.email}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation thread */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-300">Email Thread</h2>
              {latestConv && (
                <span className="text-xs text-zinc-600">
                  {latestConv.exchange_count} exchange{latestConv.exchange_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ConversationThread
              messages={messages}
              leadName={`${lead.first_name} ${lead.last_name}`}
              agentName={personaName}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Lead info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Lead Info</h3>
            {[
              ['Email', lead.email],
              ['Company', lead.company],
              ['Title', lead.job_title],
              ['Persona', personaName]
            ].map(([label, val]) => val ? (
              <div key={label as string}>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-zinc-200">{val}</p>
              </div>
            ) : null)}

            {lead.context_fields && Object.keys(lead.context_fields).length > 0 && (
              <>
                <hr className="border-zinc-800" />
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Context</h3>
                {Object.entries(lead.context_fields).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{k}</p>
                    <p className="text-sm text-zinc-200">{v as string}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Qualification answers */}
          {latestConv?.qualification_answers &&
            Object.keys(latestConv.qualification_answers).length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Qualification Answers</h3>
              {Object.entries(latestConv.qualification_answers).map(([q, a]) => (
                <div key={q}>
                  <p className="text-[10px] text-zinc-500">{q}</p>
                  <p className="text-sm text-zinc-200">{a as string}</p>
                </div>
              ))}
            </div>
          )}

          {/* Handoff info */}
          {handoff && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-amber-500 font-semibold">Handoff</h3>
              <p className="text-sm text-zinc-300">{handoff.summary}</p>
              {handoff.recommended_next_step && (
                <div className="bg-blue-950/40 border border-blue-800/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider">Recommended</p>
                  <p className="text-sm text-zinc-200">{handoff.recommended_next_step}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
