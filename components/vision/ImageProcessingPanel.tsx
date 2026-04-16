'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  threshold,
  otsuThreshold,
  adaptiveThreshold,
  grayscale,
  sobelEdges,
  laplacianEdges,
  prewittEdges,
  boxBlur,
  sharpen,
  dilate,
  erode,
  histogramEqualization,
  falseColor,
  detectFeaturePoints,
  colorStats,
  imageDataToCanvas,
  drawFeaturePoints,
  type FeaturePoint,
  type ColorStats
} from '@/utils/vision/imageProcessing';

type ProcessingMode =
  | 'original'
  | 'grayscale'
  | 'threshold_binary'
  | 'threshold_otsu'
  | 'threshold_adaptive'
  | 'edge_sobel'
  | 'edge_laplacian'
  | 'edge_prewitt'
  | 'blur'
  | 'sharpen'
  | 'dilate'
  | 'erode'
  | 'histogram_eq'
  | 'false_color'
  | 'features';

interface ModeConfig {
  label: string;
  group: string;
  description: string;
}

const MODES: Record<ProcessingMode, ModeConfig> = {
  original: { label: 'Original', group: 'View', description: 'Unmodified frame' },
  grayscale: { label: 'Grayscale', group: 'Color', description: 'Luminance conversion (BT.709)' },
  false_color: { label: 'False Color', group: 'Color', description: 'Heatmap colorization' },
  threshold_binary: { label: 'Binary Threshold', group: 'Threshold', description: 'Manual threshold value' },
  threshold_otsu: { label: "Otsu's Method", group: 'Threshold', description: 'Automatic optimal threshold' },
  threshold_adaptive: { label: 'Adaptive', group: 'Threshold', description: 'Local adaptive threshold' },
  edge_sobel: { label: 'Sobel', group: 'Edges', description: 'Gradient magnitude (Sobel)' },
  edge_laplacian: { label: 'Laplacian', group: 'Edges', description: 'Second-derivative edges' },
  edge_prewitt: { label: 'Prewitt', group: 'Edges', description: 'Gradient magnitude (Prewitt)' },
  blur: { label: 'Box Blur', group: 'Filter', description: 'Uniform smoothing filter' },
  sharpen: { label: 'Sharpen', group: 'Filter', description: 'Unsharp mask enhancement' },
  dilate: { label: 'Dilation', group: 'Morphology', description: 'Morphological expansion' },
  erode: { label: 'Erosion', group: 'Morphology', description: 'Morphological shrink' },
  histogram_eq: { label: 'Histogram EQ', group: 'Enhance', description: 'Contrast equalization' },
  features: { label: 'Feature Points', group: 'Detect', description: 'Harris corner detection' }
};

interface ImageProcessingPanelProps {
  sourceCanvas: HTMLCanvasElement | null;
  isRunning: boolean;
}

