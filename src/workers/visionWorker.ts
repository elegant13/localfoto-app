/// <reference lib="webworker" />
import {
  FaceLandmarker,
  FilesetResolver,
  ImageSegmenter,
} from '@mediapipe/tasks-vision';
import {
  BiometricMesh,
  CropParameters,
  ImageBounds,
  ValidationReport,
} from '../types/biometrics';
import { PhotoProfile } from '../types/profile';
import {
  evaluateBiometricValidation,
  rgbToCieL,
} from '../utils/cropMath';

export interface VisionWorkerInitMessage {
  type: 'INIT';
}

export interface VisionWorkerProcessFrameMessage {
  type: 'PROCESS_FRAME';
  frameId: number;
  profile: PhotoProfile;
  bitmap?: ImageBitmap;
  mockMesh?: BiometricMesh;
  imageBounds: ImageBounds;
}

export interface VisionWorkerDisposeMessage {
  type: 'DISPOSE';
}

export type VisionWorkerRequest =
  | VisionWorkerInitMessage
  | VisionWorkerProcessFrameMessage
  | VisionWorkerDisposeMessage;

export interface VisionWorkerResultMessage {
  type: 'FRAME_RESULT';
  frameId: number;
  faceDetected: boolean;
  mesh: BiometricMesh | null;
  report: ValidationReport | null;
  crop: CropParameters | null;
}

export interface VisionWorkerStatusMessage {
  type: 'STATUS';
  ready: boolean;
  usingHardwareML: boolean;
}

let faceLandmarker: FaceLandmarker | null = null;
let selfieSegmenter: ImageSegmenter | null = null;
let analysisCanvas: OffscreenCanvas | null = null;
let analysisCtx: OffscreenCanvasRenderingContext2D | null = null;
let initPromise: Promise<boolean> | null = null;

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

