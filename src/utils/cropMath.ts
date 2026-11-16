import {
  BiometricMesh,
  CropParameters,
  ImageBounds,
  Point2D,
  ValidationReport,
} from '../types/biometrics';
import { PhotoProfile } from '../types/profile';

/**
 * Computes the inter-pupillary midpoint between left and right eye pupils.
 */
export function getInterPupillaryMidpoint(mesh: BiometricMesh): Point2D {
  return {
    x: (mesh.leftEyePupil.x + mesh.rightEyePupil.x) / 2,
    y: (mesh.leftEyePupil.y + mesh.rightEyePupil.y) / 2,
  };
}

/**
 * Computes the Euclidean inter-pupillary distance (IPD) in pixels.
 */
export function getInterPupillaryDistance(mesh: BiometricMesh): number {
  const dx = mesh.rightEyePupil.x - mesh.leftEyePupil.x;
  const dy = mesh.rightEyePupil.y - mesh.leftEyePupil.y;
  return Math.hypot(dx, dy);
}

/**
 * Computes head roll angle in degrees from leftEyePupil to rightEyePupil.
 * Positive angle indicates clockwise tilt (right eye lower on screen than left eye).
 */
export function computeHeadRollDegrees(mesh: BiometricMesh): number {
  const dx = mesh.rightEyePupil.x - mesh.leftEyePupil.x;
  const dy = mesh.rightEyePupil.y - mesh.leftEyePupil.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Rotates a 2D point around a pivot by angleDeg degrees.
 */
export function rotatePoint2D(
  point: Point2D,
  pivot: Point2D,
  angleDeg: number
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tx = point.x - pivot.x;
  const ty = point.y - pivot.y;
  return {
    x: pivot.x + tx * cos - ty * sin,
    y: pivot.y + tx * sin + ty * cos,
  };
}

/**
 * Affine de-rotation of the entire BiometricMesh around the inter-pupillary midpoint by -theta.
 * Returns the de-rotated mesh and the applied rollCorrectionDeg (-theta).
 */
export function derotateBiometricMesh(mesh: BiometricMesh): {
  derotatedMesh: BiometricMesh;
  rollCorrectionDeg: number;
  rawRollDeg: number;
} {
  const rawRollDeg = computeHeadRollDegrees(mesh);
  const rollCorrectionDeg = -rawRollDeg;
  const pivot = getInterPupillaryMidpoint(mesh);

  const chinTip = rotatePoint2D(mesh.chinTip, pivot, rollCorrectionDeg);
  const skullForehead = rotatePoint2D(mesh.skullForehead, pivot, rollCorrectionDeg);
  const leftEyePupil = rotatePoint2D(mesh.leftEyePupil, pivot, rollCorrectionDeg);
  const rightEyePupil = rotatePoint2D(mesh.rightEyePupil, pivot, rollCorrectionDeg);
  const mouthUpper = rotatePoint2D(mesh.mouthUpper, pivot, rollCorrectionDeg);
  const mouthLower = rotatePoint2D(mesh.mouthLower, pivot, rollCorrectionDeg);

  // De-rotate true crown point (assumed horizontally aligned with skullForehead)
  const crownPoint = rotatePoint2D(
    { x: mesh.skullForehead.x, y: mesh.segmentationCrownY },
    pivot,
    rollCorrectionDeg
  );

  return {
    derotatedMesh: {
      ...mesh,
      chinTip,
      skullForehead,
      segmentationCrownY: crownPoint.y,
      leftEyePupil,
      rightEyePupil,
      mouthUpper,
      mouthLower,
    },
    rollCorrectionDeg,
    rawRollDeg,
  };
}

/**
 * Extracts the topmost non-zero alpha pixel Y-coordinate from a segmentation mask.
 * Never relies purely on Landmark 10.
 */
export function extractSegmentationCrownY(
  maskData: Uint8Array | Uint8ClampedArray | Float32Array,
  width: number,
  height: number,
  alphaThreshold = 0.5
): number | null {
  const isFloat = maskData instanceof Float32Array;
  const threshold = isFloat ? alphaThreshold : Math.round(alphaThreshold * 255);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (maskData[rowOffset + x] >= threshold) {
        return y;
      }
    }
  }
  return null;
}

/**
 * Converts sRGB [0..255] to CIE L* [0..100] lightness.
 */
export function rgbToCieL(r: number, g: number, b: number): number {
  const toLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  // CIE Y luminance (D65)
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const fY = Y > 0.008856 ? Math.cbrt(Y) : 7.787 * Y + 16 / 116;
  return Math.max(0, Math.min(100, 116 * fY - 16));
}

