'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, AlertCircle } from 'lucide-react';
import type { Detection } from '@/utils/vision/tensorflowLoader';
import { drawDetections } from '@/utils/vision/imageProcessing';

interface ObjectDetectorProps {
  sourceCanvas: HTMLCanvasElement | null;
  isRunning: boolean;
  onResults?: (detections: Detection[]) => void;
}

const LABEL_COLORS: Record<string, string> = {
  person: '#ff4444',
  car: '#44aaff',
  bicycle: '#44ffaa',
  dog: '#ffaa44',
  cat: '#ff44ff',
  bottle: '#44ffff',
  chair: '#aaff44',
  laptop: '#ff8844',
  default: '#00ff88'
};

function colorForLabel(label: string) {
  return LABEL_COLORS[label.toLowerCase()] ?? LABEL_COLORS.default;
}

export default function ObjectDetector({
  sourceCanvas,
  isRunning,
  onResults
}: ObjectDetectorProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [fps, setFps] = useState(0);
  const runningRef = useRef(false);
  const fpsCountRef = useRef(0);
  const fpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy-load model on first activation
  useEffect(() => {
    if (!isRunning || modelState !== 'idle') return;
    setModelState('loading');

    import('@/utils/vision/tensorflowLoader')
      .then(({ loadCocoSsd }) => loadCocoSsd())
      .then(() => setModelState('ready'))
      .catch(() => setModelState('error'));
  }, [isRunning, modelState]);

  // FPS counter
  useEffect(() => {
    fpsTimerRef.current = setInterval(() => {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
    }, 1000);
    return () => {
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
    };
  }, []);

  // Inference loop
  const runInference = useCallback(async () => {
    if (!sourceCanvas || !isRunning || modelState !== 'ready') return;
    const { detectObjects } = await import('@/utils/vision/tensorflowLoader');

    try {
      const results = await detectObjects(sourceCanvas, 20, 0.4);

      // Draw on overlay canvas
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = sourceCanvas.width;
        overlay.height = sourceCanvas.height;
        const ctx = overlay.getContext('2d')!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.drawImage(sourceCanvas, 0, 0);
        drawDetections(overlay, results.map((d) => ({ ...d, color: colorForLabel(d.label) })));
      }

      setDetections(results);
      onResults?.(results);
      fpsCountRef.current++;
    } catch {
      // Inference error — skip frame
    }
  }, [sourceCanvas, isRunning, modelState, onResults]);

  // Drive inference loop
  useEffect(() => {
    if (!isRunning || modelState !== 'ready') { runningRef.current = false; return; }
    runningRef.current = true;

    let frameId: number;
    const loop = () => {
      if (!runningRef.current) return;
      runInference().then(() => { frameId = requestAnimationFrame(loop); });
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(frameId);
    };
  }, [isRunning, modelState, runInference]);

  return (
    <div className="space-y-3">
      {/* Overlay canvas */}
      <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video w-full">
        {modelState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-400">
            <Cpu size={24} className="animate-pulse" />
            <span className="text-sm">Loading object detection model…</span>
          </div>
        )}
        {modelState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-red-400">
            <AlertCircle size={20} />
            <span className="text-sm">Model load failed</span>
          </div>
        )}
        <canvas
          ref={overlayRef}
          className="w-full h-full object-contain"
          style={{ display: modelState === 'ready' ? 'block' : 'none' }}
        />
        {isRunning && modelState === 'ready' && (
          <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-green-400 px-2 py-0.5 rounded font-mono">
            {fps} fps · {detections.length} object{detections.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Detection list */}
      {detections.length > 0 && (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {detections.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/80 text-sm"
            >
              <span
                className="font-medium capitalize"
                style={{ color: colorForLabel(d.label) }}
              >
                {d.label}
              </span>
              <span className="text-zinc-400 font-mono text-xs">
                {(d.confidence * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
