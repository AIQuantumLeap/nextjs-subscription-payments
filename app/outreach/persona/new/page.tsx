import PersonaForm from '@/components/outreach/PersonaForm';

export const metadata = { title: 'New Persona — OutreachOS' };

export default function NewPersonaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Persona</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure your AI agent's identity and outreach rules.</p>
      </div>
      <PersonaForm />
    </div>
  );
}
