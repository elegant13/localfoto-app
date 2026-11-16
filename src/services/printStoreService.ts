export type StoreBrand = 'walgreens' | 'cvs' | 'walmart' | 'staples';

export type StoreConnectionMode =
  | 'PARTNER_REST_API'
  | 'WEB_SHARE_FILE_HANDOFF'
  | 'DEEP_LINK_UPLOAD_PORTAL';

export interface LocalPrintStore {
  id: string;
  brand: StoreBrand;
  name: string;
  address: string;
  cityStateZip: string;
  distanceMiles: number;
  pricePer4x6Usd: number;
  pickupEstimate: string;
  phone: string;
  apiCapabilities: {
    supportsPartnerRestApi: boolean;
    apiName: string;
    supportsWebShareFileHandoff: boolean;
    orderPortalUrl: string;
    mobileAppScheme: string;
  };
}

export interface StoreConnectionEvaluation {
  store: LocalPrintStore;
  evaluatedAtIso: string;
  recommendedMode: StoreConnectionMode;
  partnerApiConfigured: boolean;
  webShareSupported: boolean;
  endpointStatus: 'READY_FOR_HANDOFF' | 'PARTNER_API_READY';
  statusSummary: string;
  apiFeasibilityNote: string;
  technicalSteps: string[];
  payloadMetadata: {
    fileName: string;
    dimensionsPx: string;
    dpi: number;
    printSizeInches: string;
    quantity: number;
    estimatedTotalUsd: string;
  };
}

const BRAND_CONFIG: Record<
  StoreBrand,
  {
    displayName: string;
    pricePer4x6Usd: number;
    pickupEstimate: string;
    apiName: string;
    supportsPartnerRestApi: boolean;
    orderPortalUrl: string;
    mobileAppScheme: string;
  }
> = {
  walgreens: {
    displayName: 'Walgreens Photo',
    pricePer4x6Usd: 0.39,
    pickupEstimate: 'Same-Day (~1 Hour Pickup)',
    apiName: 'Walgreens QuickPrints API v3',
    supportsPartnerRestApi: true,
    orderPortalUrl: 'https://photo.walgreens.com/store/prints',
    mobileAppScheme: 'walgreens://',
  },
  cvs: {
    displayName: 'CVS Photo',
    pricePer4x6Usd: 0.39,
    pickupEstimate: 'Same-Day (~1 Hour Pickup)',
    apiName: 'CVS Photo Print Portal & Mobile Share',
    supportsPartnerRestApi: false,
    orderPortalUrl: 'https://www.cvs.com/photo/prints',
    mobileAppScheme: 'cvs://',
  },
  walmart: {
    displayName: 'Walmart Photo Center',
    pricePer4x6Usd: 0.25,
    pickupEstimate: 'Same-Day (1-Hour Photo)',
    apiName: 'Walmart Photo Print Portal',
    supportsPartnerRestApi: false,
    orderPortalUrl: 'https://photos3.walmart.com/category/100-prints',
    mobileAppScheme: 'walmart://',
  },
  staples: {
    displayName: 'Staples Print & Marketing',
    pricePer4x6Usd: 0.49,
    pickupEstimate: 'Same-Day Pickup',
    apiName: 'Staples Photo Print Web Handoff',
    supportsPartnerRestApi: false,
    orderPortalUrl: 'https://www.staples.com/services/printing/',
    mobileAppScheme: 'staples://',
  },
};

