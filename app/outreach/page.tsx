import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import MetricsGrid from '@/components/outreach/MetricsGrid';
import HandoffCard from '@/components/outreach/HandoffCard';
import Link from 'next/link';

export default async function OutreachDashboard() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return null;

  // Fetch pending handoffs server-side
  const userLeadIds = (
    await supabase.from('outreach_leads').select('id').eq('user_id', user.id)
  ).data?.map((l: any) => l.id) ?? [];

  const { data: pendingHandoffs } = userLeadIds.length
    ? await supabase
        .from('outreach_handoffs')
        .select('*, outreach_leads(first_name, last_name, email, company, job_title)')
        .in('lead_id', userLeadIds)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] };

  const { data: personas } = await supabase
    .from('outreach_personas')
    .select('id, name, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: gmailConn } = await supabase
    .from('gmail_connections')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-powered outreach overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/outreach/leads" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm px-4 py-2 rounded-lg transition-colors">
            View Leads
          </Link>
          <Link href="/outreach/persona" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Manage Personas
          </Link>
        </div>
      </div>

      {/* Gmail status banner */}
      {!gmailConn && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-amber-300">Gmail is not connected. Connect it to start sending emails.</p>
          <Link href="/outreach/settings" className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Connect Gmail →
          </Link>
        </div>
      )}

      {/* Metrics */}
      <MetricsGrid />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending handoffs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-300">Pending Handoffs</h2>
            {(pendingHandoffs?.length ?? 0) > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                {pendingHandoffs!.length} new
              </span>
            )}
          </div>
          {!pendingHandoffs || pendingHandoffs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-sm text-zinc-500">No pending handoffs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingHandoffs.map((h: any) => (
                <HandoffCard key={h.id} handoff={h} />
              ))}
            </div>
          )}
        </section>

        {/* Active personas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-300">Personas</h2>
            <Link href="/outreach/persona/new" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              + New
            </Link>
          </div>
          {!personas || personas.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-sm text-zinc-500 mb-2">No personas yet.</p>
              <Link href="/outreach/persona/new" className="text-sm text-blue-400 hover:text-blue-300">
                Create your first persona →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {personas.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-sm text-zinc-200">{p.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/outreach/persona/${p.id}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