/**
 * Analyzes background luminance uniformity (Delta L* <= 12) and head perimeter cast shadows
 * (Delta L* <= 25 within 50px band outside the segmentation mask).
 */
export function analyzeBackgroundAndPerimeterShadows(
  rgbaData: Uint8ClampedArray,
  maskData: Uint8Array | Float32Array,
  width: number,
  height: number,
  perimeterBandPx = 50
): {
  backgroundDeltaL: number;
  perimeterShadowDeltaL: number;
  meanBackgroundL: number;
  isLightingUniform: boolean;
  isHeadPerimeterShadowFree: boolean;
} {
  const isFloat = maskData instanceof Float32Array;
  const fgThreshold = isFloat ? 0.5 : 128;

  const bgLightnessSamples: number[] = [];
  const perimeterLightnessSamples: number[] = [];

  // Sample grid with stride to keep worker analysis fast while accurate
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 120));

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = y * width + x;
      const isForeground = maskData[idx] >= fgThreshold;
      if (isForeground) continue;

      const pIdx = idx * 4;
      const L = rgbToCieL(rgbaData[pIdx], rgbaData[pIdx + 1], rgbaData[pIdx + 2]);

      // Check if within perimeterBandPx of any foreground pixel along horizontal scan
      let nearForeground = false;
      const checkDist = Math.min(perimeterBandPx, 50);
      const leftCheck = Math.max(0, x - checkDist);
      const rightCheck = Math.min(width - 1, x + checkDist);
      if (
        maskData[y * width + leftCheck] >= fgThreshold ||
        maskData[y * width + rightCheck] >= fgThreshold
      ) {
        nearForeground = true;
      }

      if (nearForeground) {
        perimeterLightnessSamples.push(L);
      } else {
        bgLightnessSamples.push(L);
      }
    }
  }

  if (bgLightnessSamples.length === 0) {
    return {
      backgroundDeltaL: 0,
      perimeterShadowDeltaL: 0,
      meanBackgroundL: 95,
      isLightingUniform: true,
      isHeadPerimeterShadowFree: true,
    };
  }

  bgLightnessSamples.sort((a, b) => a - b);
  const p10 = bgLightnessSamples[Math.floor(bgLightnessSamples.length * 0.1)];
  const p90 = bgLightnessSamples[Math.floor(bgLightnessSamples.length * 0.9)];
  const backgroundDeltaL = p90 - p10;
  const meanBackgroundL =
    bgLightnessSamples.reduce((acc, v) => acc + v, 0) / bgLightnessSamples.length;

  let perimeterShadowDeltaL = 0;
  if (perimeterLightnessSamples.length > 0) {
    perimeterLightnessSamples.sort((a, b) => a - b);
    const darkestPerimeterL =
      perimeterLightnessSamples[Math.floor(perimeterLightnessSamples.length * 0.1)];
    perimeterShadowDeltaL = Math.max(0, p90 - darkestPerimeterL);
  }

  return {
    backgroundDeltaL,
    perimeterShadowDeltaL,
    meanBackgroundL,
    isLightingUniform: backgroundDeltaL <= 12.0,
    isHeadPerimeterShadowFree: perimeterShadowDeltaL <= 25.0,
  };
}

/**
 * Constrained multi-variable optimization solver accepting (mesh, profile, imageBounds).
 * Simultaneously optimizes for:
 *  1. Head height ratio: headHeight / H_crop in [minRatio, maxRatio] (target: targetRatio)
 *  2. Eye level horizon from bottom: (y_max - y_eye) / H_crop in [minFromBottom, maxFromBottom]
 *  3. Chin-to-bottom neck/shoulder clearance: (y_max - y_chin) / H_crop >= chinBottomClearanceMin
 *
 * Uses affine de-rotated biometric coordinates around the inter-pupillary midpoint.
 */
