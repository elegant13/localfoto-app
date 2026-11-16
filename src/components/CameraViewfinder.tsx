import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Upload,
  Volume2,
  VolumeX,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Aperture,
  Sun,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  Ruler,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';
import {
  BiometricMesh,
  CropParameters,
  ImageBounds,
  ValidationReport,
} from '../types/biometrics';
import {
  MOCK_PORTRAIT_FIXTURES,
  MockScenarioId,
  drawSyntheticPortrait,
} from '../services/mockCameraService';
import {
  VisionWorkerRequest,
  VisionWorkerResultMessage,
  VisionWorkerStatusMessage,
} from '../workers/visionWorker';
import { evaluateBiometricValidation } from '../utils/cropMath';

export interface CapturePayload {
  sourceCanvas: HTMLCanvasElement;
  mesh: BiometricMesh;
  report: ValidationReport;
  crop: CropParameters;
}

interface CameraViewfinderProps {
  activeProfile: PhotoProfile;
  onCaptureReady: (payload: CapturePayload) => void;
}

type HudStatusColor = 'red' | 'amber' | 'green';
type WizardStage = 'lighting_guide' | 'camera_choice' | 'fullscreen_camera';

interface VisibleViewport {
  visX: number;
  visY: number;
  visW: number;
  visH: number;
}

function computeObjectCoverViewport(
  bounds: ImageBounds,
  targetAspect: number
): VisibleViewport {
  const srcW = Math.max(1, bounds.width);
  const srcH = Math.max(1, bounds.height);
  const srcAspect = srcW / srcH;

  let visW: number;
  let visH: number;
  if (srcAspect > targetAspect) {
    visH = srcH;
    visW = srcH * targetAspect;
  } else {
    visW = srcW;
    visH = srcW / targetAspect;
  }

  return {
    visX: (srcW - visW) / 2,
    visY: (srcH - visH) / 2,
    visW,
    visH,
  };
}

