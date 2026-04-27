'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Persona {
  id: string;
  name: string;
  company_name: string;
  industry: string;
  tone: string;
  is_active: boolean;
  created_at: string;
}

export default function PersonaListPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateResult, setActivateResult] = useState<{ id: string; sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/outreach/personas')
      .then((r) => r.json())
      .then((d) => { setPersonas(d); setLoading(false); });
  }, []);

  const handleActivate = async (personaId: string) => {
    setActivating(personaId);
    setActivateResult(null);
    const res = await fetch('/api/outreach/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId })
    });
    const data = await res.json();
    if (res.ok) {
      setActivateResult({ id: personaId, sent: data.sent ?? 0, failed: data.failed ?? 0 });
    } else {
      alert(data.error ?? 'Activation failed');
    }
    setActivating(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this persona?')) return;
    await fetch(`/api/outreach/personas/${id}`, { method: 'DELETE' });
    setPersonas((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Each persona is a unique AI agent configuration.</p>
        </div>
        <Link href="/outreach/persona/new" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Persona
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : personas.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400 font-medium mb-2">No personas yet</p>
          <p className="text-sm text-zinc-600 mb-4">
            A persona defines your AI agent's identity, tone, target customers, and qualification rules.
          </p>
          <Link href="/outreach/persona/new" className="text-blue-400 hover:text-blue-300 text-sm">
            Create your first persona →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((p) => (
            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${p.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <h3 className="font-semibold text-zinc-100">{p.name}</h3>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">{p.company_name}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span>Industry: {p.industry}</span>
                    <span>Tone: <span className="capitalize">{p.tone}</span></span>
                    <span>Created: {new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  {activateResult?.id === p.id && (
                    <p className="text-xs text-emerald-400 mt-2">
                      ✓ Sent {activateResult.sent} emails
                      {activateResult.failed > 0 && `, ${activateResult.failed} failed`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleActivate(p.id)}
                    disabled={activating === p.id}
                    className="text-xs bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {activating === p.id ? 'Sending…' : '▶ Activate Campaign'}
                  </button>
                  <Link href={`/outreach/persona/${p.id}`}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1.5 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info about polling */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          <strong className="text-zinc-400">How it works:</strong> Activating a campaign sends first-contact emails to all uncontacted leads assigned to this persona.
          The agent polls for replies every 5 minutes (configure via Vercel Cron or call <code className="bg-zinc-800 px-1 rounded">/api/outreach/poll</code> with your <code className="bg-zinc-800 px-1 rounded">CRON_SECRET</code>).
        </p>
      </div>
    </div>
  );
}
