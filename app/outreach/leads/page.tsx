import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { redirect } from 'next/navigation';
import LeadTable from '@/components/outreach/LeadTable';
import LeadImport from '@/components/outreach/LeadImport';

export const metadata = { title: 'Leads — OutreachOS' };

export default async function LeadsPage() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');

  const { data: personas } = await supabase
    .from('outreach_personas')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All contacts in your outreach pipeline.</p>
        </div>
      </div>

      {/* Import section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Import Leads via CSV</h2>
        <LeadImport personas={personas ?? []} />
      </section>

      {/* Lead table */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">All Leads</h2>
        <LeadTable />
      </section>
    </div>
  );
}
