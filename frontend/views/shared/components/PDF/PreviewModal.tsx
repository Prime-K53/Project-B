import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pdf } from '@react-pdf/renderer';
import { AlertTriangle, Download, ExternalLink, FileText, Loader2, Printer, RefreshCw, X } from 'lucide-react';
import { PrimeDocument } from './PrimeDocument.tsx';
import { DocType, FilePreviewDescriptor } from '../../../../stores/documentStore.ts';
import { PrimeDocData } from './schemas.ts';
import { localFileStorage } from '../../../../services/localFileStorage.ts';
import { attachDocumentSecurity } from '../../../../utils/documentSecurity.ts';
import { getStoredCompanyConfig } from './templateSettings.ts';
import {
  buildGoogleViewerUrl,
  buildIframePreviewUrl,
  getDeviceProfile,
  inferMimeType,
  isPdfMimeType,
  isPublicDocumentUrl,
  resolvePreviewMode,
  type PreviewMode,
} from '../../../../utils/documentPreview.ts';
import { printDocumentUrl } from '../../../../utils/documentPrint.ts';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: DocType;
  data?: PrimeDocData | null;
  file?: FilePreviewDescriptor | null;
}

interface PreparedPreviewSource {
  displayUrl: string;
  downloadUrl: string;
  fileName: string;
  mimeType?: string;
  publicUrl?: string;
  title: string;
}

const PREVIEW_SLOW_NETWORK_MS = 7000;
const PREVIEW_TIMEOUT_MS = 22000;
const PREVIEW_PREPARE_TIMEOUT_MS = 15000;

const canDecompressGzip = (): boolean =>
  typeof DecompressionStream !== 'undefined';

const tryDecodeErrorMessage = async (response: Response, contentType: string): Promise<string | null> => {
  try {
    if (contentType.includes('application/json')) {
      const payload = await response.clone().json();
      return String(payload?.error || payload?.message || '').trim() || null;
    }
    const text = await response.clone().text();
    if (!text) return null;
    return text.slice(0, 200).trim();
  } catch {
    return null;
  }
};

const maybeInflateGzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (!canDecompressGzip()) {
    throw new Error('Gzip response cannot be decompressed in this browser environment.');
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressedBuffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timerId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }
  }
};

