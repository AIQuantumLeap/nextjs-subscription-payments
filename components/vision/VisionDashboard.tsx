'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Eye,
  ScanLine,
  Cpu,
  Layers,
  Sparkles,
  Download,
  Info
} from 'lucide-react';
import CameraCapture, { type CameraCaptureHandle } from './CameraCapture';
import ObjectDetector from './ObjectDetector';
import BarcodeScanner from './BarcodeScanner';
import ImageProcessingPanel from './ImageProcessingPanel';
import AIDescriber from './AIDescriber';

type Tab = 'objects' | 'barcodes' | 'processing' | 'ai_describe';

const TABS: { id: Tab; label: string; icon: React.ReactNode; proOnly?: boolean }[] = [
  { id: 'objects', label: 'Objects', icon: <Eye size={15} /> },
  { id: 'barcodes', label: 'Barcodes', icon: <ScanLine size={15} /> },
  { id: 'processing', label: 'Processing', icon: <Layers size={15} /> },
  { id: 'ai_describe', label: 'AI Describe', icon: <Sparkles size={15} />, proOnly: true }
];

interface VisionDashboardProps {
  isPro: boolean;
  userId: string;
}

export default function VisionDashboard({ isPro, userId }: VisionDashboardProps) {
  const cameraRef = useRef<CameraCaptureHandle>(null);
  const [activeTab, setActiveTab] = useState<Tab>('objects');
  const [cameraCanvas, setCameraCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Called by CameraCapture each frame (when frameRate > 0)
  const handleFrame = useCallback((canvas: HTMLCanvasElement) => {
    setCameraCanvas(canvas);
  }, []);

  // Download current processed frame
  const downloadFrame = useCallback(() => {
    const canvas = cameraRef.current?.captureFrame();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `vision-frame-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }, []);

  // Manual frame capture for on-demand tabs
  const captureForTab = useCallback(() => {
    const canvas = cameraRef.current?.captureFrame();
    if (canvas) setCameraCanvas(canvas);
    return canvas ?? null;
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vision Studio</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Real-time AI computer vision in your browser
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPro && (
              <span className="text-xs bg-purple-600/20 border border-purple-500/30 text-purple-400 px-2.5 py-1 rounded-full font-medium">
                Pro
              </span>
            )}
            <button
              onClick={downloadFrame}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              <Download size={14} />
              Save Frame
            </button>
          </div>
        </div>

        {/* Main layout: camera left, tools right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Camera column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Cpu size={14} className="text-blue-400" />
                Camera
              </h2>
              <CameraCapture
                ref={cameraRef}
                onFrame={(canvas) => {
                  setCameraCanvas(canvas);
                  // Ensure video ref is updated
                  const video = cameraRef.current?.getVideo();
                  if (video) videoRef.current = video;
                  setIsCameraActive(true);
                }}
                frameRate={activeTab === 'objects' || activeTab === 'processing' ? 10 : 0}
              />
            </div>

            {/* Quick info panel */}
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Info size={14} className="text-zinc-400" />
                Privacy
              </h2>
              <ul className="space-y-1.5 text-xs text-zinc-500">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Object detection &amp; image processing run entirely in your browser — no video is sent to our servers.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">!</span>
                  AI Describe sends a single compressed JPEG frame to OpenAI's API.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Camera stream is never recorded or stored without your action.
                </li>
              </ul>
            </div>
          </div>

          {/* Tools column */}
          <div className="lg:col-span-3">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-zinc-800 overflow-x-auto">
                {TABS.map((tab) => {
                  const locked = tab.proOnly && !isPro;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (locked) return;
                        setActiveTab(tab.id);
                        // Capture fresh frame for manual tabs
                        if (tab.id === 'barcodes' || tab.id === 'ai_describe') {
                          captureForTab();
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-zinc-400 hover:text-zinc-200'
                      } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.proOnly && (
                        <span className="text-[9px] bg-purple-600/30 text-purple-400 px-1.5 py-0.5 rounded uppercase">
                          Pro
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-4 sm:p-6">
                {activeTab === 'objects' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      Real-time object detection using COCO-SSD (80 object classes). Model runs locally in WebGL — no data leaves your device.
                    </p>
                    <ObjectDetector
                      sourceCanvas={cameraCanvas}
                      isRunning={isCameraActive}
                    />
                  </div>
                )}

                {activeTab === 'barcodes' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      Supports QR codes, barcodes (EAN, UPC, Code 128, Code 39), Data Matrix, PDF417, and more.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={captureForTab}
                        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                      >
                        Refresh Frame
                      </button>
                    </div>
                    <BarcodeScanner
                      videoElement={videoRef.current}
                      isRunning={isCameraActive}
                    />
                  </div>
                )}

                {activeTab === 'processing' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      Real-time image processing filters: thresholding, edge detection, morphology, histogram equalization, and feature point extraction.
                    </p>
                    <ImageProcessingPanel
                      sourceCanvas={cameraCanvas}
                      isRunning={isCameraActive}
                    />
                  </div>
                )}

                {activeTab === 'ai_describe' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      Capture a frame and send it to GPT-4 Vision for a detailed description including objects, scene type, colors, and any text detected.
                    </p>
                    <AIDescriber
                      sourceCanvas={cameraCanvas}
                      isPro={isPro}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Classification panel (always shown when camera active) */}
            {isCameraActive && cameraCanvas && activeTab === 'objects' && (
              <ClassificationPanel sourceCanvas={cameraCanvas} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Classification Panel ─────────────────────────────────────────────

function ClassificationPanel({ sourceCanvas }: { sourceCanvas: HTMLCanvasElement }) {
  const [classifications, setClassifications] = useState<
    Array<{ label: string; confidence: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const lastRunRef = useRef(0);

  const classify = useCallback(async () => {
    if (Date.now() - lastRunRef.current < 2000) return; // max once per 2s
    lastRunRef.current = Date.now();
    setLoading(true);
    try {
      const { classifyImage } = await import('@/utils/vision/tensorflowLoader');
      const results = await classifyImage(sourceCanvas, 5);
      setClassifications(results);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sourceCanvas]);

  return (
    <div className="mt-4 bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">Image Classification</h3>
        <button
          onClick={classify}
          disabled={loading}
          className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Classifying…' : 'Classify Frame'}
        </button>
      </div>
      {classifications.length > 0 && (
        <ul className="space-y-2">
          {classifications.map((c, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="text-zinc-300 text-sm flex-1 truncate capitalize">{c.label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-24 h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${c.confidence * 100}%` }}
                  />
                </div>
                <span className="text-zinc-400 font-mono text-xs w-10 text-right">
                  {(c.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!classifications.length && (
        <p className="text-xs text-zinc-600">Click "Classify Frame" to identify the scene.</p>
      )}
    </div>
  );
}

