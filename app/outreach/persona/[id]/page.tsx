import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import PersonaForm from '@/components/outreach/PersonaForm';

export const metadata = { title: 'Edit Persona — OutreachOS' };

export default async function EditPersonaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) redirect('/signin');

  const { data: persona, error } = await (supabase as any)
    .from('outreach_personas')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !persona) redirect('/outreach/persona');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Persona</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{persona.name} · {persona.company_name}</p>
      </div>
      <PersonaForm initial={persona} />
    </div>
  );
}
