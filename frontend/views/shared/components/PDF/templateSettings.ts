import { Font } from '@react-pdf/renderer';
import { CompanyConfig } from '../../../../types.ts';

export const PRIME_PDF_FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times-Roman', label: 'Times Roman' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
] as const;

export type PrimePdfFontFamily = typeof PRIME_PDF_FONT_OPTIONS[number]['value'];

export type TemplateEngine = 'Classic' | 'Modern' | 'Professional' | 'Clean';

export interface PrimeTemplateSettings {
  engine: TemplateEngine;
  accentColor: string;
  companyNameFontSize: number;
  bodyFontSize: number;
  fontFamily: PrimePdfFontFamily;
  logoWidth: number;
  showCompanyLogo: boolean;
  showPaymentTerms: boolean;
  showDueDate: boolean;
  showOutstandingAndWalletBalances: boolean;
}

export const DEFAULT_PRIME_TEMPLATE_SETTINGS: PrimeTemplateSettings = {
  engine: 'Classic',
  accentColor: '#3b82f6',
  companyNameFontSize: 18,
  bodyFontSize: 12,
  fontFamily: 'Helvetica',
  logoWidth: 140,
  showCompanyLogo: true,
  showPaymentTerms: true,
  showDueDate: true,
  showOutstandingAndWalletBalances: false,
};

let fontsRegistered = false;

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const resolvePrimePdfAssetUrl = (assetPath: string) => {
  const normalizedPath = String(assetPath || '').replace(/^\/+/, '');
  if (!normalizedPath) return assetPath;
  if (typeof window === 'undefined') return `/${normalizedPath}`;

  const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href);
  return new URL(normalizedPath, baseUrl).toString();
};

const normalizeAccentColor = (value?: string) => {
  const normalized = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)
    ? normalized
    : DEFAULT_PRIME_TEMPLATE_SETTINGS.accentColor;
};

const normalizeFontFamily = (value?: string): PrimePdfFontFamily => {
  const normalized = String(value || '').trim();
  const isKnown = PRIME_PDF_FONT_OPTIONS.some((option) => option.value === normalized);
  if (!isKnown) return DEFAULT_PRIME_TEMPLATE_SETTINGS.fontFamily;

  // If the custom font wasn't registered (e.g. offline), fall back to a
  // built-in PDF font so the renderer never encounters an unregistered family.
  if (normalized === 'Comic Sans MS' && !fontsRegistered) {
    return 'Helvetica';
  }

  return normalized as PrimePdfFontFamily;
};


/**
 * Checks whether a resolved font asset URL is safe to pass to @react-pdf/renderer.
 *
 * In packaged Electron builds the URL is a file:// path (always safe).
 * In dev mode it may be an http://127.0.0.1:5173/… URL – safe as long as
 * the Vite dev server is running.
 * We explicitly reject any URL that resolves to the backend port (3000 by
 * default) because the backend does NOT serve frontend assets, and a failed
 * fetch there returns an HTML error page that fflate cannot decompress.
 */
const isFontUrlSafe = (url: string): boolean => {
  try {
    if (!url) return false;
    // file:// URLs are always local and always safe
    if (url.startsWith('file://') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    const parsed = new URL(url);
    // Only allow http(s) on loopback – and only if it's NOT on port 3000
    // (the Express backend port that doesn't serve static font files).
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      if (port === '3000') return false; // backend – not a static file server
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const ensurePrimePdfFontsRegistered = () => {
  if (fontsRegistered) return;

  try {
    const srcNormal = resolvePrimePdfAssetUrl('fonts/comic.ttf');
    const srcBold = resolvePrimePdfAssetUrl('fonts/comicbd.ttf');
    const srcItalic = resolvePrimePdfAssetUrl('fonts/comici.ttf');
    const srcBoldItalic = resolvePrimePdfAssetUrl('fonts/comicz.ttf');

    // Only register if ALL font URLs are safe to fetch – avoids the
    // "incorrect data check" zlib crash when the dev server is offline.
    if (!isFontUrlSafe(srcNormal) || !isFontUrlSafe(srcBold) || !isFontUrlSafe(srcItalic) || !isFontUrlSafe(srcBoldItalic)) {
      console.warn('[PDF] Custom font URLs are not reachable in the current environment – falling back to built-in fonts.');
      fontsRegistered = false;
      return;
    }

    Font.register({
      family: 'Comic Sans MS',
      fonts: [
        { src: srcNormal, fontWeight: 'normal', fontStyle: 'normal' },
        { src: srcBold, fontWeight: 'bold', fontStyle: 'normal' },
        { src: srcItalic, fontWeight: 'normal', fontStyle: 'italic' },
        { src: srcBoldItalic, fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });
    fontsRegistered = true;
  } catch (error) {
    // Non-fatal – the PDF engine will use the built-in Helvetica fallback.
    fontsRegistered = false;
    console.warn('[PDF] Custom font registration skipped (offline or asset missing):', error);
  }
};

export const getStoredCompanyConfig = (): CompanyConfig | null => {
  if (typeof window === 'undefined') return null;

  const saved = localStorage.getItem('nexus_company_config');
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse company config', error);
    return null;
  }
};

export const resolvePrimeTemplateSettings = (companyConfig?: CompanyConfig | null): PrimeTemplateSettings => {
  const templateConfig = companyConfig?.invoiceTemplates || ({} as any);

  return {
    engine: (templateConfig.engine || DEFAULT_PRIME_TEMPLATE_SETTINGS.engine) as PrimeTemplateSettings['engine'],
    accentColor: normalizeAccentColor(templateConfig.accentColor),
    companyNameFontSize: clampNumber(
      templateConfig.companyNameFontSize,
      12,
      32,
      DEFAULT_PRIME_TEMPLATE_SETTINGS.companyNameFontSize
    ),
    bodyFontSize: clampNumber(
      templateConfig.bodyFontSize,
      10,
      16,
      DEFAULT_PRIME_TEMPLATE_SETTINGS.bodyFontSize
    ),
    fontFamily: normalizeFontFamily(templateConfig.fontFamily),
    logoWidth: clampNumber(
      templateConfig.logoWidth,
      80,
      220,
      DEFAULT_PRIME_TEMPLATE_SETTINGS.logoWidth
    ),
    showCompanyLogo: templateConfig.showCompanyLogo !== false,
    showPaymentTerms: templateConfig.showPaymentTerms !== false,
    showDueDate: templateConfig.showDueDate !== false,
    showOutstandingAndWalletBalances: Boolean(templateConfig.showOutstandingAndWalletBalances),
  };
};

export const getDefaultPaymentTermsLabel = (companyConfig?: CompanyConfig | null) => {
  const termsDays = clampNumber(
    companyConfig?.transactionSettings?.defaultPaymentTermsDays,
    0,
    365,
    30
  );

  return termsDays === 0 ? 'Due on receipt' : `Net ${termsDays}`;
};
