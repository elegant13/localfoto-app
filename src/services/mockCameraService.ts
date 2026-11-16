import { BiometricMesh, ImageBounds } from '../types/biometrics';

export type MockScenarioId =
  | 'compliant_subject'
  | 'tilted_head'
  | 'smiling_open_mouth'
  | 'voluminous_hair'
  | 'shadow_heavy_background'
  | 'glasses_wearing';

export interface MockPortraitFixture {
  id: MockScenarioId;
  label: string;
  description: string;
  imageBounds: ImageBounds;
  mesh: BiometricMesh;
}

export const MOCK_PORTRAIT_FIXTURES: Record<MockScenarioId, MockPortraitFixture> = {
  compliant_subject: {
    id: 'compliant_subject',
    label: 'Compliant Subject (Ideal)',
    description: 'Neutral expression, level head, uniform white background',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 600, y: 950 },
      skullForehead: { x: 600, y: 420 },
      segmentationCrownY: 350,
      leftEyePupil: { x: 510, y: 600 },
      rightEyePupil: { x: 690, y: 602 },
      mouthUpper: { x: 600, y: 815 },
      mouthLower: { x: 600, y: 820 },
      leftEyeEAR: 0.28,
      rightEyeEAR: 0.29,
      pitchDeg: 1.2,
      yawDeg: -0.8,
      backgroundDeltaL: 6.4,
      perimeterShadowDeltaL: 11.2,
      glassesConfidence: 0.04,
    },
  },
  tilted_head: {
    id: 'tilted_head',
    label: 'Tilted Head (+6.5° Roll)',
    description: 'Head tilted beyond ±2.5° threshold; tests affine roll correction',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 625, y: 950 },
      skullForehead: { x: 575, y: 420 },
      segmentationCrownY: 350,
      leftEyePupil: { x: 510, y: 590 },
      rightEyePupil: { x: 690, y: 611 },
      mouthUpper: { x: 605, y: 815 },
      mouthLower: { x: 605, y: 820 },
      leftEyeEAR: 0.27,
      rightEyeEAR: 0.27,
      pitchDeg: 0.5,
      yawDeg: 1.1,
      backgroundDeltaL: 5.5,
      perimeterShadowDeltaL: 10.0,
      glassesConfidence: 0.02,
    },
  },
  smiling_open_mouth: {
    id: 'smiling_open_mouth',
    label: 'Smiling / Open Mouth',
    description: 'Mouth open with teeth visible (inter-lip / IPD > 0.08)',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 600, y: 965 },
      skullForehead: { x: 600, y: 420 },
      segmentationCrownY: 350,
      leftEyePupil: { x: 510, y: 600 },
      rightEyePupil: { x: 690, y: 600 },
      mouthUpper: { x: 600, y: 810 },
      mouthLower: { x: 600, y: 842 },
      leftEyeEAR: 0.25,
      rightEyeEAR: 0.25,
      pitchDeg: 0.0,
      yawDeg: 0.0,
      backgroundDeltaL: 7.0,
      perimeterShadowDeltaL: 12.0,
      glassesConfidence: 0.03,
    },
  },
  voluminous_hair: {
    id: 'voluminous_hair',
    label: 'Voluminous Hair / Turban',
    description: 'True crown via semantic segmentation is 140px above Landmark 10',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 600, y: 960 },
      skullForehead: { x: 600, y: 460 },
      segmentationCrownY: 320,
      leftEyePupil: { x: 510, y: 610 },
      rightEyePupil: { x: 690, y: 610 },
      mouthUpper: { x: 600, y: 825 },
      mouthLower: { x: 600, y: 829 },
      leftEyeEAR: 0.28,
      rightEyeEAR: 0.28,
      pitchDeg: -1.0,
      yawDeg: 0.5,
      backgroundDeltaL: 8.2,
      perimeterShadowDeltaL: 14.5,
      glassesConfidence: 0.01,
    },
  },
  shadow_heavy_background: {
    id: 'shadow_heavy_background',
    label: 'Shadow-Heavy Background',
    description: 'Harsh wall lighting gradient and cast silhouette shadow behind head',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 600, y: 950 },
      skullForehead: { x: 600, y: 420 },
      segmentationCrownY: 350,
      leftEyePupil: { x: 510, y: 600 },
      rightEyePupil: { x: 690, y: 600 },
      mouthUpper: { x: 600, y: 815 },
      mouthLower: { x: 600, y: 819 },
      leftEyeEAR: 0.29,
      rightEyeEAR: 0.29,
      pitchDeg: 0.5,
      yawDeg: -0.5,
      backgroundDeltaL: 19.5,
      perimeterShadowDeltaL: 34.0,
      glassesConfidence: 0.05,
    },
  },
  glasses_wearing: {
    id: 'glasses_wearing',
    label: 'Eyeglasses Detected',
    description: 'Subject wearing glasses with nasal bridge specular reflection',
    imageBounds: { width: 1200, height: 1600 },
    mesh: {
      chinTip: { x: 600, y: 950 },
      skullForehead: { x: 600, y: 420 },
      segmentationCrownY: 350,
      leftEyePupil: { x: 510, y: 600 },
      rightEyePupil: { x: 690, y: 600 },
      mouthUpper: { x: 600, y: 815 },
      mouthLower: { x: 600, y: 819 },
      leftEyeEAR: 0.28,
      rightEyeEAR: 0.28,
      pitchDeg: 0.0,
      yawDeg: 0.0,
      backgroundDeltaL: 6.0,
      perimeterShadowDeltaL: 9.5,
      glassesConfidence: 0.78,
    },
  },
};

