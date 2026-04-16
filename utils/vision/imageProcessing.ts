/**
 * Client-side image processing utilities using Canvas API.
 * All processing is done in-browser for privacy and performance.
 */

export interface ProcessingResult {
  type: string;
  canvas: HTMLCanvasElement;
  metadata: Record<string, unknown>;
}

export interface ColorStats {
  mean: { r: number; g: number; b: number };
  histogram: { r: number[]; g: number[]; b: number[]; gray: number[] };
  dominantColor: { r: number; g: number; b: number; hex: string };
}

export interface FeaturePoint {
  x: number;
  y: number;
  strength: number;
}

// ─── Frame Capture ────────────────────────────────────────────────────────────

/**
 * Capture a frame from a video element into a canvas.
 */
export function captureFrame(
  video: HTMLVideoElement,
  width?: number,
  height?: number
): HTMLCanvasElement {
  const w = width ?? video.videoWidth;
  const h = height ?? video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

/**
 * Get ImageData from a canvas or video source.
 */
export function getImageData(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement
): ImageData {
  let w: number, h: number;
  if (source instanceof HTMLVideoElement) {
    w = source.videoWidth;
    h = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    w = source.naturalWidth;
    h = source.naturalHeight;
  } else {
    w = source.width;
    h = source.height;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Convert ImageData back into a canvas element.
 */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  return canvas;
}

// ─── Color Conversion ─────────────────────────────────────────────────────────

function toGray(r: number, g: number, b: number): number {
  // ITU-R BT.709 luminance weights
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/**
 * Convert an image to grayscale (returns new ImageData).
 */
export function grayscale(imageData: ImageData): ImageData {
  const src = imageData.data;
  const out = new ImageData(imageData.width, imageData.height);
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const gray = toGray(src[i], src[i + 1], src[i + 2]);
    dst[i] = dst[i + 1] = dst[i + 2] = gray;
    dst[i + 3] = src[i + 3];
  }
  return out;
}

// ─── Thresholding ─────────────────────────────────────────────────────────────

/**
 * Binary threshold (returns new ImageData, black/white).
 */
export function threshold(imageData: ImageData, thresh: number): ImageData {
  const gray = grayscale(imageData);
  const src = gray.data;
  const out = new ImageData(imageData.width, imageData.height);
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const v = src[i] >= thresh ? 255 : 0;
    dst[i] = dst[i + 1] = dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  return out;
}

/**
 * Otsu's automatic threshold: finds the optimal threshold to separate foreground/background.
 * Returns [thresholdedImageData, optimalThresholdValue].
 */
export function otsuThreshold(imageData: ImageData): [ImageData, number] {
  const gray = grayscale(imageData);
  const src = gray.data;
  const totalPixels = imageData.width * imageData.height;

  // Build histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < src.length; i += 4) hist[src[i]]++;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let optT = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;
    if (variance > maxVar) {
      maxVar = variance;
      optT = t;
    }
  }

  return [threshold(imageData, optT), optT];
}

/**
 * Adaptive (local) threshold using mean of a local window.
 */
export function adaptiveThreshold(
  imageData: ImageData,
  blockSize = 11,
  C = 2
): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data: src } = gray;
  const out = new ImageData(width, height);
  const dst = out.data;
  const half = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          sum += src[(ny * width + nx) * 4];
          count++;
        }
      }
      const mean = sum / count - C;
      const idx = (y * width + x) * 4;
      const v = src[idx] >= mean ? 255 : 0;
      dst[idx] = dst[idx + 1] = dst[idx + 2] = v;
      dst[idx + 3] = 255;
    }
  }
  return out;
}

// ─── Blur ─────────────────────────────────────────────────────────────────────

/**
 * Box blur (uniform kernel).
 */
export function boxBlur(imageData: ImageData, radius = 3): ImageData {
  const { width, height, data: src } = imageData;
  const out = new ImageData(width, height);
  const dst = out.data;
  const size = 2 * radius + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const i = (ny * width + nx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2];
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      dst[idx] = r / count;
      dst[idx + 1] = g / count;
      dst[idx + 2] = b / count;
      dst[idx + 3] = src[idx + 3];
    }
  }
  return out;
}

// ─── Edge Detection ───────────────────────────────────────────────────────────

function convolve(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[][]
): Float32Array {
  const kSize = kernel.length;
  const half = Math.floor(kSize / 2);
  const result = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const nx = Math.min(Math.max(x + kx - half, 0), width - 1);
          const ny = Math.min(Math.max(y + ky - half, 0), height - 1);
          sum += data[(ny * width + nx) * 4] * kernel[ky][kx];
        }
      }
      result[y * width + x] = sum;
    }
  }
  return result;
}

/**
 * Sobel edge detection. Returns gradient magnitude as ImageData.
 */
