import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSheetLayout,
  disposeSingletonCanvases,
  generateDigitalPassportPhoto,
  generatePrintCompositeSheet,
  parseJpegDpiMetadata,
  resolveBlobBytes,
} from '../src/utils/compositeCanvas';
import {
  US_PASSPORT_PROFILE,
  SCHENGEN_VISA_PROFILE,
  CHINA_VISA_PROFILE,
  MEXICO_PASSPORT_PROFILE,
} from '../src/profiles/registry';
import { MOCK_PORTRAIT_FIXTURES } from '../src/services/mockCameraService';
import {
  evaluateBiometricValidation,
  getInterPupillaryMidpoint,
} from '../src/utils/cropMath';
import {
  disposeVisionWorkerResources,
  processVisionWorkerRequest,
} from '../src/workers/visionWorker';
import {
  evaluateStoreConnection,
  findNearbyPrintStores,
} from '../src/services/printStoreService';

// Provide a lightweight Canvas 2D and toBlob mock for JSDOM if native canvas package isn't installed
beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = function (callback) {
    const w = this.width || 1800;
    const h = this.height || 1200;
    const minimalJpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xc0, 0x00, 0x11, 0x08, // SOF0
      (h >> 8) & 0xff, h & 0xff,
      (w >> 8) & 0xff, w & 0xff,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xff, 0xd9, // EOI
    ]);
    callback(new Blob([minimalJpeg], { type: 'image/jpeg' }));
  };

  HTMLCanvasElement.prototype.getContext = function () {
    return {
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {},
      drawImage: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      ellipse: () => {},
      closePath: () => {},
      quadraticCurveTo: () => {},
      fillText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      fillStyle: '#FFFFFF',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '16px sans-serif',
      textAlign: 'center',
      lineCap: 'round',
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('Phase 5 & 6: 4x6 Print Sheet Compositor, 300 DPI JFIF Metadata & Resource Teardown', () => {
  it('allocates a 2-up centered layout on an 1800x1200 px (4x6" @ 300 DPI) canvas with >= 0.5" safe margins for US Passport', () => {
    const layout = computeSheetLayout(US_PASSPORT_PROFILE);

    expect(layout.sheetWidthPx).toBe(1800);
    expect(layout.sheetHeightPx).toBe(1200);
    expect(layout.tileWidthPx).toBe(600);
    expect(layout.tileHeightPx).toBe(600);
    expect(layout.safeMarginPx).toBe(150); // 0.5" * 300 DPI
    expect(layout.tiles.length).toBe(2);

    for (const tile of layout.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(150);
      expect(tile.y).toBeGreaterThanOrEqual(150);
      expect(tile.x + tile.width).toBeLessThanOrEqual(1800 - 150);
      expect(tile.y + tile.height).toBeLessThanOrEqual(1200 - 150);
    }
  });

  it('dynamically packs Schengen 35x45mm tiles into the 1800x1200 px safe area without modifying compositor code', () => {
    const layout = computeSheetLayout(SCHENGEN_VISA_PROFILE);
    expect(layout.sheetWidthPx).toBe(1800);
    expect(layout.sheetHeightPx).toBe(1200);
    expect(layout.tiles.length).toBeGreaterThanOrEqual(2);
    for (const tile of layout.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(150);
      expect(tile.y).toBeGreaterThanOrEqual(150);
    }
  });

  it('exports an 1800x1200 px 4x6 print sheet JPEG with verified JFIF & EXIF 300 DPI tags and sRGB color space', async () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.compliant_subject;
    const { crop } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    const eyePivot = getInterPupillaryMidpoint(fixture.mesh);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = fixture.imageBounds.width;
    sourceCanvas.height = fixture.imageBounds.height;

    const { blob, layout } = await generatePrintCompositeSheet(
      sourceCanvas,
      crop,
      eyePivot,
      US_PASSPORT_PROFILE
    );

    expect(layout.sheetWidthPx).toBe(1800);
    expect(layout.sheetHeightPx).toBe(1200);
    expect(blob.type).toBe('image/jpeg');

    const bytes = (await resolveBlobBytes(blob))!;
    const meta = parseJpegDpiMetadata(bytes);

    // Verify JFIF 300 DPI tags
    expect(meta.jfifUnits).toBe(1); // 1 = dots per inch
    expect(meta.jfifXDensity).toBe(300);
    expect(meta.jfifYDensity).toBe(300);

    // Verify EXIF 300 DPI tags (XResolution=300, YResolution=300, ResolutionUnit=2) & sRGB ColorSpace=1
    expect(meta.exifResolutionUnit).toBe(2);
    expect(meta.exifXResolution).toBe(300);
    expect(meta.exifYResolution).toBe(300);
    expect(meta.colorSpaceSrgb).toBe(true);
  });

  it('exports a 1200x1200 px digital passport JPEG (< 10 MB, 300 DPI, sRGB)', async () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.compliant_subject;
    const { crop } = evaluateBiometricValidation(
      fixture.mesh,
      US_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    const eyePivot = getInterPupillaryMidpoint(fixture.mesh);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = fixture.imageBounds.width;
    sourceCanvas.height = fixture.imageBounds.height;

    const digital = await generateDigitalPassportPhoto(
      sourceCanvas,
      crop,
      eyePivot,
      US_PASSPORT_PROFILE
    );

    expect(digital.widthPx).toBe(1200);
    expect(digital.heightPx).toBe(1200);
    expect(digital.blob.size).toBeLessThan(
      US_PASSPORT_PROFILE.digitalSubmissionSpec.maxFileSizeBytes
    );

    const bytes = (await resolveBlobBytes(digital.blob))!;
    const meta = parseJpegDpiMetadata(bytes);
    expect(meta.jfifXDensity).toBe(300);
    expect(meta.colorSpaceSrgb).toBe(true);
  });

  it('cleanly disposes VisionWorker resources, ImageBitmaps, and singleton OffscreenCanvas buffers without leaks', () => {
    let bitmapClosed = false;
    const mockBitmap = {
      width: 1200,
      height: 1600,
      close: () => {
        bitmapClosed = true;
      },
    } as unknown as ImageBitmap;

    const res = processVisionWorkerRequest({
      type: 'PROCESS_FRAME',
      frameId: 42,
      profile: US_PASSPORT_PROFILE,
      bitmap: mockBitmap,
      mockMesh: MOCK_PORTRAIT_FIXTURES.compliant_subject.mesh,
      imageBounds: { width: 1200, height: 1600 },
    });

    expect(res.faceDetected).toBe(true);
    expect(res.report?.overallPass).toBe(true);
    expect(bitmapClosed).toBe(true);

    expect(() => disposeVisionWorkerResources()).not.toThrow();
    expect(() => disposeSingletonCanvases()).not.toThrow();
  });

  it('discovers nearby local photo stores by ZIP or coordinates and evaluates store API handoff mechanics', async () => {
    const byZip = await findNearbyPrintStores({ zipCode: '94043' });
    expect(byZip.locationLabel).toContain('94043');
    expect(byZip.stores.length).toBeGreaterThanOrEqual(4);

    const walgreens = byZip.stores.find((s) => s.brand === 'walgreens')!;
    expect(walgreens).toBeDefined();

    const evalResult = evaluateStoreConnection(walgreens, 'us_passport');
    expect(evalResult.payloadMetadata.dpi).toBe(300);
    expect(evalResult.payloadMetadata.printSizeInches).toContain('4 × 6');
    expect(evalResult.technicalSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('produces exact 33x48mm (3-up) print tiles and 385x560px COVA digital output for China, and 35x45mm (3-up) + 1200x1543px for Mexico', async () => {
    const fixture = MOCK_PORTRAIT_FIXTURES.compliant_subject;
    const eyePivot = getInterPupillaryMidpoint(fixture.mesh);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = fixture.imageBounds.width;
    sourceCanvas.height = fixture.imageBounds.height;

    // China Visa (33x48 mm)
    const chinaLayout = computeSheetLayout(CHINA_VISA_PROFILE);
    expect(chinaLayout.tileWidthPx).toBe(Math.round((33 / 25.4) * 300)); // 390 px
    expect(chinaLayout.tileHeightPx).toBe(Math.round((48 / 25.4) * 300)); // 567 px
    expect(chinaLayout.tiles.length).toBe(3);

    const { crop: chinaCrop } = evaluateBiometricValidation(
      fixture.mesh,
      CHINA_VISA_PROFILE,
      fixture.imageBounds
    );
    const chinaDigital = await generateDigitalPassportPhoto(
      sourceCanvas,
      chinaCrop,
      eyePivot,
      CHINA_VISA_PROFILE
    );
    expect(chinaDigital.widthPx).toBe(385);
    expect(chinaDigital.heightPx).toBe(560);

    // Mexico Passport & Visa (35x45 mm)
    const mexicoLayout = computeSheetLayout(MEXICO_PASSPORT_PROFILE);
    expect(mexicoLayout.tileWidthPx).toBe(Math.round((35 / 25.4) * 300)); // 413 px
    expect(mexicoLayout.tileHeightPx).toBe(Math.round((45 / 25.4) * 300)); // 531 px
    expect(mexicoLayout.tiles.length).toBe(3);

    const { crop: mexicoCrop } = evaluateBiometricValidation(
      fixture.mesh,
      MEXICO_PASSPORT_PROFILE,
      fixture.imageBounds
    );
    const mexicoDigital = await generateDigitalPassportPhoto(
      sourceCanvas,
      mexicoCrop,
      eyePivot,
      MEXICO_PASSPORT_PROFILE
    );
    expect(mexicoDigital.widthPx).toBe(1200);
    expect(mexicoDigital.heightPx).toBe(1543);
  });
});
