'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type LeadStatus = 'not_contacted' | 'in_conversation' | 'qualified' | 'disqualified' | 'handed_off' | 'unsubscribed';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  status: LeadStatus;
  created_at: string;
  outreach_personas: { name: string } | null;
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  not_contacted:   'bg-zinc-800 text-zinc-400',
  in_conversation: 'bg-blue-900/50 text-blue-300',
  qualified:       'bg-emerald-900/50 text-emerald-300',
  disqualified:    'bg-red-900/30 text-red-400',
  handed_off:      'bg-amber-900/40 text-amber-300',
  unsubscribed:    'bg-zinc-800 text-zinc-600 line-through'
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  not_contacted:   'Not Contacted',
  in_conversation: 'In Conversation',
  qualified:       'Qualified',
  disqualified:    'Disqualified',
  handed_off:      'Handed Off',
  unsubscribed:    'Unsubscribed'
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

export default function LeadTable({ personaId }: { personaId?: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(personaId ? { persona_id: personaId } : {})
    });
    const res = await fetch(`/api/outreach/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, statusFilter, personaId]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${!statusFilter ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
        >
          All ({total})
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${statusFilter === s ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80">
            <tr>
              {['Name', 'Email', 'Company', 'Persona', 'Status', 'Added'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3.5 bg-zinc-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No leads found.</td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/outreach/leads/${lead.id}`} className="font-medium text-zinc-200 hover:text-blue-400 transition-colors">
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{lead.email}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.company ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{lead.outreach_personas?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-xs">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{total} total leads</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-zinc-800 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-zinc-800 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