/**
 * Renders a synthetic portrait onto a 2D canvas context for headless testing and simulation mode.
 */
export function drawSyntheticPortrait(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  fixture: MockPortraitFixture
): void {
  const { width, height } = fixture.imageBounds;
  const { mesh } = fixture;

  // 1. Background fill (pure off-white or shadowed wall)
  ctx.save();
  if (fixture.id === 'shadow_heavy_background') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#F9FAFB');
    grad.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#F7F7F5';
  }
  ctx.fillRect(0, 0, width, height);

  // Cast shadow behind head if shadow_heavy_background
  if (fixture.id === 'shadow_heavy_background') {
    ctx.fillStyle = 'rgba(80, 85, 95, 0.35)';
    ctx.beginPath();
    ctx.ellipse(645, 660, 220, 310, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Compute roll from eyes
  const dx = mesh.rightEyePupil.x - mesh.leftEyePupil.x;
  const dy = mesh.rightEyePupil.y - mesh.leftEyePupil.y;
  const rollRad = Math.atan2(dy, dx);
  const eyeCenterX = (mesh.leftEyePupil.x + mesh.rightEyePupil.x) / 2;
  const eyeCenterY = (mesh.leftEyePupil.y + mesh.rightEyePupil.y) / 2;

  // 2. Shoulders & Shirt Collar (below chin)
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(600, height - 120, 420, 360, 0, Math.PI, 0, false);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Neck
  ctx.fillStyle = '#E2B49A';
  ctx.fillRect(525, mesh.chinTip.y - 30, 150, 220);

  // Collar V-neck
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(510, mesh.chinTip.y + 110);
  ctx.lineTo(600, mesh.chinTip.y + 230);
  ctx.lineTo(690, mesh.chinTip.y + 110);
  ctx.closePath();
  ctx.fill();

  // Apply head rotation around eye midpoint
  ctx.translate(eyeCenterX, eyeCenterY);
  ctx.rotate(rollRad);
  ctx.translate(-eyeCenterX, -eyeCenterY);

  // 3. Hair / Crown volume (extending up to segmentationCrownY)
  const headCenterY = (mesh.skullForehead.y + mesh.chinTip.y) / 2;
  const headRx = 185;
  const headRy = (mesh.chinTip.y - mesh.skullForehead.y) / 2 + 30;

  ctx.fillStyle = '#27272A';
  if (fixture.id === 'voluminous_hair') {
    ctx.beginPath();
    ctx.ellipse(600, (mesh.segmentationCrownY + headCenterY) / 2 + 20, 235, headCenterY - mesh.segmentationCrownY + 40, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(600, headCenterY - 25, headRx + 14, headRy + 35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Face oval
  ctx.fillStyle = '#ECC5AC';
  ctx.beginPath();
  ctx.ellipse(600, headCenterY + 10, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // 5. Eyes & Pupils
  for (const pupil of [mesh.leftEyePupil, mesh.rightEyePupil]) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(pupil.x, eyeCenterY, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3B2F2F';
    ctx.beginPath();
    ctx.arc(pupil.x, eyeCenterY, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(pupil.x, eyeCenterY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyebrows
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const pupil of [mesh.leftEyePupil, mesh.rightEyePupil]) {
    ctx.beginPath();
    ctx.moveTo(pupil.x - 32, eyeCenterY - 28);
    ctx.quadraticCurveTo(pupil.x, eyeCenterY - 38, pupil.x + 32, eyeCenterY - 26);
    ctx.stroke();
  }

  // 6. Glasses if glasses_wearing
  if (fixture.id === 'glasses_wearing') {
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 6;
    ctx.strokeRect(mesh.leftEyePupil.x - 48, eyeCenterY - 30, 96, 60);
    ctx.strokeRect(mesh.rightEyePupil.x - 48, eyeCenterY - 30, 96, 60);
    // Bridge
    ctx.beginPath();
    ctx.moveTo(mesh.leftEyePupil.x + 48, eyeCenterY - 8);
    ctx.lineTo(mesh.rightEyePupil.x - 48, eyeCenterY - 8);
    ctx.stroke();
  }

  // 7. Nose
  ctx.strokeStyle = '#C6967A';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(600, eyeCenterY + 15);
  ctx.lineTo(592, eyeCenterY + 125);
  ctx.lineTo(612, eyeCenterY + 128);
  ctx.stroke();

  // 8. Mouth
  const lipGap = mesh.mouthLower.y - mesh.mouthUpper.y;
  ctx.strokeStyle = '#9F4A44';
  ctx.lineWidth = 6;
  if (lipGap > 12) {
    // Open mouth with visible teeth
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(600, (mesh.mouthUpper.y + mesh.mouthLower.y) / 2, 46, lipGap / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(555, mesh.mouthUpper.y);
    ctx.quadraticCurveTo(600, mesh.mouthLower.y, 645, mesh.mouthUpper.y);
    ctx.stroke();
  }

  ctx.restore();
}