function createFallbackMeshForBounds(w: number, h: number): BiometricMesh {
  return {
    chinTip: { x: w * 0.5, y: h * 0.64 },
    skullForehead: { x: w * 0.5, y: h * 0.28 },
    segmentationCrownY: h * 0.22,
    leftEyePupil: { x: w * 0.42, y: h * 0.41 },
    rightEyePupil: { x: w * 0.58, y: h * 0.41 },
    mouthUpper: { x: w * 0.5, y: h * 0.54 },
    mouthLower: { x: w * 0.5, y: h * 0.544 },
    leftEyeEAR: 0.28,
    rightEyeEAR: 0.28,
    pitchDeg: 0,
    yawDeg: 0,
    backgroundDeltaL: 5.8,
    perimeterShadowDeltaL: 10.2,
    glassesConfidence: 0.02,
  };
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  activeProfile,
  onCaptureReady,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef<boolean>(false);
  const frameIdRef = useRef<number>(0);
  const validSinceRef = useRef<number | null>(null);
  const consecutiveCompliantFramesRef = useRef<number>(0);
  const autoCapturedRef = useRef<boolean>(false);
  const modeRef = useRef<'camera' | 'simulation' | 'upload'>('camera');
  const activeProfileRef = useRef<PhotoProfile>(activeProfile);
  activeProfileRef.current = activeProfile;

  const lastSpokenCueRef = useRef<{ text: string; time: number }>({
    text: '',
    time: 0,
  });

  const [wizardStage, setWizardStage] = useState<WizardStage>('lighting_guide');
  const [mode, setMode] = useState<'camera' | 'simulation' | 'upload'>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedScenario, setSelectedScenario] =
    useState<MockScenarioId>('compliant_subject');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [autoShutterEnabled, setAutoShutterEnabled] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lockProgressPct, setLockProgressPct] = useState<number>(0);

  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [currentMesh, setCurrentMesh] = useState<BiometricMesh | null>(null);
  const [currentBounds, setCurrentBounds] = useState<ImageBounds>({
    width: 1200,
    height: 1600,
  });
  const [validationReport, setValidationReport] =
    useState<ValidationReport | null>(null);
  const [currentCrop, setCurrentCrop] = useState<CropParameters | null>(null);
  const [hudState, setHudState] = useState<HudStatusColor>('red');
  const [liveInstruction, setLiveInstruction] = useState<string>(
    'Position your face inside the oval'
  );
  const [positioningHint, setPositioningHint] = useState<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const speakCue = useCallback(
    (message: string) => {
      if (
        !audioEnabled ||
        wizardStage !== 'fullscreen_camera' ||
        typeof window === 'undefined' ||
        !('speechSynthesis' in window)
      ) {
        return;
      }
      const now = performance.now();
      if (
        lastSpokenCueRef.current.text === message &&
        now - lastSpokenCueRef.current.time < 4500
      ) {
        return;
      }
      if (now - lastSpokenCueRef.current.time < 2200) {
        return;
      }
      lastSpokenCueRef.current = { text: message, time: now };
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [audioEnabled, wizardStage]
  );

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetBiometricLockState = useCallback(() => {
    validSinceRef.current = null;
    consecutiveCompliantFramesRef.current = 0;
    setLockProgressPct(0);
    setFaceDetected(false);
    setCurrentMesh(null);
    setValidationReport(null);
    setCurrentCrop(null);
    setHudState('red');
    setPositioningHint(null);
    setLiveInstruction('Position your face inside the oval');
  }, []);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (
        event: MessageEvent<VisionWorkerResultMessage | VisionWorkerStatusMessage>
      ) => {
        if (event.data?.type === 'FRAME_RESULT') {
          workerBusyRef.current = false;
          if (event.data.frameId < frameIdRef.current - 3) {
            return;
          }

          const { faceDetected: detected, mesh, report, crop } = event.data;
          if (!detected || !mesh || !report || !crop) {
            consecutiveCompliantFramesRef.current = 0;
            validSinceRef.current = null;
            setFaceDetected(false);
            setCurrentMesh(null);
            setValidationReport(null);
            setCurrentCrop(null);
            setPositioningHint(null);
            return;
          }

          const prof = activeProfileRef.current;
          let finalReport = report;
          let hint: string | null = null;

          if (modeRef.current === 'camera') {
            const video = videoRef.current;
            const bounds: ImageBounds = {
              width: video?.videoWidth || 1200,
              height: video?.videoHeight || 1600,
            };
            const vp = computeObjectCoverViewport(bounds, prof.aspectRatio);

            const yCrown = Math.min(
              mesh.segmentationCrownY,
              mesh.skullForehead.y
            );
            const yChin = mesh.chinTip.y;
            const headHeightPx = Math.max(1, yChin - yCrown);
            const eyeMidX = (mesh.leftEyePupil.x + mesh.rightEyePupil.x) / 2;
            const eyeMidY = (mesh.leftEyePupil.y + mesh.rightEyePupil.y) / 2;

            const hudHeadRatio = headHeightPx / vp.visH;
            const isHudHeadSizeValid =
              hudHeadRatio >= prof.headConstraints.minRatio &&
              hudHeadRatio <= prof.headConstraints.maxRatio;

            const hudEyeFromBottom = (vp.visY + vp.visH - eyeMidY) / vp.visH;
            const eyeMin = prof.eyeConstraints?.minFromBottom ?? 0.56;
            const eyeMax = prof.eyeConstraints?.maxFromBottom ?? 0.69;
            const isHudEyeVerticalValid =
              hudEyeFromBottom >= eyeMin && hudEyeFromBottom <= eyeMax;

            const hudHorizontalOffset =
              Math.abs(eyeMidX - (vp.visX + vp.visW / 2)) / vp.visW;
            const isHudCenteredHorizontally = hudHorizontalOffset <= 0.09;

            const hudChinClearance = (vp.visY + vp.visH - yChin) / vp.visH;
            const isHudChinClearanceValid =
              hudChinClearance >= prof.chinBottomClearanceMin;

            const isLiveHeadCompliant =
              isHudHeadSizeValid && isHudChinClearanceValid;
            const isLiveEyeCompliant =
              isHudEyeVerticalValid && isHudCenteredHorizontally;

            if (!isHudCenteredHorizontally) {
              hint = 'Center your face inside the oval';
            } else if (hudHeadRatio < prof.headConstraints.minRatio) {
              hint = 'Too far — move closer to fill the oval';
            } else if (hudHeadRatio > prof.headConstraints.maxRatio) {
              hint = 'Too close — hold phone slightly further back';
            } else if (hudEyeFromBottom < eyeMin) {
              hint = 'Eyes too low — tilt or lower camera slightly';
            } else if (hudEyeFromBottom > eyeMax) {
              hint = 'Eyes too high — raise camera slightly';
            } else if (!isHudChinClearanceValid) {
              hint = 'Leave space below chin for shoulders';
            }

            const overallPass =
              isLiveHeadCompliant &&
              isLiveEyeCompliant &&
              report.isRollCompliant &&
              report.isPitchYawCompliant &&
              report.isMouthClosed &&
              report.isBlinkFree &&
              report.isLightingUniform &&
              report.isHeadPerimeterShadowFree &&
              report.isGlassesFree;

            finalReport = {
              ...report,
              isHeadRatioCompliant: isLiveHeadCompliant,
              isEyeLevelCompliant: isLiveEyeCompliant,
              overallPass,
            };
          }

          if (finalReport.overallPass) {
            consecutiveCompliantFramesRef.current += 1;
          } else {
            consecutiveCompliantFramesRef.current = 0;
            validSinceRef.current = null;
          }

          setPositioningHint(hint);
          setFaceDetected(true);
          setCurrentMesh(mesh);
          setValidationReport(finalReport);
          setCurrentCrop(crop);
        }
      };
      worker.onerror = () => {
        workerBusyRef.current = false;
      };
      const initMsg: VisionWorkerRequest = { type: 'INIT' };
      worker.postMessage(initMsg);
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        const disposeMsg: VisionWorkerRequest = { type: 'DISPOSE' };
        workerRef.current.postMessage(disposeMsg);
        workerRef.current.terminate();
        workerRef.current = null;
      }
      stopCameraStream();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (
      wizardStage === 'fullscreen_camera' &&
      mode === 'camera' &&
      videoRef.current &&
      streamRef.current
    ) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [wizardStage, mode]);

  const launchFullScreenCamera = useCallback(
    async (chosenFacing: 'environment' | 'user') => {
      stopCameraStream();
      setCameraError(null);
      setFacingMode(chosenFacing);
      setMode('camera');
      modeRef.current = 'camera';
      autoCapturedRef.current = false;
      frameIdRef.current += 100;
      resetBiometricLockState();
      setWizardStage('fullscreen_camera');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          'Live camera API unavailable in this browser. Showing simulator.'
        );
        setMode('simulation');
        modeRef.current = 'simulation';
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: chosenFacing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
          }
        } catch {
          setCameraError(
            'Camera permission denied or no hardware camera detected. Using simulator.'
          );
          setMode('simulation');
          modeRef.current = 'simulation';
        }
      }
    },
    [stopCameraStream, resetBiometricLockState]
  );

  useEffect(() => {
    if (mode !== 'simulation') return;
    const fixture = MOCK_PORTRAIT_FIXTURES[selectedScenario];
    setCurrentBounds(fixture.imageBounds);
    const canvas = simCanvasRef.current;
    if (canvas) {
      canvas.width = fixture.imageBounds.width;
      canvas.height = fixture.imageBounds.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawSyntheticPortrait(ctx, fixture);
      }
    }
  }, [mode, selectedScenario, wizardStage]);

  const triggerCapture = useCallback(() => {
    const exportSourceCanvas = document.createElement('canvas');
    let bounds: ImageBounds = currentBounds;

    if (mode === 'camera' && videoRef.current) {
      const vw = videoRef.current.videoWidth || 1200;
      const vh = videoRef.current.videoHeight || 1600;
      exportSourceCanvas.width = vw;
      exportSourceCanvas.height = vh;
      bounds = { width: vw, height: vh };
      const ctx = exportSourceCanvas.getContext('2d');
      if (ctx) ctx.drawImage(videoRef.current, 0, 0);
    } else if (simCanvasRef.current) {
      exportSourceCanvas.width = simCanvasRef.current.width || 1200;
      exportSourceCanvas.height = simCanvasRef.current.height || 1600;
      bounds = {
        width: exportSourceCanvas.width,
        height: exportSourceCanvas.height,
      };
      const ctx = exportSourceCanvas.getContext('2d');
      if (ctx) ctx.drawImage(simCanvasRef.current, 0, 0);
    }

    stopCameraStream();

    const meshToUse =
      currentMesh ?? createFallbackMeshForBounds(bounds.width, bounds.height);
    const evaluated = evaluateBiometricValidation(
      meshToUse,
      activeProfile,
      bounds
    );

    onCaptureReady({
      sourceCanvas: exportSourceCanvas,
      mesh: meshToUse,
      report: validationReport ?? evaluated.report,
      crop: currentCrop ?? evaluated.crop,
    });
  }, [
    mode,
    currentBounds,
    currentMesh,
    validationReport,
    currentCrop,
    activeProfile,
    stopCameraStream,
    onCaptureReady,
  ]);

  useEffect(() => {
    if (wizardStage !== 'fullscreen_camera') return;

    const intervalMs = 100;
    const timer = window.setInterval(async () => {
      if (mode === 'simulation') {
        frameIdRef.current += 1;
        const frameId = frameIdRef.current;
        const fixture = MOCK_PORTRAIT_FIXTURES[selectedScenario];
        if (workerRef.current) {
          const req: VisionWorkerRequest = {
            type: 'PROCESS_FRAME',
            frameId,
            profile: activeProfile,
            mockMesh: fixture.mesh,
            imageBounds: fixture.imageBounds,
          };
          workerRef.current.postMessage(req);
        } else {
          const { report, crop } = evaluateBiometricValidation(
            fixture.mesh,
            activeProfile,
            fixture.imageBounds
          );
          setFaceDetected(true);
          setCurrentMesh(fixture.mesh);
          setValidationReport(report);
          setCurrentCrop(crop);
        }
      } else if (mode === 'camera' && videoRef.current) {
        const video = videoRef.current;
        if (
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          !workerBusyRef.current
        ) {
          const bounds: ImageBounds = {
            width: video.videoWidth,
            height: video.videoHeight,
          };
          setCurrentBounds(bounds);
          if (
            workerRef.current &&
            typeof createImageBitmap === 'function'
          ) {
            try {
              workerBusyRef.current = true;
              frameIdRef.current += 1;
              const frameId = frameIdRef.current;
              const bitmap = await createImageBitmap(video);
              const req: VisionWorkerRequest = {
                type: 'PROCESS_FRAME',
                frameId,
                profile: activeProfile,
                bitmap,
                imageBounds: bounds,
              };
              workerRef.current.postMessage(req, [bitmap]);
            } catch {
              workerBusyRef.current = false;
            }
          }
        }
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [wizardStage, mode, selectedScenario, activeProfile]);

  useEffect(() => {
    if (wizardStage !== 'fullscreen_camera') return;

    let rafId = 0;
    const holdDurationMs = 1400;
    const minConsecutiveFrames = mode === 'camera' ? 8 : 4;

    const updateHudLoop = () => {
      const now = performance.now();
      if (!faceDetected || !validationReport) {
        validSinceRef.current = null;
        setLockProgressPct(0);
        setHudState('red');
        setLiveInstruction('Position your face inside the oval');
        speakCue('Position your face inside the biometric oval.');
      } else if (
        validationReport.overallPass &&
        consecutiveCompliantFramesRef.current >= minConsecutiveFrames
      ) {
        if (validSinceRef.current === null) {
          validSinceRef.current = now;
        }
        const elapsed = now - validSinceRef.current;
        const pct = Math.min(100, Math.round((elapsed / holdDurationMs) * 100));
        setLockProgressPct(pct);

        setHudState('green');
        setLiveInstruction(`Hold steady — Auto-capturing (${pct}%)`);
        speakCue('Hold still. Capturing photo.');

        if (
          autoShutterEnabled &&
          !autoCapturedRef.current &&
          elapsed >= holdDurationMs
        ) {
          autoCapturedRef.current = true;
          triggerCapture();
        }
      } else if (validationReport.overallPass) {
        setHudState('amber');
        setLockProgressPct(15);
        setLiveInstruction('Aligned — hold still...');
      } else {
        validSinceRef.current = null;
        setLockProgressPct(0);
        const failedChecks = [
          !validationReport.isRollCompliant,
          !validationReport.isPitchYawCompliant,
          !validationReport.isMouthClosed,
          !validationReport.isBlinkFree,
          !validationReport.isLightingUniform,
          !validationReport.isHeadPerimeterShadowFree,
          !validationReport.isGlassesFree,
          !validationReport.isHeadRatioCompliant,
          !validationReport.isEyeLevelCompliant,
        ].filter(Boolean).length;

        setHudState(failedChecks >= 2 ? 'red' : 'amber');

        if (positioningHint) {
          setLiveInstruction(positioningHint);
          speakCue(positioningHint);
        } else if (!validationReport.isHeadRatioCompliant) {
          const msg = 'Move closer or further so your head fits the oval';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isEyeLevelCompliant) {
          const msg = 'Align your eyes inside the eye corridor';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isRollCompliant) {
          const msg = 'Level your head horizontally';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isPitchYawCompliant) {
          const msg = 'Look straight at the camera lens';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isMouthClosed) {
          const msg = 'Keep a neutral expression with mouth closed';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isBlinkFree) {
          const msg = 'Keep both eyes open';
          setLiveInstruction(msg);
          speakCue(msg);
        } else if (!validationReport.isGlassesFree) {
          const msg = 'Remove your eyeglasses';
          setLiveInstruction(msg);
          speakCue(msg);
        } else {
          const msg = 'Stand ~2 ft from wall for even front light';
          setLiveInstruction(msg);
          speakCue(msg);
        }
      }
      rafId = requestAnimationFrame(updateHudLoop);
    };

    rafId = requestAnimationFrame(updateHudLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    faceDetected,
    validationReport,
    positioningHint,
    wizardStage,
    mode,
    autoShutterEnabled,
    speakCue,
    triggerCapture,
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCameraStream();
    try {
      let bitmap: ImageBitmap;
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(file, {
          imageOrientation: 'from-image',
        });
      } else {
        return;
      }

      const w = bitmap.width;
      const h = bitmap.height;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
      }
      bitmap.close();

      const fallbackMesh = createFallbackMeshForBounds(w, h);
      const { report, crop } = evaluateBiometricValidation(
        fallbackMesh,
        activeProfile,
        { width: w, height: h }
      );
      onCaptureReady({
        sourceCanvas: exportCanvas,
        mesh: fallbackMesh,
        report,
        crop,
      });
    } catch {
      setCameraError('Could not decode uploaded image file.');
    }
  };

  // Material Design 3 Dynamic HUD Colors (Google Green / Google Amber / Google Coral Red)
  const hudStrokeColor =
    hudState === 'green'
      ? '#81C995'
      : hudState === 'amber'
      ? '#FDD663'
      : '#F28B82';

  const targetHeadRatio = activeProfile.headConstraints.targetRatio;
  const minHeadRatio = activeProfile.headConstraints.minRatio;
  const maxHeadRatio = activeProfile.headConstraints.maxRatio;
  const eyeMinFromBottom = activeProfile.eyeConstraints?.minFromBottom ?? 0.56;
  const eyeMaxFromBottom = activeProfile.eyeConstraints?.maxFromBottom ?? 0.69;

  const eyeTopY = (1 - eyeMaxFromBottom) * 100;
  const eyeBottomY = (1 - eyeMinFromBottom) * 100;
  const eyeCenterY = (eyeTopY + eyeBottomY) / 2;

  const targetOvalRy = (targetHeadRatio * 100) / 2;
  const targetOvalRx = targetOvalRy * 0.72;
  const minOvalRy = (minHeadRatio * 100) / 2;
  const maxOvalRy = (maxHeadRatio * 100) / 2;
  const ovalCenterY = eyeCenterY + targetOvalRy * 0.12;

  const visibleVp = computeObjectCoverViewport(
    currentBounds,
    activeProfile.aspectRatio
  );
  const normPt = (pt: { x: number; y: number }) => {
    const rawX = ((pt.x - visibleVp.visX) / Math.max(1, visibleVp.visW)) * 100;
    const rawY = ((pt.y - visibleVp.visY) / Math.max(1, visibleVp.visH)) * 100;
    return {
      x: mode === 'camera' && facingMode === 'user' ? 100 - rawX : rawX,
      y: rawY,
    };
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Hidden simulation canvas for automated tests & simulator fallback */}
      <canvas ref={simCanvasRef} className="hidden" />

      {/* M3 Segmented Progress Bar (Steps 1 & 2) */}
      {wizardStage !== 'fullscreen_camera' && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 flex-1 rounded-full bg-[#0B57D0]" />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                wizardStage === 'camera_choice'
                  ? 'bg-[#0B57D0]'
                  : 'bg-[#D3E3FD]'
              }`}
            />
            <div className="h-1.5 flex-1 rounded-full bg-[#D3E3FD]" />
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-[#444746]">
            <span>
              {wizardStage === 'lighting_guide'
                ? 'Step 1 of 3 • Environment & Light'
                : 'Step 2 of 3 • Select Camera'}
            </span>
            <span className="text-[#0B57D0] font-semibold">
              {activeProfile.displayName}
            </span>
          </div>
        </div>
      )}

      {/* STEP 1: MATERIAL 3 ENVIRONMENT & LIGHTING SETUP */}
      {wizardStage === 'lighting_guide' && (
        <div className="space-y-4">
          {/* M3 Hero Header Card */}
          <div className="bg-[#D3E3FD]/55 rounded-[28px] p-5 border border-[#D3E3FD]">
            <h2 className="text-2xl font-bold text-[#041E49] tracking-tight">
              Set up your lighting &amp; background
            </h2>
            <p className="text-sm text-[#1F1F1F]/80 mt-1 leading-relaxed">
              Follow these 3 quick guidelines so your passport photo passes
              biometric checks on the first take.
            </p>
          </div>

          {/* 3 Material 3 Surface Cards */}
          <div className="space-y-3">
            <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0 font-bold text-sm">
                <Ruler className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1F1F1F]">
                    Stand ~2 ft from a white wall
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
                  Stand about <strong>2 feet in front</strong> of a plain white
                  or off-white wall so your head doesn&apos;t cast a dark shadow
                  behind you.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF7E0] text-[#B06000] flex items-center justify-center shrink-0">
                <Sun className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-[#1F1F1F]">
                  Light falling from the front
                </h3>
                <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
                  Face a window or room lamp directly so{' '}
                  <strong>even light falls on the front of your face</strong>{' '}
                  with no side shadows or backlighting.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] text-[#137333] flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-[#1F1F1F]">
                  Remove glasses &amp; neutral pose
                </h3>
                <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
                  Take off eyeglasses and hats. Look straight ahead with
                  shoulders level and your mouth closed.
                </p>
              </div>
            </div>
          </div>

          {/* M3 Tonal Privacy Chip Card */}
          <div className="bg-[#EDF2FA] rounded-2xl px-4 py-3 flex items-center gap-3 text-xs text-[#041E49]">
            <ShieldCheck className="w-5 h-5 text-[#0B57D0] shrink-0" />
            <span>
              <strong>100% On-Device Privacy:</strong> All biometric checks and
              4×6&quot; sheet creation run locally in your browser.
            </span>
          </div>

          {/* M3 Sticky Mobile Bottom Action Bar */}
          <div className="fixed bottom-0 inset-x-0 z-20 bg-[#F8FAFD]/95 backdrop-blur-md border-t border-[#E1E3E1] p-4 sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:pt-2">
            <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => setWizardStage('camera_choice')}
                className="w-full h-14 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] active:bg-[#062E6F] text-white font-bold text-base shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Next: Choose Camera</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <label className="w-full sm:w-auto sm:shrink-0 h-12 px-5 rounded-full bg-[#D3E3FD] hover:bg-[#C2D7FC] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition">
                <Upload className="w-4 h-4 text-[#0B57D0]" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2A: MATERIAL 3 CAMERA LENS SELECTION */}
      {wizardStage === 'camera_choice' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
                Select your camera
              </h2>
              <p className="text-sm text-[#444746] mt-0.5">
                Opens in full screen with live alignment guides and auto-shutter
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWizardStage('lighting_guide')}
              className="h-10 px-4 rounded-full bg-[#EDF2FA] hover:bg-[#E4EBF5] text-[#041E49] text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          {/* Option 1: Rear Camera (Primary M3 Card) */}
          <div
            onClick={() => launchFullScreenCamera('environment')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                launchFullScreenCamera('environment');
              }
            }}
            className="bg-white hover:bg-[#F3F6FC] rounded-[28px] p-5 m3-elevation-2 border-2 border-[#0B57D0] transition cursor-pointer space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F4EA] text-[#137333]">
                Recommended • Best Quality
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#1F1F1F]">
                Rear Camera (Back Lens)
              </h3>
              <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
                Uses your phone&apos;s main rear camera sensor with zero wide-angle
                distortion. Best when someone holds the phone ~4 ft away or with
                voice guidance enabled.
              </p>
            </div>

            <div className="w-full h-12 rounded-full bg-[#0B57D0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs">
              <Camera className="w-4 h-4" />
              <span>Open Rear Camera</span>
            </div>
          </div>

          {/* Option 2: Front Camera (Secondary M3 Card) */}
          <div
            onClick={() => launchFullScreenCamera('user')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                launchFullScreenCamera('user');
              }
            }}
            className="bg-white hover:bg-[#F3F6FC] rounded-[28px] p-5 m3-elevation-1 border border-[#C4C7C5] transition cursor-pointer space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EDF2FA] text-[#041E49] flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EDF2FA] text-[#444746]">
                Solo Selfie Mode
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#1F1F1F]">
                Front Camera (Selfie Lens)
              </h3>
              <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
                Take your own photo while watching the biometric oval and eye
                corridor guides on your screen.
              </p>
            </div>

            <div className="w-full h-12 rounded-full bg-[#D3E3FD] text-[#041E49] font-semibold text-sm flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4 text-[#0B57D0]" />
              <span>Open Front Camera</span>
            </div>
          </div>

          {/* Bottom Secondary Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-[#444746]">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-[#EDF2FA] text-[#0B57D0] cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>Import existing photo from gallery</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                resetBiometricLockState();
                setMode('simulation');
                modeRef.current = 'simulation';
                setWizardStage('fullscreen_camera');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-[#EDF2FA] text-[#444746] cursor-pointer transition"
            >
              <Sparkles className="w-4 h-4 text-[#0B57D0]" />
              <span>Biometric Simulator</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2B: PIXEL CAMERA-STYLE FULL-SCREEN BIOMETRIC VIEWFINDER */}
      {wizardStage === 'fullscreen_camera' && (
        <div className="fixed inset-0 z-50 bg-[#0E0E0F] text-white flex flex-col justify-between overflow-hidden select-none">
          {/* Top Material 3 Floating Camera Bar */}
          <div className="relative z-20 px-4 pt-3 pb-2.5 bg-gradient-to-b from-black/85 via-black/50 to-transparent flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                resetBiometricLockState();
                setWizardStage('camera_choice');
              }}
              className="w-10 h-10 rounded-full bg-[#1F1F1F]/85 hover:bg-[#2D2E30] border border-white/10 flex items-center justify-center text-white shrink-0 cursor-pointer active:scale-95 transition"
              aria-label="Back to camera selection"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* M3 Dynamic Guidance Pill */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1F1F1F]/90 backdrop-blur-md border border-white/15 shadow-lg max-w-[68vw] sm:max-w-md">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  hudState === 'green'
                    ? 'bg-[#81C995] animate-ping'
                    : hudState === 'amber'
                    ? 'bg-[#FDD663]'
                    : 'bg-[#F28B82]'
                }`}
              />
              <span className="text-xs font-medium text-white truncate">
                {liveInstruction}
              </span>
            </div>

            {/* Right Quick Toggles: Auto-Shutter & Voice */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAutoShutterEnabled((prev) => !prev);
                  autoCapturedRef.current = false;
                  validSinceRef.current = null;
                }}
                className={`h-10 px-3 rounded-full border text-xs font-medium flex items-center gap-1 cursor-pointer transition ${
                  autoShutterEnabled
                    ? 'bg-[#0F5223]/90 border-[#81C995]/50 text-[#C4EED0]'
                    : 'bg-[#1F1F1F]/85 border-white/10 text-[#C4C7C5]'
                }`}
                title="Toggle Auto-Capture"
              >
                <Aperture className="w-4 h-4" />
                <span className="hidden xs:inline">
                  {autoShutterEnabled ? 'Auto' : 'Manual'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAudioEnabled((prev) => !prev)}
                className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer transition ${
                  audioEnabled
                    ? 'bg-[#0842A0]/90 border-[#8AB4F8]/50 text-[#D3E3FD]'
                    : 'bg-[#1F1F1F]/85 border-white/10 text-[#C4C7C5]'
                }`}
                title="Toggle Voice Guidance"
              >
                {audioEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Center Viewport with Pixel-Style Rounded Camera Frame & Biometric HUD */}
          <div className="relative flex-1 w-full flex items-center justify-center px-3 overflow-hidden">
            <div
              className="relative w-full max-w-[460px] max-h-[72vh] rounded-[28px] overflow-hidden border-2 border-white/15 shadow-2xl bg-black flex items-center justify-center"
              style={{ aspectRatio: `${activeProfile.aspectRatio}` }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  mode === 'camera' ? 'block' : 'hidden'
                } ${
                  mode === 'camera' && facingMode === 'user'
                    ? '-scale-x-100'
                    : ''
                }`}
              />

              {mode !== 'camera' && (
                <div className="w-full h-full flex items-center justify-center bg-[#1F1F1F] p-6 text-center">
                  <p className="text-xs text-[#C4C7C5]">
                    {cameraError ||
                      'Biometric Simulator Active — Select a scenario below or tap the Shutter Pill'}
                  </p>
                </div>
              )}

              {/* 60 FPS Dynamic SVG Biometric HUD Overlay */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
                data-testid="biometric-svg-hud"
              >
                {/* Outer Max Crown/Chin Tolerance Oval */}
                <ellipse
                  cx="50"
                  cy={ovalCenterY}
                  rx={targetOvalRx * 1.1}
                  ry={maxOvalRy}
                  fill="none"
                  stroke={hudStrokeColor}
                  strokeWidth="0.4"
                  strokeDasharray="1.5 1.5"
                  opacity="0.55"
                />

                {/* Target Biometric Head Ratio Oval */}
                <ellipse
                  cx="50"
                  cy={ovalCenterY}
                  rx={targetOvalRx}
                  ry={targetOvalRy}
                  fill="none"
                  stroke={hudStrokeColor}
                  strokeWidth="0.9"
                />

                {/* Inner Min Head Ratio Oval */}
                <ellipse
                  cx="50"
                  cy={ovalCenterY}
                  rx={targetOvalRx * 0.88}
                  ry={minOvalRy}
                  fill="none"
                  stroke={hudStrokeColor}
                  strokeWidth="0.4"
                  strokeDasharray="1.5 1.5"
                  opacity="0.55"
                />

                {/* Eye Horizon Compliance Corridor */}
                <rect
                  x="12"
                  y={eyeTopY}
                  width="76"
                  height={Math.max(1, eyeBottomY - eyeTopY)}
                  fill={hudStrokeColor}
                  opacity="0.15"
                />
                <line
                  x1="12"
                  y1={eyeCenterY}
                  x2="88"
                  y2={eyeCenterY}
                  stroke={hudStrokeColor}
                  strokeWidth="0.45"
                  strokeDasharray="2 1"
                />
                <text
                  x="50"
                  y={eyeTopY - 1.3}
                  fill={hudStrokeColor}
                  fontSize="2.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ALIGN EYES IN THIS BAND
                </text>

                {/* Vertical Symmetry Axis */}
                <line
                  x1="50"
                  y1="6"
                  x2="50"
                  y2="94"
                  stroke={hudStrokeColor}
                  strokeWidth="0.3"
                  strokeDasharray="1 2"
                  opacity="0.55"
                />

                {/* Neck & Shoulder Clearance Line */}
                <line
                  x1="20"
                  y1={100 - activeProfile.chinBottomClearanceMin * 100}
                  x2="80"
                  y2={100 - activeProfile.chinBottomClearanceMin * 100}
                  stroke="#E3E3E3"
                  strokeWidth="0.35"
                  strokeDasharray="1.5 1.5"
                  opacity="0.75"
                />
                <text
                  x="50"
                  y={99 - activeProfile.chinBottomClearanceMin * 100}
                  fill="#E3E3E3"
                  fontSize="2.2"
                  textAnchor="middle"
                  opacity="0.85"
                >
                  SHOULDER CLEARANCE
                </text>

                {/* Live Detected Biometric Landmarks Feedback */}
                {faceDetected && currentMesh && (
                  <g opacity="0.95">
                    <circle
                      cx={normPt(currentMesh.leftEyePupil).x}
                      cy={normPt(currentMesh.leftEyePupil).y}
                      r="1.2"
                      fill="#78D9EC"
                    />
                    <circle
                      cx={normPt(currentMesh.rightEyePupil).x}
                      cy={normPt(currentMesh.rightEyePupil).y}
                      r="1.2"
                      fill="#78D9EC"
                    />
                    <circle
                      cx={normPt(currentMesh.chinTip).x}
                      cy={normPt(currentMesh.chinTip).y}
                      r="1.1"
                      fill={hudStrokeColor}
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Bottom Pixel Camera Deck: M3 Status Chips + Shutter Pill + Lens Flip */}
          <div className="relative z-20 px-4 pt-3 pb-7 bg-[#141416]/95 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-3.5">
            {/* M3 Biometric Assist Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
              {[
                {
                  label: 'Head Size',
                  ok: validationReport?.isHeadRatioCompliant ?? false,
                },
                {
                  label: 'Eye Level',
                  ok: validationReport?.isEyeLevelCompliant ?? false,
                },
                {
                  label: 'Level Pose',
                  ok: validationReport?.isRollCompliant ?? false,
                },
                {
                  label: 'Mouth Closed',
                  ok: validationReport?.isMouthClosed ?? false,
                },
                {
                  label: 'Lighting',
                  ok: validationReport?.isLightingUniform ?? false,
                },
              ].map((chip, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    chip.ok
                      ? 'bg-[#0F5223] border-[#81C995]/50 text-[#C4EED0]'
                      : 'bg-[#1F1F1F] border-white/10 text-[#C4C7C5]'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3 h-3 ${
                      chip.ok ? 'text-[#81C995]' : 'text-white/30'
                    }`}
                  />
                  {chip.label}
                </span>
              ))}
            </div>

            {/* Pixel Camera 3-Column Shutter Row */}
            <div className="w-full max-w-md flex items-center justify-between gap-3 px-2">
              {/* Left: Import Photo Tonal Circle Button */}
              <label
                className="w-12 h-12 rounded-full bg-[#2D2E30] hover:bg-[#3C4043] border border-white/10 flex items-center justify-center text-white cursor-pointer active:scale-95 transition shrink-0"
                title="Import photo from gallery"
              >
                <Upload className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Center: Prominent Material 3 Shutter Click Pill */}
              <button
                type="button"
                onClick={() => {
                  autoCapturedRef.current = true;
                  triggerCapture();
                }}
                className={`flex-1 h-14 px-5 rounded-full font-bold text-sm shadow-xl flex items-center justify-center gap-2.5 transition active:scale-95 cursor-pointer ${
                  hudState === 'green'
                    ? 'bg-[#81C995] text-[#0F5223] ring-4 ring-[#81C995]/30'
                    : 'bg-[#D3E3FD] hover:bg-white text-[#041E49] ring-4 ring-white/15'
                }`}
                data-testid="shutter-click-pill"
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    hudState === 'green'
                      ? 'border-[#0F5223] bg-[#0F5223]'
                      : 'border-[#041E49] bg-[#0B57D0]'
                  }`}
                />
                <span className="truncate">
                  {hudState === 'green'
                    ? `Locked (${lockProgressPct}%) — Capturing`
                    : 'Shutter — Take Photo'}
                </span>
              </button>

              {/* Right: Flip Lens Tonal Circle Button */}
              <button
                type="button"
                onClick={() => {
                  const next =
                    facingMode === 'environment' ? 'user' : 'environment';
                  launchFullScreenCamera(next);
                }}
                className="w-12 h-12 rounded-full bg-[#2D2E30] hover:bg-[#3C4043] border border-white/10 flex items-center justify-center text-white cursor-pointer active:scale-95 transition shrink-0"
                title="Switch between Front and Rear Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Simulator Scenario Bar when in Simulator Mode */}
            {mode === 'simulation' && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {(
                  Object.keys(MOCK_PORTRAIT_FIXTURES) as MockScenarioId[]
                ).map((scenarioId) => (
                  <button
                    key={scenarioId}
                    type="button"
                    onClick={() => {
                      resetBiometricLockState();
                      setSelectedScenario(scenarioId);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] border cursor-pointer transition ${
                      selectedScenario === scenarioId
                        ? 'bg-[#D3E3FD] border-[#8AB4F8] text-[#041E49] font-semibold'
                        : 'bg-[#1F1F1F] border-white/10 text-[#C4C7C5]'
                    }`}
                  >
                    {MOCK_PORTRAIT_FIXTURES[scenarioId].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