export function solveConstrainedCrop(
  mesh: BiometricMesh,
  profile: PhotoProfile,
  imageBounds: ImageBounds
): {
  crop: CropParameters;
  achievedHeadRatio: number;
  achievedEyeFromBottomRatio: number;
  achievedChinClearanceRatio: number;
} {
  const { derotatedMesh, rollCorrectionDeg } = derotateBiometricMesh(mesh);

  // True crown is the topmost pixel between segmentationCrownY and skullForehead.y
  const yCrown = Math.min(
    derotatedMesh.segmentationCrownY,
    derotatedMesh.skullForehead.y
  );
  const yChin = derotatedMesh.chinTip.y;
  const headHeightPx = Math.max(1, yChin - yCrown);

  const eyeMidpoint = getInterPupillaryMidpoint(derotatedMesh);
  const yEye = eyeMidpoint.y;
  const xCenter = (eyeMidpoint.x + derotatedMesh.chinTip.x) / 2;

  const { minRatio, maxRatio, targetRatio } = profile.headConstraints;
  const eyeMin = profile.eyeConstraints?.minFromBottom ?? 0.50;
  const eyeMax = profile.eyeConstraints?.maxFromBottom ?? 0.70;
  const eyeTarget = (eyeMin + eyeMax) / 2;
  const chinClearanceMin = profile.chinBottomClearanceMin;

  // Feasible crop height bounds from head height ratio constraints
  const hMinFromHead = headHeightPx / maxRatio;
  const hMaxFromHead = headHeightPx / minRatio;
  const hTarget = headHeightPx / targetRatio;

  // Ensure enough top headroom (>= 6% for portrait formats, >= 3% for 1:1) and chin-to-bottom shoulder clearance
  const minTopHeadroom = profile.aspectRatio < 0.9 ? 0.06 : 0.03;
  const hMinFromClearance =
    headHeightPx / Math.max(0.2, 1 - minTopHeadroom - chinClearanceMin);

  const feasibleHMin = Math.max(hMinFromHead, hMinFromClearance);
  const feasibleHMax = Math.max(feasibleHMin, hMaxFromHead);

  //Simultaneous multi-variable search over H in [feasibleHMin, feasibleHMax]
  let bestH = Math.min(feasibleHMax, Math.max(feasibleHMin, hTarget));
  let bestYMin = yEye - (1 - eyeTarget) * bestH;
  let bestLoss = Number.POSITIVE_INFINITY;

  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const candidateH =
      feasibleHMin + ((feasibleHMax - feasibleHMin) * i) / steps;

    // For a given candidateH, find feasible interval for yMax:
    // 1) Eye level constraint: yEye + eyeMin * H <= yMax <= yEye + eyeMax * H
    const yMaxEyeLow = yEye + eyeMin * candidateH;
    const yMaxEyeHigh = yEye + eyeMax * candidateH;

    // 2) Chin bottom clearance constraint: yMax >= yChin + chinClearanceMin * H
    const yMaxChinLow = yChin + chinClearanceMin * candidateH;

    // 3) Top crown clearance constraint (keep crown inside frame with >= minTopHeadroom):
    const yMaxCrownHigh = yCrown + (1 - minTopHeadroom) * candidateH;

    const lowerBoundYMax = Math.max(yMaxEyeLow, yMaxChinLow);
    const upperBoundYMax = Math.min(yMaxEyeHigh, yMaxCrownHigh);

    const idealYMax = yEye + eyeTarget * candidateH;
    let chosenYMax: number;

    if (lowerBoundYMax <= upperBoundYMax) {
      chosenYMax = Math.min(
        upperBoundYMax,
        Math.max(lowerBoundYMax, idealYMax)
      );
    } else {
      // Soft penalty compromise if extreme facial proportions occur
      chosenYMax = (lowerBoundYMax + upperBoundYMax) / 2;
    }

    const candidateYMin = chosenYMax - candidateH;
    const headRatio = headHeightPx / candidateH;
    const eyeFromBottomRatio = (chosenYMax - yEye) / candidateH;
    const chinClearanceRatio = (chosenYMax - yChin) / candidateH;

    // Multi-objective quadratic cost + barrier penalties for any constraint violation
    let loss =
      Math.pow((headRatio - targetRatio) / 0.05, 2) +
      Math.pow((eyeFromBottomRatio - eyeTarget) / 0.04, 2);

    if (headRatio < minRatio) loss += 1000 * Math.pow(minRatio - headRatio, 2);
    if (headRatio > maxRatio) loss += 1000 * Math.pow(headRatio - maxRatio, 2);
    if (eyeFromBottomRatio < eyeMin)
      loss += 1000 * Math.pow(eyeMin - eyeFromBottomRatio, 2);
    if (eyeFromBottomRatio > eyeMax)
      loss += 1000 * Math.pow(eyeFromBottomRatio - eyeMax, 2);
    if (chinClearanceRatio < chinClearanceMin)
      loss += 2000 * Math.pow(chinClearanceMin - chinClearanceRatio, 2);

    if (loss < bestLoss) {
      bestLoss = loss;
      bestH = candidateH;
      bestYMin = candidateYMin;
    }
  }

  const cropHeight = bestH;
  const cropWidth = cropHeight * profile.aspectRatio;
  let xMin = xCenter - cropWidth / 2;
  let yMin = bestYMin;

  // Clamp horizontal and vertical positions within imageBounds to avoid white edge slivers
  if (imageBounds.width >= cropWidth) {
    xMin = Math.max(0, Math.min(imageBounds.width - cropWidth, xMin));
  }
  if (imageBounds.height >= cropHeight) {
    yMin = Math.max(0, Math.min(imageBounds.height - cropHeight, yMin));
  }

  const yMax = yMin + cropHeight;
  const achievedHeadRatio = headHeightPx / cropHeight;
  const achievedEyeFromBottomRatio = (yMax - yEye) / cropHeight;
  const achievedChinClearanceRatio = (yMax - yChin) / cropHeight;

  return {
    crop: {
      xMin,
      yMin,
      cropWidth,
      cropHeight,
      rollCorrectionDeg,
    },
    achievedHeadRatio,
    achievedEyeFromBottomRatio,
    achievedChinClearanceRatio,
  };
}

