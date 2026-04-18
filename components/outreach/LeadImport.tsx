'use client';

import { useRef, useState } from 'react';

interface LeadImportProps {
  personas: { id: string; name: string }[];
  onImported?: (count: number) => void;
}

export default function LeadImport({ personas, onImported }: LeadImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [personaId, setPersonaId] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append('file', file);
    if (personaId) form.append('persona_id', personaId);

    const res = await fetch('/api/outreach/leads/import', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Import failed');
    } else {
      setResult(data);
      onImported?.(data.imported);
    }
    setImporting(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Persona assignment */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Assign to Persona (optional)</label>
        <select
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— No persona —</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-zinc-700 hover:border-zinc-500'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="text-3xl mb-2">📋</div>
        {importing ? (
          <p className="text-sm text-zinc-400">Importing…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-300">Drop CSV here or click to upload</p>
            <p className="text-xs text-zinc-500 mt-1">
              Required: <code className="text-zinc-400">first_name</code>, <code className="text-zinc-400">email</code>
              &nbsp;· Optional: <code className="text-zinc-400">last_name</code>, <code className="text-zinc-400">company</code>, <code className="text-zinc-400">job_title</code>
            </p>
          </>
        )}
      </div>

      {result && (
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-4 py-3">
          <p className="text-sm text-emerald-300">
            ✓ Imported <strong>{result.imported}</strong> leads
            {result.skipped > 0 && ` (${result.skipped} skipped — duplicate emails)`}
          </p>
        </div>
      )}
      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
