import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export const metadata = {
  title: 'OutreachOS — AI-Powered Email Outreach',
  description: 'Autonomous AI agent for B2B email outreach, lead qualification, and human handoff.'
};

const NAV = [
  { href: '/outreach',          label: 'Dashboard' },
  { href: '/outreach/persona',  label: 'Personas' },
  { href: '/outreach/leads',    label: 'Leads' },
  { href: '/outreach/settings', label: 'Settings' }
];

export default async function OutreachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top nav */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/90 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/outreach" className="text-sm font-bold tracking-tight text-white">
              OutreachOS
            </Link>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link href="/account" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Account
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
