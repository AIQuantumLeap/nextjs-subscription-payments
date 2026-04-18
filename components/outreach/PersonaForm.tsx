'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Objection {
  objection: string;
  response: string;
}

interface QualCriteria {
  question: string;
  qualifying_answer: string;
  disqualifying_answer: string;
}

interface PersonaFormProps {
  initial?: {
    id?: string;
    name?: string;
    company_name?: string;
    product_description?: string;
    industry?: string;
    tone?: string;
    value_propositions?: string[];
    objections?: Objection[];
    icp?: {
      job_titles?: string[];
      company_sizes?: string[];
      industries?: string[];
      geographies?: string[];
    };
    qualification_criteria?: QualCriteria[];
  };
}

const TONES = ['formal', 'conversational', 'technical'] as const;

export default function PersonaForm({ initial = {} }: PersonaFormProps) {
  const router = useRouter();
  const isEdit = !!initial.id;

  const [name, setName] = useState(initial.name ?? '');
  const [companyName, setCompanyName] = useState(initial.company_name ?? '');
  const [productDesc, setProductDesc] = useState(initial.product_description ?? '');
  const [industry, setIndustry] = useState(initial.industry ?? '');
  const [tone, setTone] = useState<string>(initial.tone ?? 'conversational');
  const [valueProps, setValueProps] = useState<string[]>(initial.value_propositions ?? ['']);
  const [objections, setObjections] = useState<Objection[]>(initial.objections ?? [{ objection: '', response: '' }]);
  const [icp, setIcp] = useState({
    job_titles: (initial.icp?.job_titles ?? []).join(', '),
    company_sizes: (initial.icp?.company_sizes ?? []).join(', '),
    industries: (initial.icp?.industries ?? []).join(', '),
    geographies: (initial.icp?.geographies ?? []).join(', ')
  });
  const [qualCriteria, setQualCriteria] = useState<QualCriteria[]>(
    initial.qualification_criteria ?? [{ question: '', qualifying_answer: '', disqualifying_answer: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name, company_name: companyName, product_description: productDesc,
      industry, tone,
      value_propositions: valueProps.filter(Boolean),
      objections: objections.filter((o) => o.objection && o.response),
      icp: {
        job_titles: parseList(icp.job_titles),
        company_sizes: parseList(icp.company_sizes),
        industries: parseList(icp.industries),
        geographies: parseList(icp.geographies)
      },
      qualification_criteria: qualCriteria.filter((c) => c.question)
    };

    const url = isEdit ? `/api/outreach/personas/${initial.id}` : '/api/outreach/personas';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
    router.push('/outreach/persona');
    router.refresh();
  };

  const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-zinc-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Basic info */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Agent Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Agent Name" hint="How the agent signs emails">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" className={inputCls} />
          </Field>
          <Field label="Company Name">
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" className={inputCls} />
          </Field>
        </div>
        <Field label="Product / Service Description" hint="1-2 sentences. Used to personalize every email.">
          <textarea required rows={3} value={productDesc} onChange={(e) => setProductDesc(e.target.value)} placeholder="We help B2B SaaS companies reduce churn by…" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Industry">
            <input required value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="B2B SaaS" className={inputCls} />
          </Field>
          <Field label="Communication Tone">
            <div className="flex gap-2 mt-0.5">
              {TONES.map((t) => (
                <button key={t} type="button" onClick={() => setTone(t)}
                  className={`flex-1 py-2 text-xs rounded-lg capitalize font-medium transition-colors ${tone === t ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {/* Value propositions */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Value Propositions</h2>
        {valueProps.map((vp, i) => (
          <div key={i} className="flex gap-2">
            <input value={vp} onChange={(e) => {
              const next = [...valueProps]; next[i] = e.target.value; setValueProps(next);
            }} placeholder={`Value prop ${i + 1}`} className={`${inputCls} flex-1`} />
            {valueProps.length > 1 && (
              <button type="button" onClick={() => setValueProps(valueProps.filter((_, j) => j !== i))}
                className="px-2 text-zinc-600 hover:text-red-400 transition-colors">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setValueProps([...valueProps, ''])}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          + Add value prop
        </button>
      </section>

      {/* Objections */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Objection Handling</h2>
        {objections.map((o, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <input value={o.objection} onChange={(e) => {
              const next = [...objections]; next[i].objection = e.target.value; setObjections(next);
            }} placeholder="e.g. We already use a tool for this" className={inputCls} />
            <div className="flex gap-2">
              <input value={o.response} onChange={(e) => {
                const next = [...objections]; next[i].response = e.target.value; setObjections(next);
              }} placeholder="How to address this objection" className={`${inputCls} flex-1`} />
              {objections.length > 1 && (
                <button type="button" onClick={() => setObjections(objections.filter((_, j) => j !== i))}
                  className="px-2 text-zinc-600 hover:text-red-400 transition-colors">✕</button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setObjections([...objections, { objection: '', response: '' }])}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          + Add objection
        </button>
      </section>

      {/* ICP */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Ideal Customer Profile (ICP)</h2>
        <p className="text-xs text-zinc-500">Comma-separated values. Used to qualify leads.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target Job Titles">
            <input value={icp.job_titles} onChange={(e) => setIcp({ ...icp, job_titles: e.target.value })} placeholder="VP Sales, Head of Growth" className={inputCls} />
          </Field>
          <Field label="Company Sizes">
            <input value={icp.company_sizes} onChange={(e) => setIcp({ ...icp, company_sizes: e.target.value })} placeholder="50-200, 200-1000" className={inputCls} />
          </Field>
          <Field label="Target Industries">
            <input value={icp.industries} onChange={(e) => setIcp({ ...icp, industries: e.target.value })} placeholder="SaaS, Fintech, E-commerce" className={inputCls} />
          </Field>
          <Field label="Geographic Focus">
            <input value={icp.geographies} onChange={(e) => setIcp({ ...icp, geographies: e.target.value })} placeholder="North America, UK" className={inputCls} />
          </Field>
        </div>
      </section>

      {/* Qualification criteria */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Qualification Criteria</h2>
        <p className="text-xs text-zinc-500">Questions the agent should gather answers to during the conversation.</p>
        {qualCriteria.map((c, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
            <input value={c.question} onChange={(e) => {
              const next = [...qualCriteria]; next[i].question = e.target.value; setQualCriteria(next);
            }} placeholder="e.g. What is your current monthly email volume?" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={c.qualifying_answer} onChange={(e) => {
                const next = [...qualCriteria]; next[i].qualifying_answer = e.target.value; setQualCriteria(next);
              }} placeholder="Qualifies if…" className={inputCls} />
              <div className="flex gap-2">
                <input value={c.disqualifying_answer} onChange={(e) => {
                  const next = [...qualCriteria]; next[i].disqualifying_answer = e.target.value; setQualCriteria(next);
                }} placeholder="Disqualifies if…" className={`${inputCls} flex-1`} />
                {qualCriteria.length > 1 && (
                  <button type="button" onClick={() => setQualCriteria(qualCriteria.filter((_, j) => j !== i))}
                    className="px-2 text-zinc-600 hover:text-red-400 transition-colors">✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
        <button type="button"
          onClick={() => setQualCriteria([...qualCriteria, { question: '', qualifying_answer: '', disqualifying_answer: '' }])}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          + Add qualification question
        </button>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Persona'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