export function sobelEdges(imageData: ImageData): [ImageData, Float32Array] {
  const gray = grayscale(imageData);
  const { width, height, data } = gray;

  const Kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const Ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  const Gx = convolve(data, width, height, Kx);
  const Gy = convolve(data, width, height, Ky);

  const out = new ImageData(width, height);
  const dst = out.data;
  const magnitudes = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    magnitudes[i] = Math.sqrt(Gx[i] ** 2 + Gy[i] ** 2);
  }

  // Normalize to 0-255
  let max = 0;
  for (let i = 0; i < magnitudes.length; i++) if (magnitudes[i] > max) max = magnitudes[i];
  const scale = max > 0 ? 255 / max : 1;

  for (let i = 0; i < width * height; i++) {
    const v = Math.round(magnitudes[i] * scale);
    const idx = i * 4;
    dst[idx] = dst[idx + 1] = dst[idx + 2] = v;
    dst[idx + 3] = 255;
  }
  return [out, magnitudes];
}

/**
 * Laplacian edge detection (second-order derivative).
 */
export function laplacianEdges(imageData: ImageData): ImageData {
  const gray = grayscale(imageData);
  const K = [[0, 1, 0], [1, -4, 1], [0, 1, 0]];
  const result = convolve(gray.data, gray.width, gray.height, K);
  const out = new ImageData(gray.width, gray.height);
  const dst = out.data;

  let min = Infinity, max = -Infinity;
  for (const v of result) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;

  for (let i = 0; i < gray.width * gray.height; i++) {
    const v = Math.round(((result[i] - min) / range) * 255);
    dst[i * 4] = dst[i * 4 + 1] = dst[i * 4 + 2] = v;
    dst[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Prewitt edge detection.
 */
export function prewittEdges(imageData: ImageData): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data } = gray;
  const Kx = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
  const Ky = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
  const Gx = convolve(data, width, height, Kx);
  const Gy = convolve(data, width, height, Ky);
  const out = new ImageData(width, height);
  const dst = out.data;

  let max = 0;
  const mags = new Float32Array(width * height);
  for (let i = 0; i < mags.length; i++) {
    mags[i] = Math.sqrt(Gx[i] ** 2 + Gy[i] ** 2);
    if (mags[i] > max) max = mags[i];
  }
  const scale = max > 0 ? 255 / max : 1;
  for (let i = 0; i < mags.length; i++) {
    const v = Math.round(mags[i] * scale);
    dst[i * 4] = dst[i * 4 + 1] = dst[i * 4 + 2] = v;
    dst[i * 4 + 3] = 255;
  }
  return out;
}

// ─── Image Sharpening ─────────────────────────────────────────────────────────

/**
 * Unsharp mask sharpening.
 */
export function sharpen(imageData: ImageData, strength = 1.5): ImageData {
  const blurred = boxBlur(imageData, 1);
  const { data: src } = imageData;
  const { data: blur } = blurred;
  const out = new ImageData(imageData.width, imageData.height);
  const dst = out.data;

  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      dst[i + c] = Math.min(255, Math.max(0, src[i + c] + strength * (src[i + c] - blur[i + c])));
    }
    dst[i + 3] = src[i + 3];
  }
  return out;
}

// ─── Color Analysis ───────────────────────────────────────────────────────────

/**
 * Compute color statistics: mean, histogram (256 bins), and dominant color.
 */
export function colorStats(imageData: ImageData): ColorStats {
  const { data, width, height } = imageData;
  const total = width * height;
  const hist = {
    r: new Array(256).fill(0),
    g: new Array(256).fill(0),
    b: new Array(256).fill(0),
    gray: new Array(256).fill(0)
  };
  let sumR = 0, sumG = 0, sumB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sumR += r; sumG += g; sumB += b;
    hist.r[r]++;
    hist.g[g]++;
    hist.b[b]++;
    hist.gray[toGray(r, g, b)]++;
  }

  const mean = {
    r: Math.round(sumR / total),
    g: Math.round(sumG / total),
    b: Math.round(sumB / total)
  };

  // Find dominant color via quantization (8-bucket per channel)
  const colorMap = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    const qr = Math.round(data[i] / 32) * 32;
    const qg = Math.round(data[i + 1] / 32) * 32;
    const qb = Math.round(data[i + 2] / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    colorMap.set(key, (colorMap.get(key) ?? 0) + 1);
  }
  let maxCount = 0;
  let domKey = '128,128,128';
  for (const [k, v] of colorMap) if (v > maxCount) { maxCount = v; domKey = k; }
  const [dr, dg, db] = domKey.split(',').map(Number);
  const hex = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;

  return { mean, histogram: hist, dominantColor: { r: dr, g: dg, b: db, hex } };
}

// ─── Morphological Operations ─────────────────────────────────────────────────

/**
 * Dilation (max filter).
 */
export function dilate(imageData: ImageData, radius = 2): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data: src } = gray;
  const out = new ImageData(width, height);
  const dst = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxV = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          maxV = Math.max(maxV, src[(ny * width + nx) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      dst[idx] = dst[idx + 1] = dst[idx + 2] = maxV;
      dst[idx + 3] = 255;
    }
  }
  return out;
}

/**
 * Erosion (min filter).
 */
export function erode(imageData: ImageData, radius = 2): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data: src } = gray;
  const out = new ImageData(width, height);
  const dst = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minV = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          minV = Math.min(minV, src[(ny * width + nx) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      dst[idx] = dst[idx + 1] = dst[idx + 2] = minV;
      dst[idx + 3] = 255;
    }
  }
  return out;
}

