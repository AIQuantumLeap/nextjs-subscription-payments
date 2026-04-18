'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Handoff {
  id: string;
  lead_id: string;
  summary: string;
  qualification_answers: Record<string, string>;
  recommended_next_step: string | null;
  acknowledged: boolean;
  created_at: string;
  outreach_leads: {
    first_name: string;
    last_name: string;
    email: string;
    company: string | null;
    job_title: string | null;
  };
}

interface HandoffCardProps {
  handoff: Handoff;
  onAcknowledge?: (id: string) => void;
}

export default function HandoffCard({ handoff, onAcknowledge }: HandoffCardProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const lead = handoff.outreach_leads;
  const qaEntries = Object.entries(handoff.qualification_answers ?? {});

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    await fetch('/api/outreach/handoffs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: handoff.id })
    });
    setAcknowledging(false);
    onAcknowledge?.(handoff.id);
  };

  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 space-y-4 ${handoff.acknowledged ? 'border-zinc-800' : 'border-amber-500/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {!handoff.acknowledged && (
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            )}
            <Link href={`/outreach/leads/${handoff.lead_id}`} className="text-zinc-100 font-semibold hover:text-blue-400 transition-colors">
              {lead.first_name} {lead.last_name}
            </Link>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">
            {lead.job_title ? `${lead.job_title} at ` : ''}{lead.company ?? lead.email}
          </p>
        </div>
        <span className="text-[10px] text-zinc-500 shrink-0">
          {new Date(handoff.created_at).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed">{handoff.summary}</p>

      {qaEntries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Qualification Answers</p>
          {qaEntries.map(([q, a]) => (
            <div key={q} className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-[11px] text-zinc-400">{q}</p>
              <p className="text-sm text-zinc-200">{a}</p>
            </div>
          ))}
        </div>
      )}

      {handoff.recommended_next_step && (
        <div className="bg-blue-950/40 border border-blue-800/30 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-0.5">Recommended Next Step</p>
          <p className="text-sm text-zinc-200">{handoff.recommended_next_step}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Link
          href={`/outreach/leads/${handoff.lead_id}`}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View conversation →
        </Link>
        {!handoff.acknowledged && (
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        )}
      </div>
    </div>
  );
}
