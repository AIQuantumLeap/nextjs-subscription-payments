'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, CheckCircle2 } from 'lucide-react';

export interface BarcodeResult {
  format: string;
  value: string;
  timestamp: number;
}

interface BarcodeScannerProps {
  videoElement: HTMLVideoElement | null;
  isRunning: boolean;
  onResult?: (result: BarcodeResult) => void;
}

export default function BarcodeScanner({
  videoElement,
  isRunning,
  onResult
}: BarcodeScannerProps) {
  const [results, setResults] = useState<BarcodeResult[]>([]);
  const [scannerState, setScannerState] = useState<'idle' | 'loading' | 'scanning' | 'error'>('idle');
  const runningRef = useRef(false);
  const decoderRef = useRef<any>(null);
  const lastValueRef = useRef<string>('');

  useEffect(() => {
    if (!isRunning || scannerState !== 'idle') return;
    setScannerState('loading');

    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      decoderRef.current = new BrowserMultiFormatReader();
      setScannerState('scanning');
    }).catch(() => setScannerState('error'));

    return () => {
      if (decoderRef.current?.reset) decoderRef.current.reset();
    };
  }, [isRunning, scannerState]);

  const scanFrame = useCallback(async () => {
    if (!videoElement || !decoderRef.current || !isRunning) return;
    try {
      const result = await decoderRef.current.decodeFromVideoElement(videoElement);
      if (result) {
        const value = result.getText();
        const format = result.getBarcodeFormat().toString();

        // Debounce: skip if same value scanned within 2s
        if (value === lastValueRef.current) return;
        lastValueRef.current = value;
        setTimeout(() => { lastValueRef.current = ''; }, 2000);

        const barcodeResult: BarcodeResult = { format, value, timestamp: Date.now() };
        setResults((prev) => [barcodeResult, ...prev.slice(0, 19)]);
        onResult?.(barcodeResult);
      }
    } catch {
      // No barcode in frame — normal
    }
  }, [videoElement, isRunning, onResult]);

  useEffect(() => {
    if (!isRunning || scannerState !== 'scanning') { runningRef.current = false; return; }
    runningRef.current = true;

    let frameId: number;
    const loop = () => {
      if (!runningRef.current) return;
      scanFrame().then(() => {
        frameId = requestAnimationFrame(loop);
      });
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(frameId);
    };
  }, [isRunning, scannerState, scanFrame]);

  // Reset when stopped
  useEffect(() => {
    if (!isRunning) {
      setScannerState('idle');
      if (decoderRef.current?.reset) decoderRef.current.reset();
      decoderRef.current = null;
      lastValueRef.current = '';
    }
  }, [isRunning]);

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {scannerState === 'loading' && (
          <><QrCode size={16} className="animate-pulse text-blue-400" />
            <span className="text-zinc-400">Loading barcode decoder…</span></>
        )}
        {scannerState === 'scanning' && (
          <><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-zinc-400">Scanning for barcodes &amp; QR codes…</span></>
        )}
        {scannerState === 'error' && (
          <span className="text-red-400">Barcode decoder failed to load</span>
        )}
        {scannerState === 'idle' && (
          <span className="text-zinc-500">Barcode scanner not started</span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className="flex gap-3 items-start px-3 py-2 rounded-lg bg-zinc-800/80"
            >
              <CheckCircle2 size={16} className="mt-0.5 text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-mono text-zinc-500 uppercase">{r.format}</p>
                <p className="text-sm text-zinc-100 break-all font-medium">{r.value}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(r.value)}
                className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                Copy
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-600 py-2">
          Point the camera at a barcode, QR code, Data Matrix, PDF417, or other supported format.
        </p>
      )}
    </div>
  );
}
