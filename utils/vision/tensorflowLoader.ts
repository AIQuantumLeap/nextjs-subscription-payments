/**
 * Lazy-loader for TensorFlow.js and its models.
 * Models are loaded once and cached to avoid repeated downloads.
 */

export interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface Classification {
  label: string;
  confidence: number;
}

// Module-level caches (loaded once per session)
let cocoSsdModel: any = null;
let mobilenetModel: any = null;
let tfLoaded = false;

async function ensureTf() {
  if (tfLoaded) return;
  // Dynamic import keeps TF.js out of the initial bundle
  await import('@tensorflow/tfjs');
  tfLoaded = true;
}

/**
 * Load the COCO-SSD object detection model (cached after first load).
 * Downloads ~8 MB on first call; subsequent calls are instant.
 */
export async function loadCocoSsd() {
  if (cocoSsdModel) return cocoSsdModel;
  await ensureTf();
  const cocossd = await import('@tensorflow-models/coco-ssd');
  cocoSsdModel = await cocossd.load({ base: 'mobilenet_v2' });
  return cocoSsdModel;
}

/**
 * Load the MobileNet image classification model (cached after first load).
 */
export async function loadMobilenet() {
  if (mobilenetModel) return mobilenetModel;
  await ensureTf();
  const mobilenet = await import('@tensorflow-models/mobilenet');
  mobilenetModel = await mobilenet.load({ version: 2, alpha: 1.0 });
  return mobilenetModel;
}

/**
 * Run COCO-SSD object detection on an image source.
 * Returns normalized bounding boxes scaled to the actual canvas dimensions.
 */
export async function detectObjects(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  maxDetections = 20,
  minConfidence = 0.4
): Promise<Detection[]> {
  const model = await loadCocoSsd();
  const predictions = await model.detect(source, maxDetections);
  return predictions
    .filter((p: any) => p.score >= minConfidence)
    .map((p: any) => ({
      label: p.class,
      confidence: p.score,
      bbox: p.bbox as [number, number, number, number]
    }));
}

/**
 * Run MobileNet classification on an image source.
 * Returns top-K labels with confidence scores.
 */
export async function classifyImage(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  topK = 5
): Promise<Classification[]> {
  const model = await loadMobilenet();
  const predictions = await model.classify(source, topK);
  return predictions.map((p: any) => ({
    label: p.className,
    confidence: p.probability
  }));
}

/**
 * Dispose models to free GPU memory. Call when the component unmounts
 * and no further inference is needed.
 */
export function disposeModels() {
  if (cocoSsdModel?.dispose) cocoSsdModel.dispose();
  if (mobilenetModel?.dispose) mobilenetModel.dispose();
  cocoSsdModel = null;
  mobilenetModel = null;
  tfLoaded = false;
}
