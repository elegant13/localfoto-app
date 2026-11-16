import React, { useEffect, useState } from 'react';
import {
  Download,
  Printer,
  FileCheck,
  Navigation,
  Search,
  Share2,
  ExternalLink,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';
import { CapturePayload } from './CameraViewfinder';
import {
  generateDigitalPassportPhoto,
  generatePrintCompositeSheet,
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
      setDigitalDims({
        w: digitalResult.widthPx,
        h: digitalResult.heightPx,
      });
      setIsGenerating(false);
    };

    runExportPipeline();

    return () => {
      cancelled = true;
      if (createdSheetUrl) URL.revokeObjectURL(createdSheetUrl);
      if (createdDigitalUrl) URL.revokeObjectURL(createdDigitalUrl);
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
    });
  }, [profile.id]);

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('Enter your 5-digit ZIP code');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await findNearbyPrintStores({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setStores(result.stores);
        setLocationStatus(`Near ${result.locationLabel}`);
        setIsLocating(false);
        if (result.stores.length > 0) {
          handleSelectStore(result.stores[0]);
        }
      },
      () => {
        setIsLocating(false);
        setLocationStatus('Enter your ZIP code above');
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
    setLocationStatus(`Near ${result.locationLabel}`);
    setIsLocating(false);
    if (result.stores.length > 0) {
      handleSelectStore(result.stores[0]);
    }
  };

  const handleSelectStore = (store: LocalPrintStore) => {
    setSelectedStore(store);
    setConnectionEval(evaluateStoreConnection(store, profile.id));
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
          title: `4×6" Passport Print (${selectedStore.name})`,
          files: [file],
        });
        return;
      } catch {
        // Fallback to download + portal
      }
    }
    handleDownloadAndLaunchPortal();
  };

  const handleDownloadAndLaunchPortal = () => {
    if (!selectedStore) return;
    triggerSheetDownload();
    window.open(
      selectedStore.apiCapabilities.orderPortalUrl,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      className="w-full max-w-md mx-auto space-y-4 py-1"
      role="region"
      aria-labelledby="export-modal-title"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-1">
        <h2
          id="export-modal-title"
          className="text-xl font-extrabold text-[#1F1F1F] tracking-tight"
        >
          Review &amp; Print 4×6&quot;
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3.5 rounded-full bg-[#EDF2FA] text-[#041E49] text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retake
        </button>
      </div>

      {/* Card 1: 4x6 Outcome Preview & Save */}
      <div className="bg-white rounded-[28px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-3">
        <div className="grid grid-cols-2 p-1 rounded-full bg-[#EDF2FA] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActivePreviewTab('sheet')}
            className={`py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activePreviewTab === 'sheet'
                ? 'bg-white text-[#041E49] shadow-2xs'
                : 'text-[#444746]'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-[#0B57D0]" />
            <span>4×6&quot; Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePreviewTab('digital')}
            className={`py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activePreviewTab === 'digital'
                ? 'bg-white text-[#041E49] shadow-2xs'
                : 'text-[#444746]'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-[#137333]" />
            <span>Digital Copy</span>
          </button>
        </div>

        {isGenerating || !sheetUrl ? (
          <div className="h-44 flex items-center justify-center text-[#444746] text-xs bg-[#F3F6FC] rounded-2xl">
            Generating 300 DPI 4×6&quot; sheet...
          </div>
        ) : activePreviewTab === 'sheet' ? (
          <img
            src={sheetUrl}
            alt="4x6 300 DPI Printable Composite Sheet"
            className="w-full rounded-2xl border border-[#E1E3E1] bg-white"
          />
        ) : (
          <div className="flex justify-center py-2 bg-[#F3F6FC] rounded-2xl">
            {digitalUrl && (
              <img
                src={digitalUrl}
                alt="Digital Submission Portrait"
                className="w-36 h-36 object-cover rounded-xl border border-[#C4C7C5] bg-white"
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {sheetUrl && (
            <a
              href={sheetUrl}
              download={`${profile.id}_4x6_300dpi_print_sheet.jpg`}
              className="h-10 px-3 rounded-full bg-[#EDF2FA] hover:bg-[#D3E3FD] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              data-testid="download-print-sheet-btn"
            >
              <Download className="w-3.5 h-3.5 text-[#0B57D0]" />
              <span>Save 4×6&quot;</span>
            </a>
          )}
          {digitalUrl && (
            <a
              href={digitalUrl}
              download={`${profile.id}_${digitalDims.w}x${digitalDims.h}_digital.jpg`}
              className="h-10 px-3 rounded-full bg-[#EDF2FA] hover:bg-[#D3E3FD] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              data-testid="download-digital-photo-btn"
            >
              <Download className="w-3.5 h-3.5 text-[#0B57D0]" />
              <span>Save Digital</span>
            </a>
          )}
        </div>
      </div>

      {/* Card 2: Compact Store Finder & Direct Order Action */}
      <div className="bg-white rounded-[28px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1F1F1F]">
            Select a Local Store to Print
          </h3>
          {locationStatus && (
            <span className="text-[11px] text-[#0B57D0] font-medium">
              {locationStatus}
            </span>
          )}
        </div>

        {/* Single-Row GPS + ZIP Bar */}
        <form onSubmit={handleSearchByZip} className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="h-10 px-3 rounded-full bg-[#D3E3FD] hover:bg-[#C2D7FC] text-[#041E49] font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition"
            title="Use my current location"
          >
            <Navigation className="w-3.5 h-3.5 text-[#0B57D0]" />
            <span>GPS</span>
          </button>

          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="Or enter ZIP code"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            className="flex-1 h-10 px-3.5 rounded-full bg-[#F3F6FC] border border-[#C4C7C5] text-xs text-[#1F1F1F] placeholder-[#444746] focus:outline-none focus:border-[#0B57D0]"
          />

          <button
            type="submit"
            className="h-10 px-4 rounded-full bg-[#EDF2FA] hover:bg-[#D3E3FD] text-[#041E49] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find</span>
          </button>
        </form>

        {/* Compact Store Grid */}
        <div className="grid grid-cols-2 gap-2">
          {stores.map((store) => {
            const isSelected = selectedStore?.id === store.id;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => handleSelectStore(store)}
                className={`text-left p-3 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#F3F6FC] border-2 border-[#0B57D0]'
                    : 'bg-white border-[#E1E3E1] hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-[#1F1F1F] truncate">
                    {store.name.split('#')[0].trim()}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="font-bold text-[#137333]">
                    ${store.pricePer4x6Usd.toFixed(2)}
                  </span>
                  <span className="text-[#444746]">{store.distanceMiles} mi</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Single Direct Store Order CTA */}
        {selectedStore && connectionEval && (
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={handleDownloadAndLaunchPortal}
              className="w-full h-13 px-4 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>
                Save 4×6&quot; &amp; Open {selectedStore.name.split('#')[0].trim()}{' '}
                ({connectionEval.payloadMetadata.estimatedTotalUsd})
              </span>
            </button>

            {connectionEval.webShareSupported && (
              <button
                type="button"
                onClick={handleWebShareToStore}
                className="w-full h-10 px-4 rounded-full bg-[#EDF2FA] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#0B57D0]" />
                <span>Share to {selectedStore.name.split('#')[0].trim()} App</span>
              </button>
            )}

            <p className="text-[11px] text-[#444746] text-center">
              Order as a <strong>Standard 4×6&quot; Print</strong> (not Passport
              Service), then cut along the gray lines at home.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
