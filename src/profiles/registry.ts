import { PhotoProfile } from '../types/profile';

export const US_PASSPORT_PROFILE: PhotoProfile = {
  id: 'us_passport',
  displayName: 'U.S. Passport & Visa (2×2")',
  countryCode: 'US',
  physicalSize: {
    widthMm: 50.8,
    heightMm: 50.8,
  },
  aspectRatio: 1.0,
  headConstraints: {
    minRatio: 0.50,
    maxRatio: 0.69,
    targetRatio: 0.60,
  },
  eyeConstraints: {
    minFromBottom: 0.56,
    maxFromBottom: 0.69,
  },
  chinBottomClearanceMin: 0.15,
  allowedBackgrounds: ['pure_white', 'off_white'],
  glassesAllowed: false,
  teethAllowed: false,
  digitalSubmissionSpec: {
    minWidthPx: 600,
    maxWidthPx: 1200,
    maxFileSizeBytes: 10 * 1024 * 1024, // < 10 MB
    colorSpace: 'sRGB',
  },
  printSheetSpec: {
    sheetWidthInches: 6.0,
    sheetHeightInches: 4.0,
    dpi: 300,
    safeMarginInches: 0.5,
    minSeparationInches: 0.25,
  },
};

export const SCHENGEN_VISA_PROFILE: PhotoProfile = {
  id: 'schengen_visa',
  displayName: 'Schengen Visa / EU (35×45 mm)',
  countryCode: 'EU',
  physicalSize: {
    widthMm: 35.0,
    heightMm: 45.0,
  },
  aspectRatio: 35.0 / 45.0,
  headConstraints: {
    minRatio: 0.70,
    maxRatio: 0.80,
    targetRatio: 0.75,
  },
  eyeConstraints: {
    minFromBottom: 0.50,
    maxFromBottom: 0.70,
  },
  chinBottomClearanceMin: 0.12,
  allowedBackgrounds: ['pure_white', 'off_white', 'light_gray'],
  glassesAllowed: false,
  teethAllowed: false,
  digitalSubmissionSpec: {
    minWidthPx: 600,
    maxWidthPx: 1200,
    maxFileSizeBytes: 5 * 1024 * 1024,
    colorSpace: 'sRGB',
  },
  printSheetSpec: {
    sheetWidthInches: 6.0,
    sheetHeightInches: 4.0,
    dpi: 300,
    safeMarginInches: 0.5,
    minSeparationInches: 0.25,
  },
};

export const INDIA_OCI_PROFILE: PhotoProfile = {
  id: 'india_passport',
  displayName: 'India Passport & OCI (51×51 mm)',
  countryCode: 'IN',
  physicalSize: {
    widthMm: 51.0,
    heightMm: 51.0,
  },
  aspectRatio: 1.0,
  headConstraints: {
    minRatio: 0.50,
    maxRatio: 0.69,
    targetRatio: 0.60,
  },
  eyeConstraints: {
    minFromBottom: 0.55,
    maxFromBottom: 0.69,
  },
  chinBottomClearanceMin: 0.15,
  allowedBackgrounds: ['pure_white', 'off_white'],
  glassesAllowed: false,
  teethAllowed: false,
  digitalSubmissionSpec: {
    minWidthPx: 600,
    maxWidthPx: 1200,
    maxFileSizeBytes: 10 * 1024 * 1024,
    colorSpace: 'sRGB',
  },
  printSheetSpec: {
    sheetWidthInches: 6.0,
    sheetHeightInches: 4.0,
    dpi: 300,
    safeMarginInches: 0.5,
    minSeparationInches: 0.25,
  },
};

export const CANADA_PASSPORT_PROFILE: PhotoProfile = {
  id: 'canada_passport',
  displayName: 'Canada Passport (50×70 mm)',
  countryCode: 'CA',
  physicalSize: {
    widthMm: 50.0,
    heightMm: 70.0,
  },
  aspectRatio: 50.0 / 70.0,
  headConstraints: {
    minRatio: 31.0 / 70.0, // 31mm to 36mm on 70mm height
    maxRatio: 36.0 / 70.0,
    targetRatio: 33.5 / 70.0,
  },
  chinBottomClearanceMin: 0.18,
  allowedBackgrounds: ['pure_white', 'off_white'],
  glassesAllowed: false,
  teethAllowed: false,
  digitalSubmissionSpec: {
    minWidthPx: 600,
    maxWidthPx: 1200,
    maxFileSizeBytes: 10 * 1024 * 1024,
    colorSpace: 'sRGB',
  },
  printSheetSpec: {
    sheetWidthInches: 6.0,
    sheetHeightInches: 4.0,
    dpi: 300,
    safeMarginInches: 0.5,
    minSeparationInches: 0.25,
  },
};

export const UK_PASSPORT_PROFILE: PhotoProfile = {
  id: 'uk_passport',
  displayName: 'UK Passport (35×45 mm)',
  countryCode: 'GB',
  physicalSize: {
    widthMm: 35.0,
    heightMm: 45.0,
  },
  aspectRatio: 35.0 / 45.0,
  headConstraints: {
    minRatio: 29.0 / 45.0, // 29mm to 34mm
    maxRatio: 34.0 / 45.0,
    targetRatio: 31.5 / 45.0,
  },
  eyeConstraints: {
    minFromBottom: 0.48,
    maxFromBottom: 0.68,
  },
  chinBottomClearanceMin: 0.14,
  allowedBackgrounds: ['pure_white', 'off_white', 'light_gray'],
  glassesAllowed: false,
  teethAllowed: false,
  digitalSubmissionSpec: {
    minWidthPx: 600,
    maxWidthPx: 1200,
    maxFileSizeBytes: 10 * 1024 * 1024,
    colorSpace: 'sRGB',
  },
  printSheetSpec: {
    sheetWidthInches: 6.0,
    sheetHeightInches: 4.0,
    dpi: 300,
    safeMarginInches: 0.5,
    minSeparationInches: 0.25,
  },
};

class ProfileRegistry {
  private profiles: Map<string, PhotoProfile> = new Map();

  constructor(initialProfiles: PhotoProfile[]) {
    for (const p of initialProfiles) {
      this.profiles.set(p.id, p);
    }
  }

  public register(profile: PhotoProfile): void {
    this.profiles.set(profile.id, profile);
  }

  public get(id: string): PhotoProfile {
    const found = this.profiles.get(id);
    if (!found) {
      throw new Error(`PhotoProfile "${id}" not found in registry.`);
    }
    return found;
  }

  public getDefault(): PhotoProfile {
    return this.get('us_passport');
  }

  public getAll(): PhotoProfile[] {
    return Array.from(this.profiles.values());
  }
}

export const profileRegistry = new ProfileRegistry([
  US_PASSPORT_PROFILE,
  SCHENGEN_VISA_PROFILE,
  INDIA_OCI_PROFILE,
  CANADA_PASSPORT_PROFILE,
  UK_PASSPORT_PROFILE,
]);

