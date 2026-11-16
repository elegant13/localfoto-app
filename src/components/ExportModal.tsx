import React, { useEffect, useState } from 'react';
import {
  Download,
  Printer,
  FileCheck,
  Ruler,
  AlertCircle,
  MapPin,
  Navigation,
  Search,
  Store,
  Share2,
  ExternalLink,
  CheckCircle2,
  ArrowLeft,
  Cpu,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';
import { CapturePayload } from './CameraViewfinder';
import {
  generateDigitalPassportPhoto,
  generatePrintCompositeSheet,
  SheetLayoutPlan,
} from '../utils/compositeCanvas';
import { getInterPupillaryMidpoint } from '../utils/cropMath';
import {
  evaluateStoreConnection,
  findNearbyPrintStores,
  LocalPrintStore,
  StoreConnectionEvaluation,
} from '../services/printStoreService';

interface ExportModalProps {
  profile: PhotoProfile;
  capture: CapturePayload;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  profile,
  capture,
  onClose,
}) => {
  const [sheetBlob, setSheetBlob] = useState<Blob | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [digitalUrl, setDigitalUrl] = useState<string | null>(null);
  const [layoutPlan, setLayoutPlan] = useState<SheetLayoutPlan | null>(null);
  const [digitalSizeBytes, setDigitalSizeBytes] = useState<number>(0);
  const [digitalDims, setDigitalDims] = useState<{ w: number; h: number }>({
    w: 1200,
    h: 1200,
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [activePreviewTab, setActivePreviewTab] = useState<'sheet' | 'digital'>(
    'sheet'
  );

  const [zipInput, setZipInput] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [stores, setStores] = useState<LocalPrintStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<LocalPrintStore | null>(
    null
  );
  const [connectionEval, setConnectionEval] =
    useState<StoreConnectionEvaluation | null>(null);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);

  useEffect(() => {
    let createdSheetUrl: string | null = null;
    let createdDigitalUrl: string | null = null;
    let cancelled = false;

    const runExportPipeline = async () => {
      setIsGenerating(true);
      const eyePivot = getInterPupillaryMidpoint(capture.mesh);

      const sheetResult = await generatePrintCompositeSheet(
        capture.sourceCanvas,
        capture.crop,
        eyePivot,
        profile
      );
      const digitalResult = await generateDigitalPassportPhoto(
        capture.sourceCanvas,
        capture.crop,
        eyePivot,
        profile
      );

      if (cancelled) return;

      createdSheetUrl = URL.createObjectURL(sheetResult.blob);
      createdDigitalUrl = URL.createObjectURL(digitalResult.blob);

      setSheetBlob(sheetResult.blob);
      setSheetUrl(createdSheetUrl);
      setDigitalUrl(createdDigitalUrl);
      setLayoutPlan(sheetResult.layout);
      setDigitalSizeBytes(digitalResult.blob.size);
      setDigitalDims({
        w: digitalResult.widthPx,
        h: digitalResult.heightPx,
      });
      setIsGenerating(false);
    };

    runExportPipeline();

    return () => {
      cancelled = true;
      if (createdSheetUrl) {
        URL.revokeObjectURL(createdSheetUrl);
      }
      if (createdDigitalUrl) {
        URL.revokeObjectURL(createdDigitalUrl);
      }
    };
  }, [profile, capture]);

  useEffect(() => {
    findNearbyPrintStores({ zipCode: '20001' }).then((res) => {
      setStores(res.stores);
      if (res.stores.length > 0) {
        const initialStore = res.stores[0];
        setSelectedStore(initialStore);
        setConnectionEval(evaluateStoreConnection(initialStore, profile.id));
      }
      setLocationStatus(
        'Enter your ZIP code or tap "Use my current location" for closest stores'
      );
    });
  }, [profile.id]);

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus(
        'Geolocation unavailable in this browser. Please enter your ZIP code.'
      );
      return;
    }
    setIsLocating(true);
    setLocationStatus('Detecting your current location...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await findNearbyPrintStores({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setStores(result.stores);
        setLocationStatus(`Showing stores near ${result.locationLabel}`);
        setIsLocating(false);
        if (result.stores.length > 0) {
          handleSelectStore(result.stores[0]);
        }
      },
      () => {
        setIsLocating(false);
        setLocationStatus(
          'Location access declined. Enter your 5-digit ZIP code below.'
        );
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  };

  const handleSearchByZip = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zipInput.trim();
    if (!cleaned) return;
    setIsLocating(true);
    const result = await findNearbyPrintStores({ zipCode: cleaned });
    setStores(result.stores);
    setLocationStatus(`Showing stores near ${result.locationLabel}`);
    setIsLocating(false);
    if (result.stores.length > 0) {
      handleSelectStore(result.stores[0]);
    }
  };

  const handleSelectStore = (store: LocalPrintStore) => {
    setSelectedStore(store);
    setHandoffMessage(null);
    const evaluation = evaluateStoreConnection(store, profile.id);
    setConnectionEval(evaluation);
  };

  const triggerSheetDownload = () => {
    if (!sheetUrl) return;
    const link = document.createElement('a');
    link.href = sheetUrl;
    link.download = `${profile.id}_4x6_300dpi_print_sheet.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWebShareToStore = async () => {
    if (!sheetBlob || !selectedStore) return;
    const fileName = `${profile.id}_4x6_300dpi_print_sheet.jpg`;
    const file = new File([sheetBlob], fileName, { type: 'image/jpeg' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `4×6" Passport Print Sheet (${selectedStore.name})`,
          text: `Print as a standard 4×6" glossy/matte photo ($${selectedStore.pricePer4x6Usd.toFixed(
            2
          )}) at ${selectedStore.name}. Do not scale.`,
          files: [file],
        });
        setHandoffMessage(
          `Shared 300 DPI 4×6" sheet! Pick ${selectedStore.name} or Save Image in your share menu.`
        );
        return;
      } catch {
        // User cancelled share sheet; fall back to download + portal
      }
    }

    handleDownloadAndLaunchPortal();
  };

  const handleDownloadAndLaunchPortal = () => {
    if (!selectedStore) return;
    triggerSheetDownload();
    setHandoffMessage(
      `Saved "${profile.id}_4x6_300dpi_print_sheet.jpg" to your phone and opened ${selectedStore.name}'s 4×6" print page.`
    );
    window.open(
      selectedStore.apiCapabilities.orderPortalUrl,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      className="w-full max-w-xl mx-auto space-y-5"
      role="region"
      aria-labelledby="export-modal-title"
    >
      {/* M3 Segmented Progress Bar (Step 3 of 3 Complete) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1.5 flex-1 rounded-full bg-[#0B57D0]" />
          <div className="h-1.5 flex-1 rounded-full bg-[#0B57D0]" />
          <div className="h-1.5 flex-1 rounded-full bg-[#0B57D0]" />
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-[#444746]">
          <span>Step 3 of 3 • Review 4×6&quot; &amp; Order Print</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[#0B57D0] font-semibold hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retake Photo
          </button>
        </div>
      </div>

      {/* SECTION 1: M3 4x6" OUTCOME REVIEW CARD */}
      <div className="bg-white rounded-[28px] p-5 m3-elevation-1 border border-[#E1E3E1] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="export-modal-title"
              className="text-xl font-bold text-[#1F1F1F] tracking-tight"
            >
              Your 4×6&quot; Print Sheet is Ready
            </h2>
            <p className="text-xs text-[#444746] mt-0.5">
              {layoutPlan ? `${layoutPlan.tiles.length} photos tiled` : '2-Up'} •
              300 DPI calibrated • 0.5&quot; safe kiosk margins
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E6F4EA] text-[#137333] shrink-0">
            300 DPI sRGB
          </span>
        </div>

        {/* M3 Segmented Tab Switcher (4x6 Sheet vs Digital Single) */}
        <div className="grid grid-cols-2 p-1 rounded-full bg-[#EDF2FA] border border-[#C4C7C5]/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActivePreviewTab('sheet')}
            className={`py-2 px-3 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activePreviewTab === 'sheet'
                ? 'bg-white text-[#041E49] shadow-xs'
                : 'text-[#444746] hover:text-[#1F1F1F]'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-[#0B57D0]" />
            <span>4×6&quot; Sheet (2 Photos)</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePreviewTab('digital')}
            className={`py-2 px-3 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activePreviewTab === 'digital'
                ? 'bg-white text-[#041E49] shadow-xs'
                : 'text-[#444746] hover:text-[#1F1F1F]'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-[#137333]" />
            <span>Digital ({digitalDims.w}×{digitalDims.h})</span>
          </button>
        </div>

        {/* Outcome Image Container */}
        {isGenerating || !sheetUrl ? (
          <div className="h-56 flex items-center justify-center text-[#444746] text-sm bg-[#F3F6FC] rounded-2xl border border-[#E1E3E1]">
            Generating 300 DPI 4×6&quot; sheet...
          </div>
        ) : activePreviewTab === 'sheet' ? (
          <div className="bg-[#F3F6FC] p-3 rounded-2xl border border-[#E1E3E1] space-y-2">
            <img
              src={sheetUrl}
              alt="4x6 300 DPI Printable Composite Sheet"
              className="w-full rounded-xl border border-[#C4C7C5] shadow-xs bg-white"
            />
            <div className="flex items-center justify-between text-[11px] text-[#444746] px-1">
              <span className="flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-[#0B57D0]" />
                1.0&quot; &amp; 25 mm scale bar included
              </span>
              <span>Cut along light gray lines at home</span>
            </div>
          </div>
        ) : (
          <div className="bg-[#F3F6FC] p-4 rounded-2xl border border-[#E1E3E1] flex flex-col items-center gap-3">
            {digitalUrl && (
              <img
                src={digitalUrl}
                alt="Digital Submission Portrait"
                className="w-44 h-44 object-cover rounded-xl border border-[#C4C7C5] shadow-xs bg-white"
              />
            )}
            <p className="text-xs text-[#444746] text-center">
              Compliant {digitalDims.w}×{digitalDims.h} px sRGB JPEG (
              {(digitalSizeBytes / 1024).toFixed(1)} KB) for online passport
              renewal portals.
            </p>
          </div>
        )}

        {/* M3 Download Pill Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {sheetUrl && (
            <a
              href={sheetUrl}
              download={`${profile.id}_4x6_300dpi_print_sheet.jpg`}
              className="h-12 px-4 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2"
              data-testid="download-print-sheet-btn"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Save 4×6&quot; Print Sheet</span>
            </a>
          )}

          {digitalUrl && (
            <a
              href={digitalUrl}
              download={`${profile.id}_${digitalDims.w}x${digitalDims.h}_digital.jpg`}
              className="h-12 px-4 rounded-full bg-[#D3E3FD] hover:bg-[#C2D7FC] text-[#041E49] font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2"
              data-testid="download-digital-photo-btn"
            >
              <Download className="w-4 h-4 text-[#0B57D0] shrink-0" />
              <span>Save Digital Photo</span>
            </a>
          )}
        </div>
      </div>

      {/* SECTION 2: M3 LOCAL PHOTO STORE LOCATOR (CURRENT LOCATION OR ZIP) */}
      <div className="bg-white rounded-[28px] p-5 m3-elevation-1 border border-[#E1E3E1] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1F1F1F]">
              Find a Local Store for 4×6&quot; Printing
            </h3>
            <p className="text-xs text-[#444746]">
              Order a standard 4×6&quot; glossy or matte print ($0.25–$0.49) for
              same-day pickup
            </p>
          </div>
        </div>

        {/* M3 Location Controls: GPS Button + Outlined ZIP Input */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="w-full h-11 px-4 rounded-full bg-[#D3E3FD] hover:bg-[#C2D7FC] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-[#0B57D0]" />
            <span>
              {isLocating
                ? 'Locating nearby photo stores...'
                : 'Use my current location'}
            </span>
          </button>

          <form onSubmit={handleSearchByZip} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="w-4 h-4 text-[#444746] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 5-digit ZIP code"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-full bg-[#F3F6FC] border border-[#C4C7C5] text-xs text-[#1F1F1F] placeholder-[#444746] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#D3E3FD]"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find</span>
            </button>
          </form>

          {locationStatus && (
            <p className="text-[11px] text-[#444746] px-1">{locationStatus}</p>
          )}
        </div>

        {/* Store Selection List */}
        <div className="space-y-2.5">
          {stores.map((store) => {
            const isSelected = selectedStore?.id === store.id;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => handleSelectStore(store)}
                className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#F3F6FC] border-2 border-[#0B57D0] shadow-xs'
                    : 'bg-white border-[#E1E3E1] hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-[#1F1F1F] flex items-center gap-1.5">
                      <span>{store.name}</span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[#0B57D0] shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-[#444746]">
                      {store.address} • {store.cityStateZip}
                    </div>
                    <div className="text-[11px] font-medium text-[#137333] pt-0.5">
                      {store.pickupEstimate}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] font-bold text-xs">
                      ${store.pricePer4x6Usd.toFixed(2)}
                    </span>
                    <span className="block text-[11px] text-[#444746] mt-1">
                      {store.distanceMiles} mi
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: STEP 4 STORE CONNECTION EVALUATION & HANDOFF */}
      {connectionEval && selectedStore && (
        <div className="bg-[#D3E3FD]/45 rounded-[28px] p-5 border-2 border-[#0B57D0] space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#0B57D0]">
                <Cpu className="w-3.5 h-3.5" />
                Store Print Connection Ready
              </span>
              <h4 className="text-base font-bold text-[#041E49] mt-0.5">
                Print at {selectedStore.name}
              </h4>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-white text-[#041E49] border border-[#0B57D0]/30 text-[11px] font-semibold">
              {connectionEval.recommendedMode === 'PARTNER_REST_API'
                ? 'Direct Partner API'
                : connectionEval.webShareSupported
                ? 'Mobile Share Sheet'
                : 'Portal Upload'}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-[#D3E3FD] text-xs space-y-2">
            <p className="text-[#444746] leading-relaxed">
              {connectionEval.statusSummary}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E1E3E1]">
              <div>
                <span className="text-[#444746] block text-[11px]">
                  Print Format
                </span>
                <span className="font-bold text-[#1F1F1F]">
                  {connectionEval.payloadMetadata.printSizeInches}
                </span>
              </div>
              <div>
                <span className="text-[#444746] block text-[11px]">
                  Estimated Cost
                </span>
                <span className="font-bold text-[#137333]">
                  {connectionEval.payloadMetadata.estimatedTotalUsd} (2 Photos)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 px-1">
            {connectionEval.technicalSteps.map((stepText, idx) => (
              <div
                key={idx}
                className="text-xs text-[#041E49] leading-relaxed"
              >
                {stepText}
              </div>
            ))}
          </div>

          {/* Primary M3 Store Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {connectionEval.webShareSupported && (
              <button
                type="button"
                onClick={handleWebShareToStore}
                className="w-full h-14 px-5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Send 4×6&quot; Sheet to {selectedStore.name} App</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadAndLaunchPortal}
              className={`w-full h-12 px-5 rounded-full font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                connectionEval.webShareSupported
                  ? 'bg-white hover:bg-[#F3F6FC] text-[#041E49] border border-[#0B57D0]/40'
                  : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white shadow-md h-14 font-bold'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>
                Save 4×6&quot; Sheet &amp; Open {selectedStore.name} Print Page
              </span>
            </button>
          </div>

          {handoffMessage && (
            <div className="p-3 rounded-2xl bg-[#E6F4EA] border border-[#137333]/30 text-xs text-[#137333] font-medium">
              {handoffMessage}
            </div>
          )}

          <details className="text-[11px] text-[#444746] pt-1">
            <summary className="cursor-pointer font-medium text-[#0B57D0] hover:underline">
              Store API &amp; Privacy Diagnostics
            </summary>
            <p className="mt-1.5 leading-relaxed bg-white/80 rounded-xl p-2.5 border border-[#D3E3FD]">
              {connectionEval.apiFeasibilityNote}
            </p>
          </details>
        </div>
      )}

      {/* M3 Warning Callout Card */}
      <div className="bg-[#FEF7E0] rounded-2xl p-4 border border-[#F59E0B]/40 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#B06000] shrink-0 mt-0.5" />
        <p className="text-xs text-[#444746] leading-relaxed">
          <strong className="text-[#1F1F1F]">Counter Tip:</strong> Order a{' '}
          <strong>Standard 4×6&quot; Photo Print ($0.25–$0.39)</strong>—do{' '}
          <strong>not</strong> ask for &ldquo;Passport Photo Service&rdquo;
          ($16.99). Check the 1-inch ruler on your print before cutting along
          the gray lines at home.
        </p>
      </div>
    </div>
  );
};