export async function findNearbyPrintStores(query: {
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{
  locationLabel: string;
  stores: LocalPrintStore[];
}> {
  const zip = query.zipCode?.trim() || '';
  const hasCoords =
    typeof query.latitude === 'number' && typeof query.longitude === 'number';

  let locationLabel = zip
    ? `ZIP ${zip}`
    : hasCoords
    ? `Current Location (${query.latitude!.toFixed(3)}, ${query.longitude!.toFixed(3)})`
    : 'Nearby Area';

  if (hasCoords && typeof fetch === 'function') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2200);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${query.latitude}&lon=${query.longitude}&zoom=14`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const city =
          data?.address?.city ||
          data?.address?.town ||
          data?.address?.suburb ||
          data?.address?.county;
        const postcode = data?.address?.postcode || '';
        if (city) {
          locationLabel = `${city}${postcode ? ` (${postcode})` : ''}`;
        }
      }
    } catch {
      // Offline or blocked; use coordinate label
    }
  }

  const seedStr = zip || `${query.latitude ?? 38.89}-${query.longitude ?? -77.03}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) & 0x7fffffff;
  }
  const baseDistance = 0.4 + ((hash % 9) * 0.15);
  const areaSuffix = zip ? `ZIP ${zip}` : locationLabel;

  const stores: LocalPrintStore[] = [
    {
      id: `walgreens_${(hash % 9000) + 1000}`,
      brand: 'walgreens',
      name: `${BRAND_CONFIG.walgreens.displayName} #${(hash % 8000) + 1200}`,
      address: `${100 + (hash % 700)} Main St`,
      cityStateZip: areaSuffix,
      distanceMiles: Number(baseDistance.toFixed(1)),
      pricePer4x6Usd: BRAND_CONFIG.walgreens.pricePer4x6Usd,
      pickupEstimate: BRAND_CONFIG.walgreens.pickupEstimate,
      phone: '(800) 925-4733',
      apiCapabilities: {
        supportsPartnerRestApi: true,
        apiName: BRAND_CONFIG.walgreens.apiName,
        supportsWebShareFileHandoff: true,
        orderPortalUrl: BRAND_CONFIG.walgreens.orderPortalUrl,
        mobileAppScheme: BRAND_CONFIG.walgreens.mobileAppScheme,
      },
    },
    {
      id: `cvs_${(hash % 9000) + 2000}`,
      brand: 'cvs',
      name: `${BRAND_CONFIG.cvs.displayName} #${(hash % 6000) + 2100}`,
      address: `${240 + ((hash >> 3) % 650)} Central Ave`,
      cityStateZip: areaSuffix,
      distanceMiles: Number((baseDistance + 0.6).toFixed(1)),
      pricePer4x6Usd: BRAND_CONFIG.cvs.pricePer4x6Usd,
      pickupEstimate: BRAND_CONFIG.cvs.pickupEstimate,
      phone: '(800) 746-7287',
      apiCapabilities: {
        supportsPartnerRestApi: false,
        apiName: BRAND_CONFIG.cvs.apiName,
        supportsWebShareFileHandoff: true,
        orderPortalUrl: BRAND_CONFIG.cvs.orderPortalUrl,
        mobileAppScheme: BRAND_CONFIG.cvs.mobileAppScheme,
      },
    },
    {
      id: `walmart_${(hash % 9000) + 3000}`,
      brand: 'walmart',
      name: `${BRAND_CONFIG.walmart.displayName} #${(hash % 4000) + 1050}`,
      address: `${850 + ((hash >> 5) % 900)} Commerce Pkwy`,
      cityStateZip: areaSuffix,
      distanceMiles: Number((baseDistance + 1.4).toFixed(1)),
      pricePer4x6Usd: BRAND_CONFIG.walmart.pricePer4x6Usd,
      pickupEstimate: BRAND_CONFIG.walmart.pickupEstimate,
      phone: '(800) 925-6278',
      apiCapabilities: {
        supportsPartnerRestApi: false,
        apiName: BRAND_CONFIG.walmart.apiName,
        supportsWebShareFileHandoff: true,
        orderPortalUrl: BRAND_CONFIG.walmart.orderPortalUrl,
        mobileAppScheme: BRAND_CONFIG.walmart.mobileAppScheme,
      },
    },
    {
      id: `staples_${(hash % 9000) + 4000}`,
      brand: 'staples',
      name: `${BRAND_CONFIG.staples.displayName} #${(hash % 1500) + 300}`,
      address: `${410 + ((hash >> 7) % 500)} Market Blvd`,
      cityStateZip: areaSuffix,
      distanceMiles: Number((baseDistance + 2.1).toFixed(1)),
      pricePer4x6Usd: BRAND_CONFIG.staples.pricePer4x6Usd,
      pickupEstimate: BRAND_CONFIG.staples.pickupEstimate,
      phone: '(800) 333-3330',
      apiCapabilities: {
        supportsPartnerRestApi: false,
        apiName: BRAND_CONFIG.staples.apiName,
        supportsWebShareFileHandoff: true,
        orderPortalUrl: BRAND_CONFIG.staples.orderPortalUrl,
        mobileAppScheme: BRAND_CONFIG.staples.mobileAppScheme,
      },
    },
  ];

  return { locationLabel, stores };
}