export default function ImageProcessingPanel({
  sourceCanvas,
  isRunning
}: ImageProcessingPanelProps) {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ProcessingMode>('original');
  const [thresholdValue, setThresholdValue] = useState(128);
  const [blurRadius, setBlurRadius] = useState(3);
  const [featurePoints, setFeaturePoints] = useState<FeaturePoint[]>([]);
  const [otsuValue, setOtsuValue] = useState<number | null>(null);
  const [stats, setStats] = useState<ColorStats | null>(null);
  const frameRef = useRef<number>(0);
  const runningRef = useRef(false);

  const processFrame = useCallback(() => {
    if (!sourceCanvas || !outputRef.current) return;
    const ctx = outputRef.current.getContext('2d');
    if (!ctx) return;

    outputRef.current.width = sourceCanvas.width;
    outputRef.current.height = sourceCanvas.height;

    const imgData = (() => {
      const c = document.createElement('canvas');
      c.width = sourceCanvas.width;
      c.height = sourceCanvas.height;
      c.getContext('2d')!.drawImage(sourceCanvas, 0, 0);
      return c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    })();

    let result: ImageData;
    let pts: FeaturePoint[] = [];

    switch (mode) {
      case 'original':
        ctx.drawImage(sourceCanvas, 0, 0);
        return;
      case 'grayscale':
        result = grayscale(imgData);
        break;
      case 'false_color':
        result = falseColor(imgData);
        break;
      case 'threshold_binary':
        result = threshold(imgData, thresholdValue);
        break;
      case 'threshold_otsu': {
        const [r, t] = otsuThreshold(imgData);
        result = r;
        setOtsuValue(t);
        break;
      }
      case 'threshold_adaptive':
        result = adaptiveThreshold(imgData, 15, 2);
        break;
      case 'edge_sobel':
        [result] = sobelEdges(imgData);
        break;
      case 'edge_laplacian':
        result = laplacianEdges(imgData);
        break;
      case 'edge_prewitt':
        result = prewittEdges(imgData);
        break;
      case 'blur':
        result = boxBlur(imgData, blurRadius);
        break;
      case 'sharpen':
        result = sharpen(imgData, 1.5);
        break;
      case 'dilate':
        result = dilate(imgData, 2);
        break;
      case 'erode':
        result = erode(imgData, 2);
        break;
      case 'histogram_eq':
        result = histogramEqualization(imgData);
        break;
      case 'features': {
        pts = detectFeaturePoints(imgData, 80, 0.01);
        setFeaturePoints(pts);
        result = grayscale(imgData);
        break;
      }
      default:
        ctx.drawImage(sourceCanvas, 0, 0);
        return;
    }

    ctx.putImageData(result!, 0, 0);

    // Draw feature point overlay
    if (mode === 'features' && pts.length > 0) {
      drawFeaturePoints(outputRef.current, pts);
    }

    // Compute color stats periodically (every ~10 frames)
    if (Math.random() < 0.1) {
      setStats(colorStats(imgData));
    }
  }, [sourceCanvas, mode, thresholdValue, blurRadius]);

  // Animation loop
  useEffect(() => {
    if (!isRunning) { runningRef.current = false; return; }
    runningRef.current = true;

    const loop = () => {
      if (!runningRef.current) return;
      processFrame();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [isRunning, processFrame]);

  const groups = Array.from(new Set(Object.values(MODES).map((m) => m.group)));

  return (
    <div className="space-y-4">
      {/* Output canvas */}
      <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video w-full">
        <canvas ref={outputRef} className="w-full h-full object-contain" />
        {mode === 'features' && featurePoints.length > 0 && (
          <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-yellow-400 px-2 py-0.5 rounded">
            {featurePoints.length} feature points
          </span>
        )}
        {mode === 'threshold_otsu' && otsuValue !== null && (
          <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-blue-400 px-2 py-0.5 rounded">
            Otsu threshold: {otsuValue}
          </span>
        )}
      </div>

      {/* Mode selector by group */}
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(MODES) as [ProcessingMode, ModeConfig][])
                .filter(([, cfg]) => cfg.group === group)
                .map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      mode === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                    title={cfg.description}
                  >
                    {cfg.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Parameter controls */}
      {mode === 'threshold_binary' && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400 w-28">Threshold ({thresholdValue})</label>
          <input
            type="range"
            min={0}
            max={255}
            value={thresholdValue}
            onChange={(e) => setThresholdValue(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
        </div>
      )}
      {mode === 'blur' && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400 w-28">Radius ({blurRadius})</label>
          <input
            type="range"
            min={1}
            max={10}
            value={blurRadius}
            onChange={(e) => setBlurRadius(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
        </div>
      )}

      {/* Color stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div key={ch} className="bg-zinc-800/80 rounded-lg px-3 py-2">
              <p className="text-zinc-500 uppercase">{ch}</p>
              <p className="font-mono text-zinc-200">{stats.mean[ch]}</p>
            </div>
          ))}
          <div className="col-span-3 bg-zinc-800/80 rounded-lg px-3 py-2 flex items-center gap-3">
            <div
              className="w-5 h-5 rounded border border-zinc-600 shrink-0"
              style={{ backgroundColor: stats.dominantColor.hex }}
            />
            <div>
              <p className="text-zinc-500 text-[10px]">Dominant color</p>
              <p className="font-mono text-zinc-200">{stats.dominantColor.hex}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mode description */}
      <p className="text-[11px] text-zinc-600">{MODES[mode].description}</p>
    </div>
  );
}
