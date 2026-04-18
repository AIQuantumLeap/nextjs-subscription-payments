'use client';

import { useState } from 'react';

const DAYS = [
  { label: 'Su', value: 0 }, { label: 'Mo', value: 1 }, { label: 'Tu', value: 2 },
  { label: 'We', value: 3 }, { label: 'Th', value: 4 }, { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 }
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`
}));

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
  'Australia/Sydney', 'Pacific/Auckland'
];

interface ScheduleSettingsProps {
  initial: {
    handoff_email: string | null;
    active_days: number[];
    active_hours_start: number;
    active_hours_end: number;
    timezone: string;
  };
}

export default function ScheduleSettings({ initial }: ScheduleSettingsProps) {
  const [handoffEmail, setHandoffEmail] = useState(initial.handoff_email ?? '');
  const [activeDays, setActiveDays] = useState<number[]>(initial.active_days ?? [1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(initial.active_hours_start ?? 8);
  const [endHour, setEndHour] = useState(initial.active_hours_end ?? 18);
  const [timezone, setTimezone] = useState(initial.timezone ?? 'America/New_York');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleDay = (day: number) =>
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch('/api/outreach/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handoff_email: handoffEmail || null,
        active_days: activeDays,
        active_hours_start: startHour,
        active_hours_end: endHour,
        timezone
      })
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Handoff email */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Handoff Notification Email
        </label>
        <p className="text-xs text-zinc-500 mb-2">Where to send alerts when a lead is qualified for handoff.</p>
        <input
          type="email"
          value={handoffEmail}
          onChange={(e) => setHandoffEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Days */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Active Days</label>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => toggleDay(d.value)}
              className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                activeDays.includes(d.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Start Hour</label>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">End Hour</label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
