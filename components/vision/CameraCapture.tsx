'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import { Camera, CameraOff, RefreshCw, SwitchCamera } from 'lucide-react';

export interface CameraCaptureHandle {
  captureFrame: () => HTMLCanvasElement | null;
  getVideo: () => HTMLVideoElement | null;
}

interface CameraCaptureProps {
  onFrame?: (canvas: HTMLCanvasElement) => void;
  frameRate?: number; // captures per second, 0 = manual only
  className?: string;
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;

const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(
  function CameraCapture(
    { onFrame, frameRate = 0, className = '' },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [permission, setPermission] = useState<PermissionState>('idle');
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);
    const [deviceId, setDeviceId] = useState<string>('');
    const [resolution, setResolution] = useState({ w: 0, h: 0 });
    const [error, setError] = useState('');

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      captureFrame: () => captureFrame(),
      getVideo: () => videoRef.current
    }));

    const captureFrame = useCallback((): HTMLCanvasElement | null => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = video.videoWidth || CAPTURE_WIDTH;
      canvas.height = video.videoHeight || CAPTURE_HEIGHT;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    }, []);

    const stopStream = useCallback(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const startCamera = useCallback(
      async (preferDeviceId?: string, preferFacing?: 'user' | 'environment') => {
        setPermission('requesting');
        setError('');
        stopStream();

        const facing = preferFacing ?? facingMode;

        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: preferDeviceId ? undefined : facing,
            deviceId: preferDeviceId ? { exact: preferDeviceId } : undefined
          },
          audio: false
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setResolution({
              w: videoRef.current.videoWidth,
              h: videoRef.current.videoHeight
            });
          }

          // Enumerate devices after permission granted
          const devices = await navigator.mediaDevices.enumerateDevices();
          setDeviceList(devices.filter((d) => d.kind === 'videoinput'));

          setPermission('granted');

          // Auto-capture loop
          if (frameRate > 0 && onFrame) {
            const ms = 1000 / frameRate;
            intervalRef.current = setInterval(() => {
              const frame = captureFrame();
              if (frame) onFrame(frame);
            }, ms);
          }
        } catch (err: any) {
          const msg =
            err?.name === 'NotAllowedError'
              ? 'Camera access denied. Please allow camera access in your browser settings.'
              : err?.name === 'NotFoundError'
                ? 'No camera found on this device.'
                : `Camera error: ${err?.message ?? 'Unknown error'}`;
          setError(msg);
          setPermission(err?.name === 'NotAllowedError' ? 'denied' : 'error');
        }
      },
      [captureFrame, facingMode, frameRate, onFrame, stopStream]
    );

    const toggleFacing = useCallback(() => {
      const next = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(next);
      startCamera(undefined, next);
    }, [facingMode, startCamera]);

    const switchDevice = useCallback(
      (id: string) => {
        setDeviceId(id);
        startCamera(id);
      },
      [startCamera]
    );

    // Clean up on unmount
    useEffect(() => {
      return () => { stopStream(); };
    }, [stopStream]);

    return (
      <div className={`relative flex flex-col gap-3 ${className}`}>
        {/* Video element */}
        <div className="relative overflow-hidden rounded-xl bg-zinc-900 aspect-video w-full">
          {permission !== 'granted' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-400">
              {permission === 'idle' && (
                <>
                  <Camera size={48} className="opacity-40" />
                  <p className="text-sm">Camera not started</p>
                </>
              )}
              {permission === 'requesting' && (
                <>
                  <RefreshCw size={32} className="animate-spin opacity-60" />
                  <p className="text-sm">Requesting camera access…</p>
                </>
              )}
              {(permission === 'denied' || permission === 'error') && (
                <>
                  <CameraOff size={48} className="text-red-500 opacity-60" />
                  <p className="text-sm text-red-400 text-center max-w-xs px-4">
                    {error}
                  </p>
                </>
              )}
            </div>
          )}

          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${permission === 'granted' ? 'block' : 'invisible'}`}
            playsInline
            muted
            autoPlay
          />

          {/* Resolution badge */}
          {permission === 'granted' && resolution.w > 0 && (
            <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-zinc-300 px-2 py-0.5 rounded">
              {resolution.w}×{resolution.h}
            </span>
          )}

          {/* Flip camera button (visible on mobile) */}
          {permission === 'granted' && (
            <button
              onClick={toggleFacing}
              className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Switch camera"
            >
              <SwitchCamera size={18} />
            </button>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {permission !== 'granted' ? (
            <button
              onClick={() => startCamera()}
              disabled={permission === 'requesting'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Camera size={16} />
              {permission === 'requesting' ? 'Starting…' : 'Start Camera'}
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <CameraOff size={16} />
              Stop Camera
            </button>
          )}

          {/* Device selector */}
          {deviceList.length > 1 && (
            <select
              value={deviceId}
              onChange={(e) => switchDevice(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg"
            >
              {deviceList.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }
);

export default CameraCapture;
