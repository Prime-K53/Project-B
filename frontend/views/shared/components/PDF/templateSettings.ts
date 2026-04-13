import { Font } from '@react-pdf/renderer';
import { CompanyConfig } from '../../../../types.ts';

export const PRIME_PDF_FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times-Roman', label: 'Times Roman' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
] as const;

export type PrimePdfFontFamily = typeof PRIME_PDF_FONT_OPTIONS[number]['value'];

export interface PrimeTemplateSettings {
  engine: CompanyConfig['invoiceTemplates']['engine'];
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
  engine: 'Standard',
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
  return PRIME_PDF_FONT_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as PrimePdfFontFamily)
    : DEFAULT_PRIME_TEMPLATE_SETTINGS.fontFamily;
};

export const ensurePrimePdfFontsRegistered = () => {
  if (fontsRegistered) return;

  try {
    Font.register({
      family: 'Comic Sans MS',
      fonts: [
        { src: resolvePrimePdfAssetUrl('fonts/comic.ttf'), fontWeight: 'normal', fontStyle: 'normal' },
        { src: resolvePrimePdfAssetUrl('fonts/comicbd.ttf'), fontWeight: 'bold', fontStyle: 'normal' },
        { src: resolvePrimePdfAssetUrl('fonts/comici.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
        { src: resolvePrimePdfAssetUrl('fonts/comicz.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });
    fontsRegistered = true;
  } catch (error) {
    fontsRegistered = false;
    console.error('Failed to register Prime PDF fonts', error);
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
