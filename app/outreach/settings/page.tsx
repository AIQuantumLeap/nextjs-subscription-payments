import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';
import GmailConnect from '@/components/outreach/GmailConnect';
import ScheduleSettings from '@/components/outreach/ScheduleSettings';

export const metadata = { title: 'Settings — OutreachOS' };

export default async function SettingsPage({
  searchParams
}: {
  searchParams: { gmail?: string; error?: string };
}) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');

  const db = supabase as any;
  const [{ data: gmailConn }, { data: settings }] = await Promise.all([
    db.from('gmail_connections').select('email').eq('user_id', user.id).maybeSingle(),
    db.from('outreach_settings').select('*').eq('user_id', user.id).maybeSingle()
  ]);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure your OutreachOS agent.</p>
      </div>

      {/* Gmail feedback banners */}
      {searchParams.gmail === 'connected' && (
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-4 py-3">
          <p className="text-sm text-emerald-300">✓ Gmail connected successfully.</p>
        </div>
      )}
      {searchParams.error === 'gmail_denied' && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
          <p className="text-sm text-red-300">Gmail connection was denied. Please try again.</p>
        </div>
      )}
      {searchParams.error === 'gmail_failed' && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
          <p className="text-sm text-red-300">Gmail connection failed. Check your Google Cloud Console credentials.</p>
        </div>
      )}

      {/* Gmail connection */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Gmail Integration</h2>
        <GmailConnect connectedEmail={gmailConn?.email ?? null} />
        <p className="text-xs text-zinc-600">
          Requires a Google OAuth client in your Google Cloud Console with Gmail API enabled.
          Set <code className="bg-zinc-800 px-1 rounded">GOOGLE_CLIENT_ID</code>, <code className="bg-zinc-800 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, and
          redirect URI to <code className="bg-zinc-800 px-1 rounded">{process.env.NEXT_PUBLIC_SITE_URL}/api/outreach/gmail/callback</code>.
        </p>
      </section>

      <hr className="border-zinc-800" />

      {/* Schedule */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Sending Schedule</h2>
        <p className="text-xs text-zinc-500">The agent only sends emails during these hours.</p>
        <ScheduleSettings
          initial={{
            handoff_email: settings?.handoff_email ?? null,
            active_days: settings?.active_days ?? [1, 2, 3, 4, 5],
            active_hours_start: settings?.active_hours_start ?? 8,
            active_hours_end: settings?.active_hours_end ?? 18,
            timezone: settings?.timezone ?? 'America/New_York'
          }}
        />
      </section>

      <hr className="border-zinc-800" />

      {/* Cron setup info */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-300">Polling Setup (Vercel Cron)</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Add this to your <code className="bg-zinc-800 px-1 rounded">vercel.json</code> to poll for replies every 5 minutes.
          Set <code className="bg-zinc-800 px-1 rounded">CRON_SECRET</code> in your environment variables.
        </p>
        <pre className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 overflow-x-auto">{`{
  "crons": [{
    "path": "/api/outreach/poll",
    "schedule": "*/5 * * * *"
  }]
}`}</pre>
        <p className="text-xs text-zinc-600">
          The poll endpoint is secured with <code className="bg-zinc-800 px-1 rounded">Authorization: Bearer CRON_SECRET</code>.
          Vercel automatically adds this header to cron requests when you set the env var.
        </p>
      </section>
    </div>
  );
}
