import React, { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { CompanyConfig } from '../../../../types.ts';
import { attachDocumentSecurity } from '../../../../utils/documentSecurity.ts';
import { PrimeDocument } from './PrimeDocument.tsx';
import { PrimeDocData } from './schemas.ts';
import { getDefaultPaymentTermsLabel } from './templateSettings.ts';
import { getPlaceholder } from '../../../../constants/placeholders';

interface PrimeTemplatePreviewProps {
  config: CompanyConfig;
}

const buildPreviewDocumentData = (config: CompanyConfig): PrimeDocData => {
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  const paymentTerms = getDefaultPaymentTermsLabel(config);
  const termsDays = Number(config?.transactionSettings?.defaultPaymentTermsDays || 30);
  dueDate.setDate(issueDate.getDate() + (Number.isFinite(termsDays) ? termsDays : 30));

  const items = [
    { desc: 'A4 Full Colour Booklets', qty: 120, price: 14.5, total: 1740 },
    { desc: 'Branded NCR Invoice Pads', qty: 30, price: 68, total: 2040 },
    { desc: 'Custom Delivery Note Books', qty: 15, price: 92, total: 1380 },
  ];
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const amountPaid = 2100;

  return {
    number: 'INV-TEMPLATE-001',
    invoiceNumber: 'INV-TEMPLATE-001',
    date: issueDate.toLocaleDateString(),
    dueDate: dueDate.toLocaleDateString(),
    paymentTerms,
    clientName: 'Mwai Academy',
    address: getPlaceholder.address(),
    phone: getPlaceholder.phone(),
    createdAtIso: issueDate.toISOString(),
    createdByName: 'Template Preview',
    items,
    subtotal: totalAmount,
    amountPaid,
    totalAmount,
    status: 'Partially Paid',
    walletBalance: 350,
  };
};

export const PrimeTemplatePreview: React.FC<PrimeTemplatePreviewProps> = ({ config }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsGenerating(true);
      setError(null);
      setPreviewUrl('');
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      try {
        console.log('[PDF] Starting preview generation...', { type: 'INVOICE' });
        const previewData = buildPreviewDocumentData(config);
        const securedData = await attachDocumentSecurity(previewData as any, config?.companyName);
        
        // Wrap the PDF generation in a promise that can timeout
        const blobPromise = pdf(
          <PrimeDocument type="INVOICE" data={securedData as PrimeDocData} configOverride={config} />
        ).toBlob();

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timed out (10s). Check font accessibility and assets.')), 10000)
        );

        const blob = await Promise.race([blobPromise, timeoutPromise]) as Blob;

        if (cancelled) return;

        const nextUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        console.log('[PDF] Preview generation successful.');
      } catch (previewError: any) {
        console.error('[PDF] Preview generation failed:', previewError);
        if (!cancelled) {
          setPreviewUrl('');
          setError(previewError?.message || 'Failed to generate the Prime document preview.');
        }
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    }, 120);


    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [config, retryKey]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
      {/* Main content area */}
      {previewUrl ? (
        <iframe
          key={previewUrl}
          title="Prime document preview"
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          className="h-full w-full bg-white"
        />
      ) : !error ? (
        <div className="flex h-full items-center justify-center bg-white">
          <p className="text-sm font-medium text-slate-500">Preparing the Prime PDF preview...</p>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center bg-white">
          <p className="text-sm font-medium text-slate-400">Preview unavailable</p>
        </div>
      )}

      {/* Generating overlay banner */}
      {isGenerating && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center bg-white/80 py-2 text-xs font-semibold text-slate-600 backdrop-blur-sm">
          Refreshing exact preview...
        </div>
      )}

      {/* Error banner with retry */}
      {error && (
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <p className="mb-2">{error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