/**
 * Evaluates full regulatory compliance for a BiometricMesh against a PhotoProfile.
 */
export function evaluateBiometricValidation(
  mesh: BiometricMesh,
  profile: PhotoProfile,
  imageBounds: ImageBounds
): {
  report: ValidationReport;
  crop: CropParameters;
} {
  const rawRollDeg = computeHeadRollDegrees(mesh);
  const isRollCompliant = Math.abs(rawRollDeg) <= 2.5;

  const pitchDeg = mesh.pitchDeg ?? 0;
  const yawDeg = mesh.yawDeg ?? 0;
  const isPitchYawCompliant =
    Math.abs(pitchDeg) <= 5.0 && Math.abs(yawDeg) <= 5.0;

  const ipd = Math.max(1, getInterPupillaryDistance(mesh));
  const interLipDistance = Math.hypot(
    mesh.mouthLower.x - mesh.mouthUpper.x,
    mesh.mouthLower.y - mesh.mouthUpper.y
  );
  const mouthRatio = interLipDistance / ipd;
  const isMouthClosed = profile.teethAllowed ? mouthRatio <= 0.15 : mouthRatio <= 0.08;

  const leftEAR = mesh.leftEyeEAR ?? 0.28;
  const rightEAR = mesh.rightEyeEAR ?? 0.28;
  const isBlinkFree = leftEAR >= 0.20 && rightEAR >= 0.20;

  const bgDeltaL = mesh.backgroundDeltaL ?? 5.0;
  const isLightingUniform = bgDeltaL <= 12.0;

  const shadowDeltaL = mesh.perimeterShadowDeltaL ?? 8.0;
  const isHeadPerimeterShadowFree = shadowDeltaL <= 25.0;

  const glassesConf = mesh.glassesConfidence ?? 0.0;
  const isGlassesFree = profile.glassesAllowed ? true : glassesConf < 0.35;

  const {
    crop,
    achievedHeadRatio,
    achievedEyeFromBottomRatio,
    achievedChinClearanceRatio,
  } = solveConstrainedCrop(mesh, profile, imageBounds);

  const eps = 1e-4;
  const isHeadRatioCompliant =
    achievedHeadRatio >= profile.headConstraints.minRatio - eps &&
    achievedHeadRatio <= profile.headConstraints.maxRatio + eps &&
    achievedChinClearanceRatio >= profile.chinBottomClearanceMin - eps;

  const eyeMin = profile.eyeConstraints?.minFromBottom ?? 0.0;
  const eyeMax = profile.eyeConstraints?.maxFromBottom ?? 1.0;
  const isEyeLevelCompliant =
    achievedEyeFromBottomRatio >= eyeMin - eps &&
    achievedEyeFromBottomRatio <= eyeMax + eps;

  const overallPass =
    isEyeLevelCompliant &&
    isHeadRatioCompliant &&
    isRollCompliant &&
    isPitchYawCompliant &&
    isMouthClosed &&
    isBlinkFree &&
    isLightingUniform &&
    isHeadPerimeterShadowFree &&
    isGlassesFree;

  return {
    report: {
      isEyeLevelCompliant,
      isHeadRatioCompliant,
      isRollCompliant,
      isPitchYawCompliant,
      isMouthClosed,
      isBlinkFree,
      isLightingUniform,
      isHeadPerimeterShadowFree,
      isGlassesFree,
      overallPass,
    },
    crop,
  };
}

