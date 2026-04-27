'use client';

import { useEffect, useState } from 'react';

interface Metrics {
  this_month: {
    contacts_reached: number;
    leads_qualified: number;
    leads_disqualified: number;
    handoffs_made: number;
    meetings_booked: number;
  };
  total_leads: number;
  active_conversations: number;
  pending_handoffs: number;
}

const EMPTY: Metrics = {
  this_month: { contacts_reached: 0, leads_qualified: 0, leads_disqualified: 0, handoffs_made: 0, meetings_booked: 0 },
  total_leads: 0,
  active_conversations: 0,
  pending_handoffs: 0
};

export default function MetricsGrid() {
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/outreach/metrics')
      .then((r) => r.json())
      .then((d) => { setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Contacts Reached', value: metrics.this_month.contacts_reached, sub: 'this month', color: 'text-blue-400' },
    { label: 'Active Conversations', value: metrics.active_conversations, sub: 'in progress', color: 'text-emerald-400' },
    { label: 'Leads Qualified', value: metrics.this_month.leads_qualified, sub: 'this month', color: 'text-violet-400' },
    { label: 'Disqualified', value: metrics.this_month.leads_disqualified, sub: 'this month', color: 'text-zinc-500' },
    { label: 'Handoffs Made', value: metrics.this_month.handoffs_made, sub: 'this month', color: 'text-amber-400' },
    { label: 'Pending Handoffs', value: metrics.pending_handoffs, sub: 'awaiting review', color: metrics.pending_handoffs > 0 ? 'text-red-400' : 'text-zinc-500' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${c.color} ${loading ? 'opacity-30' : ''}`}>
            {loading ? '–' : c.value.toLocaleString()}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