// ─── Feature Point Detection ──────────────────────────────────────────────────

/**
 * Harris-like corner detection (simplified).
 * Returns array of strong feature points.
 */
export function detectFeaturePoints(
  imageData: ImageData,
  maxPoints = 100,
  threshold = 0.01
): FeaturePoint[] {
  const gray = grayscale(imageData);
  const { width, height, data } = gray;

  const Kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const Ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  const Ix = convolve(data, width, height, Kx);
  const Iy = convolve(data, width, height, Ky);

  const scores: FeaturePoint[] = [];
  const k = 0.04; // Harris detector parameter

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let Ixx = 0, Iyy = 0, Ixy = 0;
      // Sum over 3x3 window
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = (y + dy) * width + (x + dx);
          Ixx += Ix[i] * Ix[i];
          Iyy += Iy[i] * Iy[i];
          Ixy += Ix[i] * Iy[i];
        }
      }
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      const R = det - k * trace * trace;
      if (R > threshold * 1e6) {
        scores.push({ x, y, strength: R });
      }
    }
  }

  // Non-maximum suppression: keep top maxPoints by strength, spaced at least 10px apart
  scores.sort((a, b) => b.strength - a.strength);
  const kept: FeaturePoint[] = [];
  for (const pt of scores) {
    if (kept.length >= maxPoints) break;
    const tooClose = kept.some((k) => Math.hypot(k.x - pt.x, k.y - pt.y) < 10);
    if (!tooClose) kept.push(pt);
  }
  return kept;
}

// ─── Histogram Equalization ───────────────────────────────────────────────────

/**
 * Histogram equalization for contrast enhancement.
 */
export function histogramEqualization(imageData: ImageData): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data: src } = gray;
  const total = width * height;

  const hist = new Array(256).fill(0);
  for (let i = 0; i < src.length; i += 4) hist[src[i]]++;

  // Cumulative distribution function
  const cdf = new Array(256).fill(0);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  const cdfMin = cdf.find((v) => v > 0) ?? 1;
  const lut = cdf.map((v) => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));

  const out = new ImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const v = lut[src[i]];
    dst[i] = dst[i + 1] = dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  return out;
}

// ─── Colorization Effects ─────────────────────────────────────────────────────

/**
 * Apply a false-color (heatmap) mapping to a grayscale image.
 * Maps 0→blue, 128→green, 255→red.
 */
export function falseColor(imageData: ImageData): ImageData {
  const gray = grayscale(imageData);
  const { width, height, data: src } = gray;
  const out = new ImageData(width, height);
  const dst = out.data;

  for (let i = 0; i < src.length; i += 4) {
    const v = src[i] / 255;
    let r: number, g: number, b: number;
    if (v < 0.5) {
      r = 0; g = Math.round(v * 2 * 255); b = Math.round((1 - v * 2) * 255);
    } else {
      r = Math.round((v - 0.5) * 2 * 255); g = Math.round((1 - (v - 0.5) * 2) * 255); b = 0;
    }
    dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = 255;
  }
  return out;
}

// ─── Canvas Overlay ───────────────────────────────────────────────────────────

/**
 * Draw object detection bounding boxes on a canvas.
 */
export function drawDetections(
  canvas: HTMLCanvasElement,
  detections: Array<{
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
    color?: string;
  }>
): void {
  const ctx = canvas.getContext('2d')!;
  for (const d of detections) {
    const [x, y, w, h] = d.bbox;
    const color = d.color ?? '#00ff00';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const label = `${d.label} ${(d.confidence * 100).toFixed(1)}%`;
    ctx.fillStyle = color;
    ctx.font = 'bold 14px monospace';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(x, y - 20, textWidth + 8, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 4, y - 4);
  }
}

/**
 * Draw feature points on a canvas.
 */
export function drawFeaturePoints(
  canvas: HTMLCanvasElement,
  points: FeaturePoint[]
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ff0040';
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Frame Hash ───────────────────────────────────────────────────────────────

/**
 * Simple perceptual hash (8x8 DCT-like) for duplicate detection.
 * Returns a hex string; NOT cryptographically secure.
 */
export function perceptualHash(imageData: ImageData): string {
  const HASH_SIZE = 8;
  const canvas = document.createElement('canvas');
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext('2d')!;
  // Draw downscaled version
  const tmp = imageDataToCanvas(imageData);
  ctx.drawImage(tmp, 0, 0, HASH_SIZE, HASH_SIZE);
  const small = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);
  const grayVals: number[] = [];
  for (let i = 0; i < small.data.length; i += 4) {
    grayVals.push(toGray(small.data[i], small.data[i + 1], small.data[i + 2]));
  }
  const avg = grayVals.reduce((a, b) => a + b, 0) / grayVals.length;
  let bits = '';
  for (let i = 0; i < grayVals.length; i++) {
    bits += grayVals[i] >= avg ? '1' : '0';
  }
  // Convert binary string to hex
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex.padStart(16, '0');
}
