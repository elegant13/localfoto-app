export interface Millimeters {
  widthMm: number;
  heightMm: number;
}

export interface HeadHeightRatioConstraint {
  minRatio: number;    // US: 0.50 (50%)
  maxRatio: number;    // US: 0.69 (69%)
  targetRatio: number; // US: 0.60 (60%)
}

export interface EyeLevelRatioConstraint {
  minFromBottom: number; // US: 0.56 (56% from bottom of final frame)
  maxFromBottom: number; // US: 0.69 (69% from bottom of final frame)
}

export interface CanvasSheetSpec {
  sheetWidthInches: number;   // 6.0
  sheetHeightInches: number;  // 4.0
  dpi: number;                // 300
  safeMarginInches: number;   // Minimum 0.5" margin to protect against kiosk overscan
  minSeparationInches: number;// Gap between photos (0.25")
}

export interface PhotoProfile {
  id: string;
  displayName: string;
  countryCode: string;
  physicalSize: Millimeters;
  aspectRatio: number; // width / height (1.0 for US 2x2)
  headConstraints: HeadHeightRatioConstraint;
  eyeConstraints?: EyeLevelRatioConstraint;
  chinBottomClearanceMin: number; // Minimum 0.15 to avoid "floating head" / preserve chest
  allowedBackgrounds: ("pure_white" | "off_white" | "light_gray" | "light_blue")[];
  glassesAllowed: boolean;
  teethAllowed: boolean;
  digitalSubmissionSpec: {
    minWidthPx: number;
    maxWidthPx: number;
    maxFileSizeBytes: number;
    colorSpace: "sRGB";
  };
  printSheetSpec: CanvasSheetSpec;
}