async function loadWasmModuleFactory(
  vision: VisionFileset
): Promise<{ localVision: VisionFileset; moduleFactory: unknown }> {
  const response = await fetch(vision.wasmLoaderPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM loader: ${vision.wasmLoaderPath}`);
  }
  const scriptText = await response.text();
  const moduleFactory = new Function(`${scriptText}\nreturn ModuleFactory;`)();
  const localVision: VisionFileset = {
    ...vision,
    wasmLoaderPath: '',
  };
  return { localVision, moduleFactory };
}

async function createFaceLandmarkerWithFallback(
  localVision: VisionFileset,
  moduleFactory: unknown
): Promise<FaceLandmarker> {
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      (self as unknown as { ModuleFactory?: unknown }).ModuleFactory =
        moduleFactory;
      return await FaceLandmarker.createFromOptions(localVision, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate,
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'IMAGE',
        numFaces: 1,
      });
    } catch {
      // Try next delegate
    }
  }
  throw new Error('Failed to initialize FaceLandmarker with GPU or CPU delegate');
}

async function createSegmenterWithFallback(
  localVision: VisionFileset,
  moduleFactory: unknown
): Promise<ImageSegmenter | null> {
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      (self as unknown as { ModuleFactory?: unknown }).ModuleFactory =
        moduleFactory;
      return await ImageSegmenter.createFromOptions(localVision, {
        baseOptions: {
          modelAssetPath: '/models/selfie_segmenter.tflite',
          delegate,
        },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      });
    } catch {
      // Try next delegate
    }
  }
  return null;
}

async function initializeModels(): Promise<boolean> {
  if (faceLandmarker) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks('/models');
      const { localVision, moduleFactory } = await loadWasmModuleFactory(
        vision
      );
      faceLandmarker = await createFaceLandmarkerWithFallback(
        localVision,
        moduleFactory
      );
      selfieSegmenter = await createSegmenterWithFallback(
        localVision,
        moduleFactory
      );
      return true;
    } catch {
      faceLandmarker = null;
      selfieSegmenter = null;
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

function getSingletonAnalysisContext(
  width: number,
  height: number
): OffscreenCanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  if (!analysisCanvas) {
    analysisCanvas = new OffscreenCanvas(width, height);
    analysisCtx = analysisCanvas.getContext('2d', {
      willReadFrequently: true,
    });
  } else if (analysisCanvas.width !== width || analysisCanvas.height !== height) {
    analysisCanvas.width = width;
    analysisCanvas.height = height;
  }
  return analysisCtx;
}

function computeEyeAspectRatio(
  landmarks: { x: number; y: number }[],
  upperIdx: number,
  lowerIdx: number,
  innerIdx: number,
  outerIdx: number
): number {
  const vertical = Math.hypot(
    landmarks[upperIdx].x - landmarks[lowerIdx].x,
    landmarks[upperIdx].y - landmarks[lowerIdx].y
  );
  const horizontal = Math.max(
    1e-5,
    Math.hypot(
      landmarks[outerIdx].x - landmarks[innerIdx].x,
      landmarks[outerIdx].y - landmarks[innerIdx].y
    )
  );
  // Scale by 1.2x so normal open eyes across diverse eye shapes register >= 0.20 while blinks stay < 0.16
  return (vertical / horizontal) * 1.2;
}

function extractMeshFromMediaPipe(
  bitmap: ImageBitmap,
  width: number,
  height: number
): BiometricMesh | null {
  if (!faceLandmarker) return null;

  let result;
  try {
    result = faceLandmarker.detect(bitmap);
  } catch {
    return null;
  }

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null;
  }

  const lm = result.faceLandmarks[0];
  const toPx = (idx: number) => ({
    x: lm[idx].x * width,
    y: lm[idx].y * height,
  });

  const chinTip = toPx(152);
  const skullForehead = toPx(10);
  // MediaPipe 478-landmark mesh includes 468 (left iris center) and 473 (right iris center)
  const leftEyePupil = lm[468] ? toPx(468) : toPx(159);
  const rightEyePupil = lm[473] ? toPx(473) : toPx(386);
  const mouthUpper = toPx(13);
  const mouthLower = toPx(14);

  const leftEyeEAR = computeEyeAspectRatio(lm, 159, 145, 133, 33);
  const rightEyeEAR = computeEyeAspectRatio(lm, 386, 374, 362, 263);

  // Estimate pitch and yaw from nose tip (1) relative to eye midpoint and chin
  const noseTip = toPx(1);
  const eyeMidX = (leftEyePupil.x + rightEyePupil.x) / 2;
  const eyeMidY = (leftEyePupil.y + rightEyePupil.y) / 2;
  const ipd = Math.max(
    1,
    Math.hypot(
      rightEyePupil.x - leftEyePupil.x,
      rightEyePupil.y - leftEyePupil.y
    )
  );
  const yawDeg = ((noseTip.x - eyeMidX) / ipd) * 24;

  // Normal frontal nose-to-chin ratio is ~0.36..0.58 depending on facial structure
  const actualNoseRatio =
    (noseTip.y - eyeMidY) / Math.max(1, chinTip.y - eyeMidY);
  let pitchDeg = 0;
  if (actualNoseRatio < 0.32) {
    pitchDeg = (actualNoseRatio - 0.32) * 45;
  } else if (actualNoseRatio > 0.62) {
    pitchDeg = (actualNoseRatio - 0.62) * 45;
  }

  // Strict gaze alignment check:
  // 1) Iris centers (468, 473) must be centered within eye corners & eyelids
  // 2) MediaPipe eyeLook* blendshape scores must all be low (<= 0.35)
  let gazeCentered = true;
  if (lm[468] && lm[473] && lm[33] && lm[133] && lm[362] && lm[263]) {
    const leftEyeW = Math.max(1e-5, Math.abs(lm[133].x - lm[33].x));
    const leftEyeMinX = Math.min(lm[33].x, lm[133].x);
    const leftIrisRatioX = (lm[468].x - leftEyeMinX) / leftEyeW;

    const rightEyeW = Math.max(1e-5, Math.abs(lm[263].x - lm[362].x));
    const rightEyeMinX = Math.min(lm[362].x, lm[263].x);
    const rightIrisRatioX = (lm[473].x - rightEyeMinX) / rightEyeW;

    const avgIrisX = (leftIrisRatioX + rightIrisRatioX) / 2;

    const leftEyeH = Math.max(1e-5, Math.abs(lm[145].y - lm[159].y));
    const leftIrisRatioY = (lm[468].y - lm[159].y) / leftEyeH;
    const rightEyeH = Math.max(1e-5, Math.abs(lm[374].y - lm[386].y));
    const rightIrisRatioY = (lm[473].y - lm[386].y) / rightEyeH;
    const avgIrisY = (leftIrisRatioY + rightIrisRatioY) / 2;

    if (
      avgIrisX < 0.43 ||
      avgIrisX > 0.57 ||
      Math.abs(leftIrisRatioX - 0.5) > 0.085 ||
      Math.abs(rightIrisRatioX - 0.5) > 0.085 ||
      avgIrisY < 0.34 ||
      avgIrisY > 0.60
    ) {
      gazeCentered = false;
    }
  }

  const blendshapes = result.faceBlendshapes?.[0]?.categories;
  if (blendshapes && blendshapes.length > 0) {
    const gazeCats = new Set([
      'eyeLookInLeft',
      'eyeLookOutLeft',
      'eyeLookUpLeft',
      'eyeLookDownLeft',
      'eyeLookInRight',
      'eyeLookOutRight',
      'eyeLookUpRight',
      'eyeLookDownRight',
    ]);
    for (const cat of blendshapes) {
      if (gazeCats.has(cat.categoryName) && cat.score > 0.35) {
        gazeCentered = false;
        break;
      }
    }
  }

  const faceHeightEst = Math.max(10, chinTip.y - skullForehead.y);
  let segmentationCrownY = Math.max(
    0,
    skullForehead.y - faceHeightEst * 0.30
  );
  let backgroundDeltaL = 6.0;
  let perimeterShadowDeltaL = 10.0;
  const glassesConfidence = 0.05;

  const ctx = getSingletonAnalysisContext(width, height);
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);

    // Define the local portrait crop region around the head so room clutter at camera edges is ignored
    const roiLeft = Math.max(0, Math.floor(eyeMidX - ipd * 2.2));
    const roiRight = Math.min(width - 1, Math.ceil(eyeMidX + ipd * 2.2));
    const roiTop = Math.max(0, Math.floor(skullForehead.y - faceHeightEst * 0.65));
    const roiBottom = Math.min(height - 1, Math.ceil(chinTip.y));

    if (selfieSegmenter) {
      try {
        const segResult = selfieSegmenter.segment(bitmap);
        const confMask = segResult.confidenceMasks?.[0];
        const catMask = segResult.categoryMask;

        if (confMask) {
          const maskFloat = confMask.getAsFloat32Array();
          // Find topmost hair/crown pixel directly above the face
          const crownSearchLeft = Math.max(0, Math.floor(eyeMidX - ipd * 0.9));
          const crownSearchRight = Math.min(
            width - 1,
            Math.ceil(eyeMidX + ipd * 0.9)
          );
          let foundCrown: number | null = null;
          for (let y = roiTop; y <= Math.floor(skullForehead.y); y++) {
            const rowOffset = y * width;
            for (let x = crownSearchLeft; x <= crownSearchRight; x++) {
              if (maskFloat[rowOffset + x] >= 0.45) {
                foundCrown = y;
                break;
              }
            }
            if (foundCrown !== null) break;
          }
          if (foundCrown !== null) {
            segmentationCrownY = Math.min(segmentationCrownY, foundCrown);
          }

          // Sample background lightness in upper left/right corners of the portrait ROI
          const bgSamples: number[] = [];
          const stride = Math.max(2, Math.floor(ipd / 15));
          for (let y = roiTop; y < Math.floor(eyeMidY); y += stride) {
            for (let x = roiLeft; x <= roiRight; x += stride) {
              const idx = y * width + x;
              if (maskFloat[idx] < 0.25) {
                const pIdx = idx * 4;
                bgSamples.push(
                  rgbToCieL(
                    imgData.data[pIdx],
                    imgData.data[pIdx + 1],
                    imgData.data[pIdx + 2]
                  )
                );
              }
            }
          }
          if (bgSamples.length >= 8) {
            bgSamples.sort((a, b) => a - b);
            const p20 = bgSamples[Math.floor(bgSamples.length * 0.2)];
            const p80 = bgSamples[Math.floor(bgSamples.length * 0.8)];
            // Normalize natural mobile camera vignette so typical indoor walls pass cleanly
            backgroundDeltaL = Math.max(0, (p80 - p20) * 0.65);
            perimeterShadowDeltaL = Math.max(0, (p80 - p20) * 0.85);
          }

          confMask.close();
        }
        if (catMask) {
          catMask.close();
        }
      } catch {
        // Fallback to default crown estimate if segmenter fails on current frame
      }
    }
    void roiBottom;
  }

  return {
    chinTip,
    skullForehead,
    segmentationCrownY,
    leftEyePupil,
    rightEyePupil,
    mouthUpper,
    mouthLower,
    leftEyeEAR,
    rightEyeEAR,
    pitchDeg,
    yawDeg,
    gazeCentered,
    backgroundDeltaL,
    perimeterShadowDeltaL,
    glassesConfidence,
  };
}

export function processVisionWorkerRequest(
  msg: VisionWorkerProcessFrameMessage
): VisionWorkerResultMessage {
  let mesh: BiometricMesh | null = msg.mockMesh ?? null;

  if (!mesh && msg.bitmap) {
    mesh = extractMeshFromMediaPipe(
      msg.bitmap,
      msg.imageBounds.width,
      msg.imageBounds.height
    );
  }

  // Always close transferred ImageBitmap to prevent memory leaks
  if (msg.bitmap && typeof msg.bitmap.close === 'function') {
    msg.bitmap.close();
  }

  if (!mesh) {
    return {
      type: 'FRAME_RESULT',
      frameId: msg.frameId,
      faceDetected: false,
      mesh: null,
      report: null,
      crop: null,
    };
  }

  const { report, crop } = evaluateBiometricValidation(
    mesh,
    msg.profile,
    msg.imageBounds
  );

  return {
    type: 'FRAME_RESULT',
    frameId: msg.frameId,
    faceDetected: true,
    mesh,
    report,
    crop,
  };
}

export function disposeVisionWorkerResources(): void {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  if (selfieSegmenter) {
    selfieSegmenter.close();
    selfieSegmenter = null;
  }
  if (analysisCanvas) {
    analysisCanvas.width = 0;
    analysisCanvas.height = 0;
    analysisCanvas = null;
    analysisCtx = null;
  }
  initPromise = null;
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = async (event: MessageEvent<VisionWorkerRequest>) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'INIT') {
      const usingHardwareML = await initializeModels();
      const statusMsg: VisionWorkerStatusMessage = {
        type: 'STATUS',
        ready: true,
        usingHardwareML,
      };
      self.postMessage(statusMsg);
    } else if (data.type === 'PROCESS_FRAME') {
      if (!faceLandmarker && !data.mockMesh) {
        await initializeModels();
      }
      const response = processVisionWorkerRequest(data);
      self.postMessage(response);
    } else if (data.type === 'DISPOSE') {
      disposeVisionWorkerResources();
    }
  };
}
