import { describe, it, expect } from 'vitest';
import {
  analyzeBackgroundAndPerimeterShadows,
  computeHeadRollDegrees,
  derotateBiometricMesh,
  evaluateBiometricValidation,
  extractSegmentationCrownY,
  getInterPupillaryDistance,
  getInterPupillaryMidpoint,
  rgbToCieL,
  solveConstrainedCrop,
} from '../src/utils/cropMath';
import {
  profileRegistry,
  US_PASSPORT_PROFILE,
  SCHENGEN_VISA_PROFILE,
  INDIA_OCI_PROFILE,
  CANADA_PASSPORT_PROFILE,
  UK_PASSPORT_PROFILE,
} from '../src/profiles/registry';
import { MOCK_PORTRAIT_FIXTURES } from '../src/services/mockCameraService';
import mockLandmarksJson from './fixtures/mockLandmarks.json';

describe('Phase 1 & 2: Parameterized Profile Registry & Biometric Crop Solver', () => {
  it('registers default US Passport profile and extensible international profiles', () => {
    const defaultProfile = profileRegistry.getDefault();
    expect(defaultProfile.id).toBe('us_passport');
    expect(defaultProfile.aspectRatio).toBe(1.0);
    expect(profileRegistry.getAll().length).toBeGreaterThanOrEqual(5);
  });

  it('matches JSON mock fixtures with mockCameraService fixtures', () => {
    expect(mockLandmarksJson.compliant_subject.mesh.chinTip.y).toBe(
      MOCK_PORTRAIT_FIXTURES.compliant_subject.mesh.chinTip.y
    );
    expect(mockLandmarksJson.voluminous_hair.mesh.segmentationCrownY).toBe(320);
  });

  it('passes all 9 biometric checks and geometric constraints for compliant_subject', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.compliant_subject;
    const { report, crop } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );

    expect(report.isEyeLevelCompliant).toBe(true);
    expect(report.isHeadRatioCompliant).toBe(true);
    expect(report.isRollCompliant).toBe(true);
    expect(report.isPitchYawCompliant).toBe(true);
    expect(report.isMouthClosed).toBe(true);
    expect(report.isBlinkFree).toBe(true);
    expect(report.isLightingUniform).toBe(true);
    expect(report.isHeadPerimeterShadowFree).toBe(true);
    expect(report.isGlassesFree).toBe(true);
    expect(report.overallPass).toBe(true);

    // Verify 1:1 aspect ratio for US Passport
    expect(crop.cropWidth / crop.cropHeight).toBeCloseTo(1.0, 4);
  });

  it('detects tilted head roll (> 2.5 deg) and computes exact affine de-rotation (-theta)', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.tilted_head;
    const rawRoll = computeHeadRollDegrees(fixture.mesh);
    expect(Math.abs(rawRoll)).toBeGreaterThan(2.5);

    const { derotatedMesh, rollCorrectionDeg } = derotateBiometricMesh(
      fixture.mesh
    );
    expect(rollCorrectionDeg).toBeCloseTo(-rawRoll, 5);
    // After affine de-rotation around inter-pupillary midpoint, both eyes share the exact same Y horizon
    expect(derotatedMesh.leftEyePupil.y).toBeCloseTo(
      derotatedMesh.rightEyePupil.y,
      4
    );

    const { report } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    expect(report.isRollCompliant).toBe(false);
    expect(report.overallPass).toBe(false);
  });

  it('flags smiling / open mouth when inter-lip distance / IPD > 0.08', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.smiling_open_mouth;
    const ipd = getInterPupillaryDistance(fixture.mesh);
    const lipGap =
      fixture.mesh.mouthLower.y - fixture.mesh.mouthUpper.y;
    expect(lipGap / ipd).toBeGreaterThan(0.08);

    const { report } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    expect(report.isMouthClosed).toBe(false);
    expect(report.overallPass).toBe(false);
  });

  it('uses segmentationCrownY instead of Landmark 10 for voluminous hair / turban and preserves >=15% chin clearance', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.voluminous_hair;
    const solved = solveConstrainedCrop(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );

    // True head height is 960 - 320 = 640px (not 960 - 460 = 500px)
    const expectedHeadHeight =
      fixture.mesh.chinTip.y - fixture.mesh.segmentationCrownY;
    expect(expectedHeadHeight).toBe(640);

    // Verify head ratio is within [0.50, 0.69]
    expect(solved.achievedHeadRatio).toBeGreaterThanOrEqual(0.50);
    expect(solved.achievedHeadRatio).toBeLessThanOrEqual(0.69);

    // Verify eye level is within [0.56, 0.69] from bottom
    expect(solved.achievedEyeFromBottomRatio).toBeGreaterThanOrEqual(0.56);
    expect(solved.achievedEyeFromBottomRatio).toBeLessThanOrEqual(0.69);

    // Verify neck/shoulder clearance below chin is >= 0.15 * H_crop
    expect(solved.achievedChinClearanceRatio).toBeGreaterThanOrEqual(0.15);
  });

  it('flags non-uniform background lighting (Delta L* > 12) and perimeter cast shadows (Delta L* > 25)', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.shadow_heavy_background;
    const { report } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    expect(report.isLightingUniform).toBe(false);
    expect(report.isHeadPerimeterShadowFree).toBe(false);
    expect(report.overallPass).toBe(false);
  });

  it('flags eyeglasses when profile forbids glasses', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.glasses_wearing;
    const { report } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    expect(report.isGlassesFree).toBe(false);
    expect(report.overallPass).toBe(false);
  });

  it('solves multi-variable crop across Schengen, India OCI, Canada, and UK profiles without code changes', () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.compliant_subject;
    for (const profile of [
      SCHENGEN_VISA_PROFILE,
      INDIA_OCI_PROFILE,
      CANADA_PASSPORT_PROFILE,
      UK_PASSPORT_PROFILE,
    ]) {
      const solved = solveConstrainedCrop(
        fixture.mesh,
        profile,
        fixture.imageBounds
      );
      expect(solved.crop.cropWidth / solved.crop.cropHeight).toBeCloseTo(
        profile.aspectRatio,
        4
      );
      expect(solved.achievedHeadRatio).toBeGreaterThanOrEqual(
        profile.headConstraints.minRatio - 1e-4
      );
      expect(solved.achievedHeadRatio).toBeLessThanOrEqual(
        profile.headConstraints.maxRatio + 1e-4
      );
      expect(solved.achievedChinClearanceRatio).toBeGreaterThanOrEqual(
        profile.chinBottomClearanceMin - 1e-4
      );
    }
  });

  it('extracts segmentation crown Y and computes CIE L* background uniformity from raw pixel buffers', () => {
    const width = 100;
    const height = 100;
    const mask = new Uint8Array(width * height);
    // Subject crown starts at y = 22
    for (let y = 22; y < 80; y++) {
      for (let x = 30; x < 70; x++) {
        mask[y * width + x] = 255;
      }
    }
    const crownY = extractSegmentationCrownY(mask, width, height, 0.5);
    expect(crownY).toBe(22);

    // Uniform white wall (RGB 248, 248, 248)
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = 248;
      rgba[i * 4 + 1] = 248;
      rgba[i * 4 + 2] = 248;
      rgba[i * 4 + 3] = 255;
    }
    const analysis = analyzeBackgroundAndPerimeterShadows(
      rgba,
      mask,
      width,
      height
    );
    expect(analysis.isLightingUniform).toBe(true);
    expect(analysis.isHeadPerimeterShadowFree).toBe(true);
    expect(rgbToCieL(255, 255, 255)).toBeCloseTo(100, 0);
    expect(getInterPupillaryMidpoint(MOCK_PORTRAIT_FIXTURES.compliant_subject.mesh).x).toBe(600);
  });
});

