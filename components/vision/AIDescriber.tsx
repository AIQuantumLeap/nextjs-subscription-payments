'use client';

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface AIDescriberProps {
  sourceCanvas: HTMLCanvasElement | null;
  isPro: boolean; // requires paid plan
}

interface DescriptionResult {
  description: string;
  objects: Array<{ name: string; confidence: number }>;
  scene: string;
  colors: string[];
  text_detected: string | null;
  timestamp: number;
}

export default function AIDescriber({ sourceCanvas, isPro }: AIDescriberProps) {
  const [result, setResult] = useState<DescriptionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeFrame = async () => {
    if (!sourceCanvas) { setError('No frame to analyze. Start the camera first.'); return; }
    if (!isPro) { setError('AI descriptions require a Pro subscription.'); return; }

    setLoading(true);
    setError('');

    try {
      // Convert canvas to base64 JPEG (compressed for API efficiency)
      const dataUrl = sourceCanvas.toDataURL('image/jpeg', 0.85);

      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const data: DescriptionResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isPro && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>AI image descriptions require a Pro plan. Upgrade to unlock this feature.</p>
        </div>
      )}

      <button
        onClick={analyzeFrame}
        disabled={loading || !sourceCanvas || !isPro}
        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors w-full justify-center"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Analyzing with AI…</>
        ) : (
          <><Sparkles size={16} /> Analyze Current Frame</>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Scene description */}
          <div className="bg-zinc-800/80 rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Scene</p>
            <p className="text-zinc-100 text-sm leading-relaxed">{result.description}</p>
            {result.scene && (
              <span className="inline-block mt-2 text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                {result.scene}
              </span>
            )}
          </div>

          {/* Detected objects */}
          {result.objects?.length > 0 && (
            <div className="bg-zinc-800/80 rounded-xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Objects</p>
              <ul className="space-y-1.5">
                {result.objects.map((obj, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-200 capitalize">{obj.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${obj.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-zinc-400 font-mono text-xs w-10 text-right">
                        {(obj.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Colors */}
          {result.colors?.length > 0 && (
            <div className="bg-zinc-800/80 rounded-xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Dominant Colors</p>
              <div className="flex flex-wrap gap-2">
                {result.colors.map((c, i) => (
                  <span key={i} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Text detected */}
          {result.text_detected && (
            <div className="bg-zinc-800/80 rounded-xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Text Detected</p>
              <p className="text-zinc-200 text-sm font-mono">{result.text_detected}</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-600">
            Analyzed at {new Date(result.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