const fetchPdfAsObjectUrl = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PREVIEW_PREPARE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Timed out loading the document preview file.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const contentEncoding = (response.headers.get('content-encoding') || '').toLowerCase();
  console.log('Content-Type:', response.headers.get('content-type'));

  if (!response.ok) {
    const details = await tryDecodeErrorMessage(response, contentType);
    throw new Error(details ? `PDF request failed: ${details}` : `PDF request failed with status ${response.status}.`);
  }

  if (!contentType.includes('pdf')) {
    const details = await tryDecodeErrorMessage(response, contentType);
    throw new Error(details || `Expected PDF response but received "${contentType || 'unknown'}".`);
  }

  const buffer = await response.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);

  let finalBytes: Uint8Array;
  if (contentEncoding.includes('gzip')) {
    finalBytes = await maybeInflateGzip(rawBytes);
  } else {
    finalBytes = rawBytes;
  }

  const blob = new Blob([finalBytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

const generatePreviewPdfBlob = (type: DocType, data: PrimeDocData, configOverride?: any) =>
  withTimeout(
    pdf(<PrimeDocument type={type} data={data} configOverride={configOverride} />).toBlob(),
    PREVIEW_PREPARE_TIMEOUT_MS,
    'Timed out generating the document preview. This can happen offline when document assets are unavailable. Retry or use Download.'
  );

const shouldRetryWithSafeAssets = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes('timed out')
    || normalized.includes('incorrect data check')
    || normalized.includes('zlib')
    || normalized.includes('font')
    || normalized.includes('image')
    || normalized.includes('asset');
};

const buildSafePreviewConfig = () => {
  const config = getStoredCompanyConfig();
  return {
    ...(config || {}),
    logo: '',
    logoBase64: '',
    invoiceTemplates: {
      ...((config as any)?.invoiceTemplates || {}),
      fontFamily: 'Helvetica',
      showCompanyLogo: false,
    },
  };
};

const stripPreviewMediaData = (value: PrimeDocData): PrimeDocData => {
  const next: any = { ...value };

  if ('signatureDataUrl' in next) {
    next.signatureDataUrl = '';
  }

  if (next.proofOfDelivery && typeof next.proofOfDelivery === 'object') {
    next.proofOfDelivery = {
      ...next.proofOfDelivery,
      signatureDataUrl: '',
      signature: '',
    };
  }

  return next as PrimeDocData;
};

export const PreviewModal = ({ isOpen, onClose, type, data = null, file = null }: PreviewModalProps) => {
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparedPreview, setPreparedPreview] = useState<PreparedPreviewSource | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [modeOverride, setModeOverride] = useState<PreviewMode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const viewerLoadedRef = useRef(false);
  const autoFallbackAttemptedRef = useRef(false);
  const isElectronDesktop = typeof window !== 'undefined' && Boolean((window as any).electronAPI);

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const docId = useMemo(() => {
    if (!data) return '';
    if ('number' in data && data.number) return String((data as any).number);
    if ('receiptNumber' in data && (data as any).receiptNumber) return String((data as any).receiptNumber);
    return '';
  }, [data]);

  const previewTitle = useMemo(() => {
    if (file?.title) return file.title;
    if (type === 'FISCAL_REPORT' && data && 'reportName' in data) return String((data as any).reportName);
    if (type === 'SUBSCRIPTION') return 'Recurring Invoice Preview';
    return 'Document Preview';
  }, [data, file?.title, type]);

  const previewMeta = useMemo(() => {
    if (file) {
      return {
        label: file.mimeType || inferMimeType(file.fileName, file.sourceUrl) || 'Document',
        reference: file.fileName,
      };
    }

    return {
      label: type ? type.replace(/_/g, ' ') : 'Document',
      reference: docId || 'Live preview',
    };
  }, [docId, file, type]);

  useEffect(() => {
    viewerLoadedRef.current = viewerLoaded;
  }, [viewerLoaded]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || (!data && !file) || (file && !file.fileName)) {
      setPreparedPreview(null);
      setPrepareError(null);
      setViewerError(null);
      setViewerLoaded(false);
      setIsSlowNetwork(false);
      setModeOverride(null);
      autoFallbackAttemptedRef.current = false;
      releaseObjectUrl();
      return;
    }

    let cancelled = false;
    setIsPreparing(true);
    setPrepareError(null);
    setPreparedPreview(null);
    setViewerError(null);
    setViewerLoaded(false);
    setIsSlowNetwork(false);
    setModeOverride(null);
    autoFallbackAttemptedRef.current = false;
    releaseObjectUrl();

    const preparePreview = async () => {
      try {
        if (file) {
          const fileName = file.fileName || 'document';
          const mimeType = file.mimeType || inferMimeType(file.fileName, file.sourceUrl);
          const publicUrl = file.publicUrl || (isPublicDocumentUrl(file.sourceUrl) ? file.sourceUrl : undefined);

          let displayUrl = file.sourceUrl || '';
          if (!displayUrl && file.fileId) {
            const localUrl = await localFileStorage.getUrl(file.fileId);
            if (!localUrl) {
              throw new Error('The selected file is no longer available in local storage.');
            }
            displayUrl = localUrl;
            objectUrlRef.current = localUrl;
          }

          if (!displayUrl) {
            throw new Error('No preview source is available for this document.');
          }

          if (isPdfMimeType(mimeType, fileName, displayUrl) && !displayUrl.startsWith('blob:') && !displayUrl.startsWith('data:')) {
            try {
              const pdfBlobUrl = await fetchPdfAsObjectUrl(displayUrl);
              displayUrl = pdfBlobUrl;
              objectUrlRef.current = pdfBlobUrl;
            } catch (pdfFetchError: any) {
              throw new Error(pdfFetchError?.message || 'Failed to fetch a valid PDF preview.');
            }
          }

          if (cancelled) return;

          setPreparedPreview({
            displayUrl,
            downloadUrl: file.downloadUrl || displayUrl,
            fileName,
            mimeType,
            publicUrl,
            title: file.title || fileName,
          });
          return;
        }

        if (!data || !type) {
          throw new Error('Missing document data for preview.');
        }

        let blob: Blob;
        try {
          const securedData = await attachDocumentSecurity(data as any);
          try {
            blob = await generatePreviewPdfBlob(type, securedData as PrimeDocData);
          } catch (pdfError: any) {
            const renderMessage = String(pdfError?.message || pdfError || '');

            if (shouldRetryWithSafeAssets(renderMessage)) {
              console.warn('[PreviewModal] Retrying preview with safe offline assets.', { type, renderMessage });
              blob = await generatePreviewPdfBlob(
                type,
                stripPreviewMediaData(securedData as PrimeDocData),
                buildSafePreviewConfig()
              );
            } else {
              throw pdfError;
            }
          }
        } catch (pdfError: any) {
          const msg = String(pdfError?.message || pdfError || '');
          // "incorrect data check" is a zlib error thrown by fflate when a
          // font file URL returned non-binary data (e.g., an HTML error page
          // while the backend is offline).  Retry once with the default font
          // by clearing the fonts-registered flag, then give a friendly error.
          if (msg.includes('incorrect data check') || msg.includes('zlib') || msg.includes('font')) {
            throw new Error(
              'The document font could not be loaded (offline or asset missing). ' +
              'The PDF has been generated with the default font. Please retry or use Download.'
            );
          }
          throw pdfError;
        }

        const blobUrl = URL.createObjectURL(blob);
        objectUrlRef.current = blobUrl;

        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        setPreparedPreview({
          displayUrl: blobUrl,
          downloadUrl: blobUrl,
          fileName: `${type}_${docId || 'document'}.pdf`,
          mimeType: 'application/pdf',
          publicUrl: undefined,
          title: previewTitle,
        });
      } catch (error: any) {
        if (!cancelled) {
          setPrepareError(error?.message || 'Failed to prepare the document preview.');
        }
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    };

    void preparePreview();

    return () => {
      cancelled = true;
      releaseObjectUrl();
    };
  }, [data, docId, file, isOpen, previewTitle, retryNonce, type]);

  const device = getDeviceProfile();
  const resolvedMode = preparedPreview
    ? resolvePreviewMode({
      device,
      fileName: preparedPreview.fileName,
      mimeType: preparedPreview.mimeType,
      publicUrl: preparedPreview.publicUrl,
      sourceUrl: preparedPreview.displayUrl,
    })
    : 'download';
  const isPdfPreview = preparedPreview
    ? isPdfMimeType(preparedPreview.mimeType, preparedPreview.fileName, preparedPreview.displayUrl)
    : false;
  const effectiveResolvedMode = isElectronDesktop && isPdfPreview && resolvedMode === 'iframe'
    ? 'embed'
    : resolvedMode;
  const viewerMode = modeOverride || effectiveResolvedMode;
  const canUseGoogleViewer = Boolean(preparedPreview?.publicUrl);

  useEffect(() => {
    if (!isOpen || !preparedPreview || viewerMode === 'download') return;

    viewerLoadedRef.current = viewerMode === 'embed';
    setViewerLoaded(viewerMode === 'embed');
    setViewerError(null);
    setIsSlowNetwork(false);

    if (viewerMode === 'embed') return;

    const slowTimer = window.setTimeout(() => {
      if (!viewerLoadedRef.current) {
        setIsSlowNetwork(true);
      }
    }, PREVIEW_SLOW_NETWORK_MS);

    const timeoutTimer = window.setTimeout(() => {
      if (viewerLoadedRef.current) return;

      if (canUseGoogleViewer && viewerMode !== 'google' && !autoFallbackAttemptedRef.current) {
        autoFallbackAttemptedRef.current = true;
        setModeOverride('google');
        return;
      }

      setViewerError('The preview timed out. Retry the document load or open it externally.');
    }, PREVIEW_TIMEOUT_MS);

    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [canUseGoogleViewer, isOpen, preparedPreview, retryNonce, viewerMode]);

  if (!isOpen || (!data && !file)) return null;

  const handleViewerLoad = () => {
    viewerLoadedRef.current = true;
    setViewerLoaded(true);
    setViewerError(null);
    setIsSlowNetwork(false);
  };

  const handleViewerError = () => {
    viewerLoadedRef.current = false;
    setViewerError('The document preview could not be displayed in this browser.');
  };

  const handleRetry = () => {
    viewerLoadedRef.current = false;
    autoFallbackAttemptedRef.current = false;
    setViewerLoaded(false);
    setViewerError(null);
    setPrepareError(null);
    setIsSlowNetwork(false);
    setModeOverride(null);
    setRetryNonce((current) => current + 1);
  };

  const handleDownload = () => {
    const targetUrl = preparedPreview?.downloadUrl || preparedPreview?.displayUrl;
    if (!targetUrl) return;

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = preparedPreview?.fileName || 'document';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = async () => {
    const targetUrl = preparedPreview?.downloadUrl || preparedPreview?.displayUrl;
    if (!targetUrl) return;

    try {
      await printDocumentUrl(targetUrl, previewTitle);
    } catch (error: any) {
      setViewerError(error?.message || 'The print dialog could not be opened for this document.');
    }
  };

  const handleOpenExternal = () => {
    const targetUrl = preparedPreview?.publicUrl || preparedPreview?.downloadUrl || preparedPreview?.displayUrl;
    if (!targetUrl) return;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const viewerSrc = preparedPreview
    ? viewerMode === 'google'
      ? buildGoogleViewerUrl(preparedPreview.publicUrl || '')
      : buildIframePreviewUrl(preparedPreview.displayUrl, isPdfPreview)
    : '';

  const renderPreviewSurface = () => {
    if (prepareError) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <FallbackPanel
            description={prepareError}
            title="Preview preparation failed"
            onDownload={preparedPreview ? handleDownload : undefined}
            onExternal={preparedPreview ? handleOpenExternal : undefined}
            onRetry={handleRetry}
          />
        </div>
      );
    }

    if (!preparedPreview) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-slate-500">
          Preparing preview...
        </div>
      );
    }

    if (viewerMode === 'download') {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <FallbackPanel
            description={preparedPreview.publicUrl
              ? 'Inline preview is unavailable for this format in the current browser. Use the fallback viewer or download the file.'
              : 'Inline preview is unavailable because this document is not exposed through a public URL. Use the explicit download action instead.'}
            title="Inline preview unavailable"
            onDownload={handleDownload}
            onExternal={preparedPreview.publicUrl ? handleOpenExternal : undefined}
            onRetry={handleRetry}
            onUseFallback={preparedPreview.publicUrl ? () => setModeOverride('google') : undefined}
          />
        </div>
      );
    }

    return (
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-inner">
        {!viewerLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">Loading document preview</p>
              <p className="mt-1 text-xs text-slate-500">
                {isSlowNetwork ? 'The network is slow. The viewer will retry automatically if needed.' : 'Preparing an inline preview for this device.'}
              </p>
            </div>
          </div>
        )}

        {viewerError && (
          <div className="absolute inset-4 z-20">
            <FallbackPanel
              description={viewerError}
              title="Preview failed"
              onDownload={handleDownload}
              onExternal={handleOpenExternal}
              onRetry={handleRetry}
              onUseFallback={canUseGoogleViewer && viewerMode !== 'google' ? () => setModeOverride('google') : undefined}
              onUseEmbed={isPdfPreview && viewerMode !== 'embed' ? () => setModeOverride('embed') : undefined}
            />
          </div>
        )}

        <div className={`h-full w-full ${viewerLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
          {viewerMode === 'image' ? (
            <img
              src={preparedPreview.displayUrl}
              alt={preparedPreview.title}
              className="h-full w-full object-contain bg-slate-50"
              onError={handleViewerError}
              onLoad={handleViewerLoad}
            />
          ) : viewerMode === 'embed' ? (
            <object
              aria-label={preparedPreview.title}
              className="h-full w-full"
              data={viewerSrc}
              type={preparedPreview.mimeType || 'application/pdf'}
            >
              <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
                Embedded preview is unavailable in this browser.
              </div>
            </object>
          ) : (
            <iframe
              key={`${viewerMode}-${retryNonce}-${viewerSrc}`}
              allow="fullscreen"
              className="h-full w-full border-0"
              onError={handleViewerError}
              onLoad={handleViewerLoad}
              src={viewerSrc}
              title={preparedPreview.title}
            />
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:p-6 print:hidden">
      <div className="flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[96vh] sm:rounded-[2rem] sm:border sm:border-white/10">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{previewTitle}</h2>
              <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {previewMeta.label} {previewMeta.reference ? `| ${previewMeta.reference}` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              onClick={handleRetry}
              type="button"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </button>
            <button
              className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPreparing || !preparedPreview}
              onClick={() => void handlePrint()}
              type="button"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </button>
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              onClick={handleDownload}
              type="button"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Download
            </button>
            <button
              aria-label="Close preview"
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">
              {viewerMode === 'google' ? 'Fallback viewer' : viewerMode === 'embed' ? 'Embedded viewer' : 'Inline viewer'}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">
              {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}
            </span>
          </div>

          <button
            className="inline-flex items-center gap-2 self-start text-slate-500 transition-colors hover:text-slate-800 sm:self-auto"
            onClick={handleOpenExternal}
            type="button"
          >
            <ExternalLink size={14} />
            Open externally
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-5">
          {isPreparing ? (
            <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">Preparing document</p>
                <p className="mt-1 text-xs text-slate-500">Generating a device-compatible preview surface.</p>
              </div>
            </div>
          ) : (
            renderPreviewSurface()
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const FallbackPanel = ({
  description,
  onDownload,
  onExternal,
  onRetry,
  onUseEmbed,
  onUseFallback,
  title,
}: {
  description: string;
  onDownload?: () => void;
  onExternal?: () => void;
  onRetry?: () => void;
  onUseEmbed?: () => void;
  onUseFallback?: () => void;
  title: string;
}) => (
  <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6">
    <div className="w-full max-w-md rounded-[1.75rem] border border-amber-100 bg-white p-6 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {onRetry && (
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onRetry} type="button">
            Retry
          </button>
        )}
        {onUseFallback && (
          <button className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={onUseFallback} type="button">
            Use fallback viewer
          </button>
        )}
        {onUseEmbed && (
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onUseEmbed} type="button">
            Use embedded viewer
          </button>
        )}
        {onExternal && (
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onExternal} type="button">
            Open externally
          </button>
        )}
        {onDownload && (
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={onDownload} type="button">
            Download
          </button>
        )}
      </div>
    </div>
  </div>
);