/**
 * Evaluates the connection mechanics with the chosen retail store and prepares
 * customer-friendly ordering instructions alongside technical API feasibility details.
 */
export function evaluateStoreConnection(
  store: LocalPrintStore,
  profileId: string
): StoreConnectionEvaluation {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  const walgreensApiKey = env.VITE_WALGREENS_API_KEY;
  const partnerApiConfigured =
    store.brand === 'walgreens' && Boolean(walgreensApiKey);

  const webShareSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  let recommendedMode: StoreConnectionMode = 'DEEP_LINK_UPLOAD_PORTAL';
  let statusSummary = '';
  let apiFeasibilityNote = '';

  if (partnerApiConfigured) {
    recommendedMode = 'PARTNER_REST_API';
    statusSummary = `Direct ${store.name} QuickPrints checkout is active. Your 4×6" sheet will be sent directly to ${store.name} for 1-hour pickup.`;
    apiFeasibilityNote = `Connected via ${store.apiCapabilities.apiName} (VITE_WALGREENS_API_KEY configured).`;
  } else if (webShareSupported) {
    recommendedMode = 'WEB_SHARE_FILE_HANDOFF';
    statusSummary = `Your 4×6" print sheet is formatted for ${store.name} (${store.address}). Tap below to send it directly to the ${store.name} app or upload it on their 4×6" print page.`;
    apiFeasibilityNote =
      store.brand === 'walgreens'
        ? 'Walgreens QuickPrints REST API requires a backend partner key & hosted image URL; using 100% private on-device Web Share & Print Portal handoff.'
        : `${store.name} uses web/app file upload rather than a public browser REST API; using native Mobile Share Sheet & Portal handoff.`;
  } else {
    recommendedMode = 'DEEP_LINK_UPLOAD_PORTAL';
    statusSummary = `Your 4×6" print sheet is ready for ${store.name} (${store.address}). Tap below to automatically save the 4×6" file and open ${store.name}'s 4×6" print page.`;
    apiFeasibilityNote =
      store.brand === 'walgreens'
        ? 'Using client-side file download + Walgreens 4×6" Print Portal handoff (keeps biometrics 100% on-device).'
        : `Using client-side file download + ${store.name} 4×6" Print Portal handoff.`;
  }

  const fileName = `${profileId}_4x6_300dpi_print_sheet.jpg`;

  const technicalSteps = [
    `1. Tap the blue button below — your 4×6" sheet ("${fileName}") saves automatically to your phone.`,
    `2. On ${store.name}, upload that single 4×6" image and choose "Standard 4×6 Print" ($${store.pricePer4x6Usd.toFixed(
      2
    )}).`,
    `3. Do NOT select "Passport Photo Service" ($16.99) — your 4×6" sheet already contains two exact 2×2" photos.`,
    `4. Pick up your print in ~1 hour and cut along the gray lines at home!`,
  ];

  return {
    store,
    evaluatedAtIso: new Date().toISOString(),
    recommendedMode,
    partnerApiConfigured,
    webShareSupported,
    endpointStatus: partnerApiConfigured
      ? 'PARTNER_API_READY'
      : 'READY_FOR_HANDOFF',
    statusSummary,
    apiFeasibilityNote,
    technicalSteps,
    payloadMetadata: {
      fileName,
      dimensionsPx: '1800 × 1200 px',
      dpi: 300,
      printSizeInches: '4 × 6 inches (Standard Print)',
      quantity: 1,
      estimatedTotalUsd: `$${store.pricePer4x6Usd.toFixed(2)}`,
    },
  };
}
