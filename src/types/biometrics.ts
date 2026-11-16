export interface Point2D {
  x: number;
  y: number;
}

export interface BiometricMesh {
  chinTip: Point2D;            // Landmark 152
  skullForehead: Point2D;      // Landmark 10
  segmentationCrownY: number;  // Topmost non-zero alpha pixel from head segmentation
  leftEyePupil: Point2D;       // Landmark 468 (Iris center)
  rightEyePupil: Point2D;      // Landmark 473 (Iris center)
  mouthUpper: Point2D;         // Landmark 13
  mouthLower: Point2D;         // Landmark 14
  // Optional extended telemetry for pose/blink/glasses/background validation
  leftEyeEAR?: number;
  rightEyeEAR?: number;
  pitchDeg?: number;
  yawDeg?: number;
  backgroundDeltaL?: number;
  perimeterShadowDeltaL?: number;
  glassesConfidence?: number;  // Bridge occlusion / specular reflection metric (0..1)
}

export interface ValidationReport {
  isEyeLevelCompliant: boolean;
  isHeadRatioCompliant: boolean;
  isRollCompliant: boolean;           // |Roll| <= 2.5 degrees
  isPitchYawCompliant: boolean;       // Pitch/Yaw deviations <= 5.0 degrees
  isMouthClosed: boolean;             // Inter-lip distance / IPD <= 0.08
  isBlinkFree: boolean;               // Eye Aspect Ratio (EAR) >= 0.20
  isLightingUniform: boolean;         // Background delta L* <= 12
  isHeadPerimeterShadowFree: boolean; // No cast shadow silhouette (delta L* <= 25 within 50px)
  isGlassesFree: boolean;             // No frame occlusion or specular reflection on bridge
  overallPass: boolean;
}

export interface CropParameters {
  xMin: number;
  yMin: number;
  cropWidth: number;
  cropHeight: number;
  rollCorrectionDeg: number;
}

export interface ImageBounds {
  width: number;
  height: number;
}

