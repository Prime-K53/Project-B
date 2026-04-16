import React from 'react';
import { Document, Page, View, Text, Font, Image } from '@react-pdf/renderer';
import { docStyles as s } from './styles.ts';
import { PrimeDocData } from './schemas.ts';
import { CompanyConfig } from '../../../../types.ts';
import {
  ensurePrimePdfFontsRegistered,
  getDefaultPaymentTermsLabel,
  getStoredCompanyConfig,
  resolvePrimeTemplateSettings,
} from './templateSettings.ts';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Disable hyphenation
Font.registerHyphenationCallback(word => [word]);

// Format amount helper
const formatAmount = (amount: number) => {
  return (amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatDateOnly = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'N/A';

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString();
  }

  const simpleDate = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (simpleDate) {
    const dateOnly = new Date(`${simpleDate[1]}T00:00:00`);
    if (!Number.isNaN(dateOnly.getTime())) {
      return dateOnly.toLocaleDateString();
    }
  }

  const beforeComma = normalized.split(',')[0]?.trim();
  return beforeComma || normalized;
};

const getStatusTone = (status?: string) => {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'paid' || normalized === 'active') {
    return { border: '#10b981', text: '#059669' };
  }

  if (normalized === 'partial' || normalized === 'partially paid' || normalized === 'partially_paid' || normalized === 'paused' || normalized === 'processing') {
    return { border: '#f59e0b', text: '#d97706' };
  }

  if (normalized === 'overdue') {
    return { border: '#dc2626', text: '#b91c1c' };
  }

  return { border: '#ef4444', text: '#dc2626' };
};

const formatSecurityTimestamp = (value?: string) => {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }

  return String(value || 'Unknown time');
};

import { StatementSummaryTemplate } from './StatementSummaryTemplate.tsx';
import { COMPANY_LOGO_BASE64 } from '../../../../utils/brandAssets.ts';

interface DocProps {
  type: 'INVOICE' | 'WORK_ORDER' | 'PO' | 'DELIVERY_NOTE' | 'QUOTATION' | 'RECEIPT' | 'SUPPLIER_PAYMENT' | 'POS_RECEIPT' | 'ACCOUNT_STATEMENT' | 'EXAMINATION_INVOICE' | 'ACCOUNT_STATEMENT_SUMMARY' | 'FISCAL_REPORT' | 'SALES_EXCHANGE' | 'ORDER' | 'SALES_ORDER' | 'SUBSCRIPTION';
  data: PrimeDocData;
  configOverride?: CompanyConfig | null;
}

const SecurityFooter = ({
  data,
  companyName,
  legalFooterLine1,
  legalFooterLine2,
  fontScale = 1,
}: {
  data: any;
  companyName: string;
  legalFooterLine1: string;
  legalFooterLine2: string;
  fontScale?: number;
}) => {
  const footerQrSize = 50;
  const documentNumber = String(
    data?.number
    || data?.invoiceNumber
    || data?.orderNumber
    || data?.receiptNumber
    || data?.paymentId
    || data?.exchangeNumber
    || data?.reportName
    || 'N/A'
  ).trim() || 'N/A';
  const createdBy = String(
    data?.createdByName
    || data?.createdBy
    || data?.created_by
    || data?.cashierName
    || 'System User'
  ).trim() || 'System User';
  const createdOn = formatSecurityTimestamp(
    data?.createdAtIso
    || data?.createdAt
    || data?.created_at
    || data?.date
  );
  const qrCodeDataUrl = String(data?.securityQrCodeDataUrl || '').trim();

  return (
    <View style={s.securityFooter} fixed>
      <View style={s.securityFooterText}>
        <Text style={[s.securityFooterLine, { fontSize: 10 * fontScale, lineHeight: 1.4 }]}>{legalFooterLine1}</Text>
        <Text style={[s.securityFooterLine, { marginTop: 2, fontSize: 10 * fontScale, lineHeight: 1.4 }]}>{legalFooterLine2}</Text>
      </View>

      <View
        style={[
          s.securityQrPanel,
          {
            width: footerQrSize,
            alignItems: 'flex-end',
            borderTopWidth: 0,
            borderRightWidth: 0,
            borderBottomWidth: 0,
            borderLeftWidth: 0,
            backgroundColor: 'transparent',
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
          },
        ]}
      >
        {qrCodeDataUrl ? (
          <Image src={qrCodeDataUrl} style={[s.securityQrImage, { width: footerQrSize, height: footerQrSize, marginBottom: 0 }]} />
        ) : null}
      </View>
    </View>
  );
};

const CleanInvoiceTemplate = ({
  data,
  config,
  templateSettings
}: {
  data: PrimeDocData;
  config: CompanyConfig | null;
  templateSettings: ReturnType<typeof resolvePrimeTemplateSettings>;
}) => {
  const dataAny = data as any;
  const companyName = config?.companyName || 'Company Name';
  const companyAddress = config?.addressLine1 || 'Address';
  const companyPhone = config?.phone || 'Phone';
  const companyEmail = config?.email || 'email@example.com';
  const currency = config?.currencySymbol || 'K';

  const invoiceNumber = dataAny.invoiceNumber || dataAny.number || 'INV-001';
  const invoiceDate = dataAny.date || new Date().toLocaleDateString();
  const clientName = dataAny.clientName || 'Client Name';
  const clientAddress = dataAny.address || 'Client Address';
  const clientEmail = dataAny.phone || 'client@email.com';
  const items = dataAny.items || [];
  const subtotal = dataAny.subtotal || 0;
  const amountPaid = dataAny.amountPaid || 0;
  const totalAmount = dataAny.totalAmount || subtotal;
  const tax = dataAny.tax || 100;
  const grandTotal = totalAmount + tax;

  const renderRow = (item: any, i: number) => (
    <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' }}>
      <Text style={{ flex: 2, padding: 8, fontSize: 11 }}>{item.desc || item.name}</Text>
      <Text style={{ width: 60, padding: 8, fontSize: 11, textAlign: 'right' }}>{item.qty}</Text>
      <Text style={{ width: 80, padding: 8, fontSize: 11, textAlign: 'right' }}>{currency} {(item.price || item.total / item.qty).toFixed(2)}</Text>
      <Text style={{ width: 80, padding: 8, fontSize: 11, textAlign: 'right' }}>{currency} {item.total.toFixed(2)}</Text>
    </View>
  );

  return (
    <Document title={`Invoice ${invoiceNumber}`} author={companyName}>
      <Page size="A4" style={{ padding: 40, fontFamily: 'Helvetica' }}>
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <View style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 24, 
            backgroundColor: '#333', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>F</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', letterSpacing: 2, color: '#666' }}>
            FOX NETWORK
          </Text>
          <Text style={{ fontSize: 11, color: '#777', marginTop: 4, textAlign: 'center' }}>
            {companyAddress}, {companyPhone}{'\n'}
            {companyEmail}
          </Text>
        </View>

        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <Text style={{ fontSize: 36, fontWeight: '300', color: '#1a1a1a' }}>
            Invoice <Text style={{ fontStyle: 'italic' }}>Service</Text>
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 40 }}>
          <Text style={{ fontSize: 12, color: '#555' }}>
            <Text style={{ fontWeight: '600', color: '#1a1a1a' }}>Invoice Number:</Text> {invoiceNumber}
          </Text>
          <Text style={{ fontSize: 12, color: '#555' }}>
            <Text style={{ fontWeight: '600', color: '#1a1a1a' }}>Invoice Date:</Text> {invoiceDate}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 30, gap: 30 }}>
          <View style={{ flex: 1 }}>
            <View style={{ 
              backgroundColor: templateSettings.accentColor || '#5a9e96', 
              padding: 5, 
              borderRadius: 3,
              alignSelf: 'flex-start',
              marginBottom: 8
            }}>
              <Text style={{ fontSize: 10, fontWeight: '500', letterSpacing: 1.5, color: '#fff' }}>
                PAYMENT INFO
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Bank Transfer</Text>
            <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>David Joe</Text>
            <Text style={{ fontSize: 12, color: '#555' }}>0129 9847 3829</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={{ 
              backgroundColor: templateSettings.accentColor || '#5a9e96', 
              padding: 5, 
              borderRadius: 3,
              alignSelf: 'flex-end',
              marginBottom: 8
            }}>
              <Text style={{ fontSize: 10, fontWeight: '500', letterSpacing: 1.5, color: '#fff' }}>
                BILL TO
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 }}>{clientName}</Text>
            <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>{clientEmail}</Text>
            <Text style={{ fontSize: 12, color: '#555' }}>{clientAddress}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', backgroundColor: templateSettings.accentColor || '#5a9e96', borderRadius: 3 }}>
            <Text style={{ flex: 2, padding: 8, fontSize: 11, fontWeight: '500', color: '#fff' }}>Item Description</Text>
            <Text style={{ width: 60, padding: 8, fontSize: 11, fontWeight: '500', color: '#fff', textAlign: 'right' }}>Qty.</Text>
            <Text style={{ width: 80, padding: 8, fontSize: 11, fontWeight: '500', color: '#fff', textAlign: 'right' }}>Unit Price</Text>
            <Text style={{ width: 80, padding: 8, fontSize: 11, fontWeight: '500', color: '#fff', textAlign: 'right' }}>Amount</Text>
          </View>
          {items.map(renderRow)}
          <View style={{ flexDirection: 'row', backgroundColor: '#f0f0ee', borderRadius: 3 }}>
            <Text style={{ flex: 2, padding: 8, fontSize: 12, fontWeight: '600' }}>Total Payment</Text>
            <Text style={{ width: 60, padding: 8, fontSize: 12, textAlign: 'right' }}>-</Text>
            <Text style={{ width: 80, padding: 8, fontSize: 12, textAlign: 'right' }}>-</Text>
            <Text style={{ width: 80, padding: 8, fontSize: 12, fontWeight: '600', textAlign: 'right' }}>{currency} {subtotal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 30 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 12, color: '#1a1a1a', marginBottom: 4 }}>Notes:</Text>
            <Text style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              Payment is due within 30 days of project completion.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ width: '100%' }}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ padding: 5, flex: 1, fontSize: 12, color: '#555' }}>Tax</Text>
                <Text style={{ padding: 5, flex: 1, fontSize: 12, textAlign: 'right' }}>{currency} {tax.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', backgroundColor: templateSettings.accentColor || '#5a9e96', borderRadius: 3 }}>
                <Text style={{ padding: 6, flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' }}>Grand Total</Text>
                <Text style={{ padding: 6, flex: 1, fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'right' }}>{currency} {grandTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 40, paddingTop: 20, borderTopWidth: 0.5, borderTopColor: '#e0e0e0', gap: 20 }}>
          <View style={{ width: 56, height: 56, backgroundColor: '#f5f5f5', borderWidth: 0.5, borderColor: '#ddd', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, color: '#aaa' }}>QR</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 }}>More Info:</Text>
            <Text style={{ fontSize: 11, color: '#555' }}>{companyPhone}{'\n'}{companyEmail}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const PrimeDocument = ({ type, data, configOverride = null }: DocProps) => {
  ensurePrimePdfFontsRegistered();
  const isFinancial = type === 'INVOICE' || type === 'PO' || type === 'QUOTATION' || type === 'ORDER' || (type as string) === 'SALES_ORDER' || type === 'SUBSCRIPTION';
  const dataAny = data as any;
  const config = configOverride || getStoredCompanyConfig();
  const templateSettings = resolvePrimeTemplateSettings(config);

  if (type === 'INVOICE' && templateSettings.engine === 'Clean') {
    return <CleanInvoiceTemplate data={data as PrimeDocData} config={config} templateSettings={templateSettings} />;
  }

  const fontScale = templateSettings.bodyFontSize / 12;
  const showDueDate = templateSettings.showDueDate;
  const showPaymentTerms = templateSettings.showPaymentTerms;
  const paymentTermsLabel = String(dataAny?.paymentTerms || '').trim() || getDefaultPaymentTermsLabel(config);
  const companyName = config?.companyName || 'Prime Printing & Stationery';
  const companyAddress = config?.addressLine1 || 'Lilongwe, Malawi';

  // Format phone numbers if they are concatenated without separators
  const rawPhone = config?.phone || '';
  const formattedPhone = rawPhone.replace(/(\+265\s?\d{3}\s?\d{3}\s?\d{3})(?=\+265)/g, '$1 | ');
  const companyPhone = formattedPhone || 'N/A';
  const companyEmail = config?.email || 'N/A';

  const companyContact = `${formattedPhone} | ${config?.email || ''}`;
  const companyEnquiryLine = [companyName, companyAddress].filter(Boolean).join(', ');
  const legalFooterLine1 = showPaymentTerms
    ? `This is a computer-generated document. Payment terms: ${paymentTermsLabel}.`
    : 'This is a computer-generated document. All accounts are subject to our terms of service';
  const legalFooterLine2 = `For enquiries contact: ${companyEnquiryLine} Phone: ${companyPhone}`;
  const currency = config?.currencySymbol || 'K';
  const logo = templateSettings.showCompanyLogo ? (config?.logoBase64 || COMPANY_LOGO_BASE64) : '';
  const showInvoiceBalances = templateSettings.showOutstandingAndWalletBalances;
  const resolvedWalletBalance = Number(dataAny?.walletBalance || 0);
  const resolvedOutstandingBalance = Math.max(
    0,
    Number(dataAny?.totalAmount || 0) - Number(dataAny?.amountPaid || 0)
  );
  const pageStyle = {
    fontFamily: templateSettings.fontFamily,
    fontSize: templateSettings.bodyFontSize,
  };
  const brandTextStyle = {
    fontFamily: templateSettings.fontFamily,
    fontSize: templateSettings.companyNameFontSize,
    fontWeight: 'bold',
  };
  const titleStyle = {
    fontSize: 27.75 * fontScale,
  };
  const logoStyle = {
    width: templateSettings.logoWidth,
  };
  const scaledFont = (size: number) => Number((size * fontScale).toFixed(2));
  const renderBrandMark = (alignment: 'left' | 'right' = 'right') => (
    logo
      ? <Image src={logo} style={[alignment === 'right' ? s.logoRight : s.logo, logoStyle]} />
      : (
        <Text
          style={[
            brandTextStyle,
            alignment === 'left' ? { marginBottom: 5 } : null,
          ]}
        >
          {companyName}
        </Text>
      )
  );

  const isRightAligned = ['INVOICE', 'QUOTATION', 'ORDER', 'SALES_ORDER', 'PO', 'DELIVERY_NOTE', 'EXAMINATION_INVOICE', 'SALES_EXCHANGE', 'SUBSCRIPTION'].includes(type);
  const recipientSectionEnabledTypes = ['INVOICE', 'PO', 'WORK_ORDER', 'DELIVERY_NOTE', 'QUOTATION', 'EXAMINATION_INVOICE', 'ORDER', 'SALES_ORDER', 'SUBSCRIPTION'];
  const resolvedRecipientName = String(
    dataAny.clientName
    || dataAny.customerName
    || dataAny.customer_name
    || dataAny.schoolName
    || dataAny.school_name
    || dataAny.recipientName
    || dataAny.recipient_name
    || dataAny.vendorName
    || dataAny.vendor_name
    || dataAny.supplierName
    || dataAny.supplier_name
    || dataAny.proofOfDelivery?.receivedBy
    || dataAny.receivedBy
    || ''
  ).trim();
  const resolvedRecipientAddress = String(
    dataAny.address
    || dataAny.customerAddress
    || dataAny.customer_address
    || dataAny.billingAddress
    || dataAny.billing_address
    || dataAny.shippingAddress
    || dataAny.shipping_address
    || dataAny.schoolAddress
    || dataAny.school_address
    || dataAny.vendorAddress
    || dataAny.vendor_address
    || dataAny.supplierAddress
    || dataAny.supplier_address
    || dataAny.proofOfDelivery?.address
    || dataAny.proofOfDelivery?.deliveryLocation
    || ''
  ).trim();
  const resolvedRecipientPhone = String(
    dataAny.phone
    || dataAny.customerPhone
    || dataAny.customer_phone
    || dataAny.schoolPhone
    || dataAny.school_phone
    || dataAny.vendorPhone
    || dataAny.vendor_phone
    || dataAny.supplierPhone
    || dataAny.supplier_phone
    || dataAny.recipientPhone
    || dataAny.recipient_phone
    || dataAny.proofOfDelivery?.receiverPhone
    || dataAny.proofOfDelivery?.recipientPhone
    || dataAny.proofOfDelivery?.phone
    || ''
  ).trim();
  const shouldRenderRecipientSection = Boolean(
    recipientSectionEnabledTypes.includes(type) || resolvedRecipientName || resolvedRecipientAddress || resolvedRecipientPhone
  );
  const recipientLabel = type === 'PO'
    ? 'To Vendor'
    : type === 'EXAMINATION_INVOICE'
      ? 'Customer'
      : 'Bill To:';
  const resolveConversionSourceNumber = (doc: any) => {
    if (!doc?.conversionDetails) return 'N/A';
    if (doc.conversionDetails.sourceNumber === 'N/A' && 'invoiceNumber' in doc) return doc.invoiceNumber;
    if (doc.conversionDetails.sourceNumber === 'N/A' && 'orderNumber' in doc) return doc.orderNumber;
    return doc.conversionDetails.sourceNumber || 'N/A';
  };

  if (type === 'SALES_EXCHANGE') {
    const d = data as any; // Cast for easier access to specialized fields
    const items = d.items || [];

    return (
      <Document title={`Sales Exchange - ${d.exchangeNumber}`} author={companyName}>
        <Page size="A4" style={[s.page, pageStyle]}>
          {d.isConverted && d.conversionDetails && (
            <View style={[s.conversionBox, { position: 'absolute', top: 40, right: 40, zIndex: 10 }]}>
              <Text style={s.conversionTitle}>Conversion History</Text>
              <Text>Converted from {d.conversionDetails.sourceType} {d.conversionDetails.sourceNumber}</Text>
              <Text>on {d.conversionDetails.date}</Text>
            </View>
          )}

          <View style={s.headerSection}>
            <View style={s.headerLeft}>
              <Text style={[s.title, titleStyle]}>Exchange Note</Text>
              <View style={s.infoText}>
                <Text>Exchange # : {d.exchangeNumber}</Text>
                <Text>Date : {d.date}</Text>
                <Text>Ref Invoice : {d.invoiceNumber}</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              {renderBrandMark('right')}
            </View>
          </View>

          <View style={[s.billingSection, { marginTop: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Customer</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{d.customerName}</Text>
              <Text style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{resolvedRecipientAddress || 'N/A'}</Text>
              <Text style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{resolvedRecipientPhone || 'N/A'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Reason for Exchange</Text>
              <Text style={{ fontSize: 11 }}>{d.reason}</Text>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <View style={s.tableHeader}>
              <Text style={s.colDesc}>Item Description</Text>
              <Text style={[s.colQty, { width: 60 }]}>Returned</Text>
              <Text style={[s.colQty, { width: 60 }]}>Replaced</Text>
              <Text style={s.colTotal}>Adjustment</Text>
            </View>
            {items.map((item: any, i: number) => (
              <View key={i} style={s.row}>
                <Text style={[s.colDesc, { fontSize: 10 }]}>{item.desc || 'N/A'}</Text>
                <Text style={[s.colQty, { width: 60, fontSize: 10 }]}>{item.qtyReturned}</Text>
                <Text style={[s.colQty, { width: 60, fontSize: 10 }]}>{item.qtyReplaced}</Text>
                <Text style={[s.colTotal, { fontSize: 10, fontWeight: 'bold' }]}>
                  {currency} {formatAmount(item.priceDiff)}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.summaryContainer}>
            <View style={s.summaryBox}>
              <View style={s.totalRow}>
                <Text style={{ fontSize: 10 }}>Net Adjustment</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{currency} {formatAmount(d.totalPriceDiff)}</Text>
              </View>
            </View>
          </View>

          {d.remarks && (
            <View style={{ marginTop: 20, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase', color: '#475569' }}>Remarks / Special Instructions:</Text>
              <Text style={{ fontSize: 10, color: '#1e293b', lineHeight: 1.5 }}>{d.remarks}</Text>
            </View>
          )}

          <View style={{ marginTop: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ width: 180, alignItems: 'center' }}>
                <View style={{ width: '100%', borderTopWidth: 1, borderColor: '#000', marginBottom: 5 }} />
                <Text style={{ fontSize: 10 }}>Customer Signature</Text>
                <Text style={{ fontSize: 8, color: '#666' }}>I accept the replacement items</Text>
              </View>
              <View style={{ width: 180, alignItems: 'center' }}>
                <View style={{ width: '100%', borderTopWidth: 1, borderColor: '#000', marginBottom: 5 }} />
                <Text style={{ fontSize: 10 }}>Authorized Officer</Text>
                <Text style={{ fontSize: 8, color: '#666' }}>Exchange approved & processed</Text>
              </View>
            </View>
          </View>

          <SecurityFooter
            data={d}
            companyName={companyName}
            legalFooterLine1="This is a computer-generated Sales Exchange Note. No signature is required if authorized digitally."
            legalFooterLine2={`All exchanges are subject to ${companyName} Return & Exchange Policy.`}
            fontScale={fontScale}
          />
        </Page>
      </Document>
    );
  }

  if (type === 'RECEIPT') {
    const rc = data as any;
    const isPartial = rc.paymentStatus === 'PARTIALLY PAID';
    const isOverpaid = rc.paymentStatus === 'OVERPAID';
    const overpaymentAmount = rc.overpaymentAmount || rc.walletDeposit || 0;
    const isFullyPaid = rc.paymentStatus === 'PAID' || (!isPartial && !isOverpaid);

    return (
      <Document title={`Payment Receipt - ${rc.receiptNumber}`} author={companyName}>
        <Page size="A4" style={[s.page, pageStyle]}>

          <View style={s.headerSection}>
            <View style={s.headerLeft}>
              <Text style={[s.title, titleStyle]}>Payment Receipt</Text>
              <View style={s.infoText}>
                <Text>Receipt # : {rc.receiptNumber}</Text>
                <Text>Date : {rc.date}</Text>
                <Text>Method : {rc.paymentMethod}</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              {renderBrandMark('right')}
            </View>
          </View>

          {isOverpaid && (
            <View style={{ backgroundColor: '#fef2f2', padding: 10, borderRadius: 4, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#ef4444' }}>
              <Text style={{ color: '#991b1b', fontSize: 12, fontWeight: 'bold', lineHeight: 1.4 }}>OVERPAYMENT NOTICE</Text>
              <Text style={{ color: '#b91c1c', fontSize: 12, lineHeight: 1.4 }}>
                This payment exceeds the invoice total. The excess has been credited to your wallet.
              </Text>
            </View>
          )}

          <View style={[s.billingSection, { marginTop: 0, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Received From</Text>
              <View style={s.recipientInfoText}>
                <Text style={s.recipientName}>{rc.customerName || 'N/A'}</Text>
                {resolvedRecipientAddress ? (
                  <Text style={s.recipientDetail}>{resolvedRecipientAddress}</Text>
                ) : null}
                {resolvedRecipientPhone ? (
                  <Text style={s.recipientPhone}>{resolvedRecipientPhone}</Text>
                ) : null}
              </View>
            </View>
            
            {/* PAID Stamp for fully paid receipts moved to right margin of same row */}
            {isFullyPaid && (
              <View style={{ marginTop: -5, marginLeft: -3 }}>
                <Text style={[s.paidStampText, { fontSize: 28.8, color: '#16a34a' }]}>PAID</Text>
              </View>
            )}
          </View>

          <View style={{ marginTop: 5, padding: 15, backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <Text style={{ fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
              {rc.narrative || `This receipt acknowledges payment of ${currency} ${formatAmount(rc.amountReceived)} received from ${rc.customerName}.`}
            </Text>
          </View>

          <View style={{ marginTop: 30 }}>
            <View style={s.tableHeader}>
              <Text style={{ flex: 3 }}>Description</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>Amount Paid</Text>
            </View>
            <View style={s.row}>
              <Text style={{ flex: 3 }}>Payment for Invoices: {(rc.appliedInvoices || []).join(', ')}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{currency} {formatAmount(rc.amountReceived)}</Text>
            </View>
          </View>

          <View style={[s.summaryContainer, { justifyContent: 'flex-end' }]}>
            <View style={s.summaryBox}>
              <View style={s.totalRow}>
                <Text>Amount Received</Text>
                <Text style={{ fontWeight: 'bold' }}>{currency} {formatAmount(rc.amountReceived)}</Text>
              </View>

              {isPartial && (
                <View style={[s.totalRow, { color: '#ef4444' }]}>
                  <Text>Outstanding Balance</Text>
                  <Text>{currency} {formatAmount(rc.balanceDue)}</Text>
                </View>
              )}

              {isOverpaid && overpaymentAmount > 0 && (
                <View style={[s.totalRow, { color: '#10b981' }]}>
                  <Text>Wallet Credit</Text>
                  <Text>{currency} {formatAmount(overpaymentAmount)}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.footerContainer} wrap={false}>
            <Text style={[s.thankYouText, { fontSize: scaledFont(9) }]}>Thank you for choosing <Text style={{ fontWeight: 'bold', fontSize: scaledFont(13) }}>{companyName}</Text></Text>
            <View style={s.footerLine} />
            <Text style={[s.footerDetail, { fontSize: 9 }]}>{companyAddress}</Text>
            <Text style={[s.footerDetail, { fontSize: 9 }]}>{companyContact}</Text>
          </View>

          <SecurityFooter
            data={rc}
            companyName={companyName}
            legalFooterLine1="This is a computer-generated payment receipt. No signature required if digitally authorized."
            legalFooterLine2="Thank you for your business!"
            fontScale={fontScale}
          />
        </Page>
      </Document>
    );
  }

  if (type === 'SUPPLIER_PAYMENT') {
    const sp = data as any;
    return (
      <Document title={`Payment Voucher - ${sp.paymentId}`} author={companyName}>
        <Page size="A4" style={[s.page, pageStyle]}>
          <View style={s.headerSection}>
            <View style={s.headerLeft}>
              {renderBrandMark('left')}
            </View>
            <View style={s.headerLeft}>
              <Text style={[s.title, titleStyle]}>Payment Voucher</Text>
              <View style={s.infoText}>
                <Text>Voucher # : {sp.paymentId}</Text>
                <Text>Date : {sp.date}</Text>
                <Text>Method : {sp.paymentMethod}</Text>
              </View>
            </View>
          </View>

          <View style={[s.billingSection, { marginTop: 0, marginBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Paid To</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{sp.supplierName}</Text>
            </View>
          </View>

          <View style={{ marginTop: 5, padding: 15, backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <Text style={{ fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
              {sp.narrative || `This voucher confirms payment of ${currency} ${formatAmount(sp.amountPaid)} to ${sp.supplierName}.`}
            </Text>
          </View>

          <View style={{ marginTop: 30 }}>
            <View style={s.tableHeader}>
              <Text style={{ flex: 3 }}>Description</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>Amount Paid</Text>
            </View>
            <View style={s.row}>
              <Text style={{ flex: 3 }}>Payment against Invoices: {(sp.appliedInvoices || []).join(', ')}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{currency} {formatAmount(sp.amountPaid)}</Text>
            </View>
          </View>

          <View style={s.summaryContainer}>
            <View style={s.summaryBox}>
              <View style={s.totalRow}>
                <Text>Total Paid</Text>
                <Text style={{ fontWeight: 'bold' }}>{currency} {formatAmount(sp.amountPaid)}</Text>
              </View>
            </View>
          </View>

          <View style={s.footerContainer} wrap={false}>
            <Text style={s.thankYouText}>Authorized by <Text style={{ fontWeight: 'bold', fontSize: scaledFont(13) }}>{companyName}</Text></Text>
            <View style={s.footerLine} />
            <Text style={[s.companyName, { fontSize: templateSettings.companyNameFontSize }]}>{companyName}</Text>
            <Text style={s.footerDetail}>{companyAddress}</Text>
            <Text style={s.footerDetail}>{companyContact}</Text>
          </View>

          <View style={s.signatureBlock}>
            <View>
              <View style={s.sigLine} />
              <Text>Authorized Signatory</Text>
            </View>
            <View>
              <View style={s.sigLine} />
              <Text>Received By</Text>
            </View>
          </View>

          <SecurityFooter
            data={sp}
            companyName={companyName}
            legalFooterLine1="This is a computer-generated payment voucher."
            legalFooterLine2={`Issued securely by ${companyName}.`}
            fontScale={fontScale}
          />
        </Page>
      </Document>
    );
  }
if (type === 'POS_RECEIPT') {
  const r = data as any;

  // Scaling factor (Reduced by 20% from 1.52 to 1.22)
  const scale = 1.22;
  const baseFontSize = 8 * scale;
  const largeFontSize = 12 * scale;
  const smallFontSize = 7 * scale;
  const mediumFontSize = 9 * scale;

  return (
    <Document title={`Receipt - ${r.receiptNumber}`} author={companyName}>
      <Page size="A4" style={[s.page, pageStyle, { padding: 0, backgroundColor: '#f9fafb' }]}>
        <View style={[s.posA4Wrapper, { width: 250 * scale, paddingVertical: 30 * scale, paddingHorizontal: 10 * scale }]}>
            {/* Header - Replaced logo with Company Name, Address and Contacts */}
            <View style={{ alignItems: 'center', marginBottom: 15 * scale }}>
              <Text style={{ fontSize: 16 * scale, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 * scale }}>{companyName}</Text>
              <Text style={{ fontSize: baseFontSize, textAlign: 'center', marginBottom: 2 * scale }}>{companyAddress}</Text>
              <Text style={{ fontSize: baseFontSize, textAlign: 'center' }}>{companyContact}</Text>
            </View>

            <View style={{ marginBottom: 12 * scale, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'dashed', paddingBottom: 8 * scale }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 * scale }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Date:</Text>
                <Text style={{ fontSize: baseFontSize }}>{r.date}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 * scale }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Receipt #:</Text>
                <Text style={{ fontSize: baseFontSize, fontWeight: 'bold' }}>{r.receiptNumber}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 * scale }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Cashier:</Text>
                <Text style={{ fontSize: baseFontSize }}>{r.cashierName}</Text>
              </View>
              {r.customerName && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: baseFontSize, color: '#666' }}>Customer:</Text>
                  <Text style={{ fontSize: baseFontSize }}>{r.customerName}</Text>
                </View>
              )}
            </View>

            {/* PAID Stamp for POS receipts */}
            <View style={s.paidStampSmallContainer}>
              <View style={s.paidStampSmallBox}>
                <Text style={s.paidStampSmallText}>PAID</Text>
              </View>
            </View>

            {/* Items */}
            <View style={{ marginBottom: 15 * scale }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingBottom: 3 * scale, marginBottom: 5 * scale }}>
                <Text style={{ flex: 3, fontSize: baseFontSize, fontWeight: 'bold' }}>Description</Text>
                <Text style={{ flex: 1, fontSize: baseFontSize, fontWeight: 'bold', textAlign: 'right' }}>Total</Text>
              </View>
              {r.items.map((item: any, i: number) => (
                <View key={i} style={{ marginBottom: 6 * scale }}>
                  <Text style={{ fontSize: mediumFontSize, fontWeight: 'bold' }}>{item.desc}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 * scale }}>
                    <Text style={{ fontSize: baseFontSize, color: '#444' }}>{item.qty} x {formatAmount(item.price)}</Text>
                    <Text style={{ fontSize: mediumFontSize }}>{formatAmount(item.total)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderTopStyle: 'dashed', paddingTop: 8 * scale, gap: 3 * scale }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: mediumFontSize }}>Subtotal</Text>
                <Text style={{ fontSize: mediumFontSize }}>{formatAmount(r.subtotal)}</Text>
              </View>
              {r.discount > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: mediumFontSize }}>Discount</Text>
                  <Text style={{ fontSize: mediumFontSize }}>-{formatAmount(r.discount)}</Text>
                </View>
              )}
              {/* Tax hidden as per user request for tracking without display */}
              {/* r.tax > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: mediumFontSize }}>Tax</Text>
                  <Text style={{ fontSize: mediumFontSize }}>{formatAmount(r.tax)}</Text>
                </View>
              ) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 * scale, paddingTop: 4 * scale, borderTopWidth: 0.5, borderTopColor: '#eee' }}>
                <Text style={{ fontSize: largeFontSize, fontWeight: 'bold' }}>TOTAL</Text>
                <Text style={{ fontSize: largeFontSize, fontWeight: 'bold' }}>{currency} {formatAmount(r.totalAmount)}</Text>
              </View>
            </View>

            {/* Payment Info */}
            <View style={{ marginTop: 12 * scale, borderTopWidth: 1, borderTopColor: '#000', borderTopStyle: 'dashed', paddingTop: 8 * scale, gap: 3 * scale }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Method</Text>
                <Text style={{ fontSize: baseFontSize }}>{r.paymentMethod}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Cash Tendered</Text>
                <Text style={{ fontSize: baseFontSize }}>{formatAmount(r.amountTendered)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: baseFontSize, color: '#666' }}>Change Given</Text>
                <Text style={{ fontSize: baseFontSize, fontWeight: 'bold' }}>{formatAmount(r.changeGiven)}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={{ marginTop: 25 * scale, alignItems: 'center' }}>
              <Text style={{ textAlign: 'center', fontSize: mediumFontSize, fontWeight: 'bold' }}>Thank you for your business!</Text>
              <Text style={{ textAlign: 'center', fontSize: smallFontSize, marginTop: 8 * scale, color: '#999', textTransform: 'uppercase', letterSpacing: 1 * scale }}>Powered by Prime ERP</Text>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  if ((type === 'ACCOUNT_STATEMENT_SUMMARY' || type === 'ACCOUNT_STATEMENT') && 'finalBalance' in data) {
    return <StatementSummaryTemplate data={data as any} configOverride={config} />;
  }

  const isConverted = 'isConverted' in data && data.isConverted;
  const conversionDetails = isConverted && 'conversionDetails' in data ? (data as any).conversionDetails : null;
  const isFromOrder = conversionDetails?.sourceType === 'Order' || conversionDetails?.sourceType === 'JobOrder';
  const isFromQuotation = conversionDetails?.sourceType === 'Quotation';
  const isConvertedOrder = (type === 'INVOICE' || (type as string) === 'SALES_ORDER' || type === 'ORDER') && isConverted;

  let title: string;
  if (type === 'FISCAL_REPORT' && 'reportName' in data) {
    title = (data as any).reportName;
  } else if (type === 'INVOICE' || (isConvertedOrder && isFromOrder)) {
    title = 'Invoice';
  } else {
    switch (type as any) {
      case 'ORDER':
        title = 'Sales Invoice';
        break;
      case 'SALES_ORDER':
        title = 'Sales Order';
        break;
      case 'SUBSCRIPTION':
        title = 'Recurring Invoice';
        break;
      case 'QUOTATION':
        title = 'Quotation';
        break;
      case 'PO':
        title = 'Purchase Order';
        break;
      case 'EXAMINATION_INVOICE':
        title = 'Service Invoice';
        break;
      default:
        title = toTitleCase(type);
        break;
    }
  }

  return (
    <Document
      title={`${title} - ${'number' in data ? data.number : ('receiptNumber' in data ? data.receiptNumber : ('clientName' in data ? data.clientName : 'DOC'))}`}
      author={companyName}
      subject="ERP Generated Document"
      creator="Prime ERP System"
      keywords={`${type}, ERP, Business Document`}
    >
      <Page size="A4" style={[s.page, pageStyle]}>
        <View style={s.headerSection}>
          {isRightAligned ? (
            <>
              <View style={s.headerLeft}>
                <Text style={[s.title, titleStyle]}>{title}</Text>
                <View style={s.infoText}>
                  {type === 'INVOICE' ? (
                    <>
                      <Text>Invoice No. # {(('invoiceNumber' in data && (data as any).invoiceNumber) || ('number' in data ? (data as any).number : 'INV'))}</Text>
                      <Text>Invoice Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      {showDueDate && 'dueDate' in data && data.dueDate && <Text>Due Date: {data.dueDate}</Text>}
                      {isFromQuotation && <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>Order Ref: {conversionDetails?.sourceNumber || 'N/A'}</Text>}
                      {isFromOrder && <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>Original Order: {conversionDetails?.sourceNumber || 'N/A'}</Text>}
                    </>
                  ) : type === 'ORDER' ? (
                    <>
                      <Text>Invoice No. # INV-{('orderNumber' in data && (data as any).orderNumber) || ('number' in data ? (data as any).number : 'ORD')}</Text>
                      <Text>Invoice Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>Order Ref: {('orderNumber' in data && (data as any).orderNumber) || 'N/A'}</Text>
                      {showDueDate && 'dueDate' in data && data.dueDate && <Text>Due Date: {data.dueDate}</Text>}
                    </>
                  ) : (type as string) === 'SALES_ORDER' ? (
                    <>
                      <Text>Sales Order No. # {('orderNumber' in data && (data as any).orderNumber) || ('number' in data ? (data as any).number : 'SO')}</Text>
                      <Text>Sales Order Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      {showDueDate && 'dueDate' in data && data.dueDate && <Text>Due Date: {data.dueDate}</Text>}
                    </>
                  ) : type === 'EXAMINATION_INVOICE' ? (
                    <>
                      <Text>Service Invoice No. # {'number' in data ? (data as any).number : 'INV'}</Text>
                      <Text>Service Invoice Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      {showDueDate && 'dueDate' in data && data.dueDate && <Text>Due Date: {data.dueDate}</Text>}
                    </>
                  ) : type === 'SUBSCRIPTION' ? (
                    <>
                      <Text>Recurring Inv. No. # {'number' in data ? (data as any).number : 'SUB'}</Text>
                      <Text>Issue Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      {'billingPeriodStart' in data && 'billingPeriodEnd' in data && (data as any).billingPeriodStart && (
                        <Text style={{ marginTop: 2 }}>Period: {(data as any).billingPeriodStart} to {(data as any).billingPeriodEnd}</Text>
                      )}
                      {'frequency' in data && (
                        <Text>Frequency: {toTitleCase(String((data as any).frequency))}</Text>
                      )}
                      {'nextRunDate' in data && (data as any).nextRunDate && (
                        <Text style={{ marginTop: 2, fontWeight: 'bold' }}>Next Run: {(data as any).nextRunDate}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text>{toTitleCase(type)} No. # {'number' in data ? (data as any).number : ('receiptNumber' in data ? (data as any).receiptNumber : 'STATEMENT')}</Text>
                      <Text>{toTitleCase(type)} Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                      {type === 'QUOTATION' && showDueDate && 'dueDate' in data && data.dueDate && <Text>Valid Until: {data.dueDate}</Text>}
                    </>
                  )}
                </View>
              </View>
              <View style={s.headerRight}>
                {renderBrandMark('right')}
              </View>
            </>
          ) : (
            <>
              <View style={s.headerLeft}>
                {renderBrandMark('left')}
                <Text style={[s.title, titleStyle]}>{title}</Text>
                <View style={s.infoText}>
                  <Text>{toTitleCase(type)} No. # {'number' in data ? (data as any).number : ('receiptNumber' in data ? (data as any).receiptNumber : 'STATEMENT')}</Text>
                  <Text>{toTitleCase(type)} Date: {'date' in data ? (data as any).date : 'N/A'}</Text>
                </View>
              </View>
              <View style={s.headerRight}>
              </View>
            </>
          )}
        </View>

        {/* Logo (Optional, keep if needed or remove if strictly following snippet) */}
        {/* <View style={{ position: 'absolute', top: 40, right: 40, textAlign: 'right' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 13.5 }}>PRIME</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 13.5 }}>LOGO</Text>
        </View> */}

        {/* RECIPIENT SECTION */}
        {shouldRenderRecipientSection && (
          <View style={[s.billingSection, s.recipientSectionTight, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Text style={{ width: 80, fontWeight: 'bold' }}>{recipientLabel}</Text>
              <View style={s.recipientInfoText}>
                <Text style={s.recipientName}>{resolvedRecipientName || 'N/A'}</Text>
                <Text style={s.recipientDetail}>{resolvedRecipientAddress || 'N/A'}</Text>
                <Text style={s.recipientPhone}>{resolvedRecipientPhone || 'N/A'}</Text>
              </View>
            </View>

            {/* Conversion Details Box */}
            {/* Conversion / Acceptance Details Box */}
            {('isConverted' in data && data.isConverted) && (('conversionDetails' in data && data.conversionDetails) || type === 'QUOTATION') && (
              <View style={[s.conversionBox, { marginLeft: 20 }]}>
                <Text style={s.conversionTitle}>{type === 'QUOTATION' ? 'Acceptance Details' : 'Conversion History'}</Text>
                {type === 'QUOTATION' && 'date' in data ? (
                  <>
                    <Text>Accepted on {formatDateOnly((data as any).date)} by {resolvedRecipientName || 'N/A'}</Text>
                  </>
                ) : 'conversionDetails' in data && data.conversionDetails ? (
                  <>
                    <Text>
                      Converted from {resolveConversionSourceNumber(data as any)} on {formatDateOnly((data as any).conversionDetails.date)} as accepted by {(data as any).conversionDetails.acceptedBy || resolvedRecipientName || 'N/A'}
                    </Text>
                  </>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* PAID Stamp for fully paid invoices */}
        {('status' in data && data.status === 'Paid') && type !== 'INVOICE' && type !== 'ORDER' && (type as string) !== 'SALES_ORDER' && (
          <View style={s.paidStampContainer}>
            <View style={s.paidStampBox}>
              <Text style={s.paidStampText}>PAID</Text>
            </View>
          </View>
        )}

        {/* TABLE SECTION */}
        {type !== 'DELIVERY_NOTE' && type !== 'WORK_ORDER' && type !== 'ACCOUNT_STATEMENT' && type !== 'EXAMINATION_INVOICE' && (
          <>
            {/* Case: INVOICE / PO */}
            {isFinancial && (
              <View style={s.tableSectionTight}>
                {/* 1. Restored Table Header with 2px border */}
                <View style={s.tableHeader}>
                  <Text style={s.colDesc}>Item Description</Text>
                  <Text style={s.colQty}>Qty</Text>
                  <Text style={s.colPrice}>Price</Text>
                  <Text style={s.colTotal}>Total</Text>
                </View>

                {/* 2. Item Rows with consistent 13px spacing */}
                {/* For Invoice, Order, Quotation: Service items show simplified format */}
                {/* For POS: All items show standard format */}
                {('items' in data ? (data as any).items : []).map((item: any, i: number) => {
                  // Check if this is a service-type item (category, type, or isService flag)
                  const isService = item.category === 'service' ||
                                   item.type === 'service' ||
                                   item.isService === true;
                  
                  // Check if current document type should use simplified service format
                  const useSimplifiedFormat = isService &&
                    (type === 'INVOICE' || type === 'ORDER' || (type as string) === 'SALES_ORDER' || type === 'QUOTATION');
                  
                  // Format description based on item type and document type
                  let formattedDesc = item.desc;
                  if (useSimplifiedFormat) {
                    const totalPages = item.totalPages || item.pages || 0;
                    const copies = item.copies || item.qty || 1;
                    const itemName = item.name || item.desc || 'Service';
                    formattedDesc = `${itemName} (${totalPages} pages × ${copies} copies)`;
                  }
                  
                  return (
                    <View key={i} style={s.row}>
                      <Text style={s.colDesc}>{formattedDesc}</Text>
                      <Text style={s.colQty}>×{item.qty}</Text>
                      <Text style={s.colPrice}>{currency} {formatAmount(item.price)}</Text>
                      <Text style={s.colTotal}>{currency} {formatAmount(item.total)}</Text>
                    </View>
                  );
                })}

                {/* 3. The Masterpiece Summary Box (Restoring Source 1 Layout) */}
                <View
                  style={[
                    s.summaryContainer,
                    type === 'QUOTATION' ? { justifyContent: 'flex-end' } : null
                  ]}
                >
                  {/* Left Side: Invoice Status for INVOICE/ORDER types */}
                  {(type === 'INVOICE' || type === 'ORDER' || (type as string) === 'SALES_ORDER' || type === 'SUBSCRIPTION') && 'status' in data && data.status && (
                    <View style={s.summaryLeft}>
                      {/* INVOICE STATUS TITLE REMOVED */}
                      <View style={[s.statusBox, { borderLeftColor: getStatusTone(data.status).border }]}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: getStatusTone(data.status).text }}>{data.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Right Side: Summary Values */}
                  <View style={s.summaryRight}>
                    <View style={s.summaryBox}>
                      <View style={s.summaryRow}>
                        <Text style={{ fontWeight: 'bold' }}>{type === 'QUOTATION' ? 'Quoted Amount' : 'Subtotal'}</Text>
                        <Text>{currency} {formatAmount('subtotal' in data ? data.subtotal : 0)}</Text>
                      </View>

                      {/* Total before payments - Hidden on Invoices, Orders, and Quotations */}
                      {type !== 'INVOICE' && type !== 'ORDER' && type !== 'QUOTATION' && type !== 'SUBSCRIPTION' && (
                        <View style={s.summaryRow}>
                          <Text style={{ fontWeight: 'bold' }}>Total Amount</Text>
                          <Text>{currency} {formatAmount('totalAmount' in data ? data.totalAmount : 0)}</Text>
                        </View>
                      )}

                      {/* Amount Paid - Hidden on Quotations */}
                      {type !== 'QUOTATION' && type !== 'SUBSCRIPTION' && (
                        <View style={s.summaryRow}>
                          <Text style={{ fontWeight: 'bold' }}>Amount Paid</Text>
                          <Text>{currency} {formatAmount('amountPaid' in data ? data.amountPaid : 0)}</Text>
                        </View>
                      )}

                      {type === 'INVOICE' && showInvoiceBalances && (
                        <View style={s.summaryRow}>
                          <Text style={{ fontWeight: 'bold' }}>Wallet Balance</Text>
                          <Text>{currency} {formatAmount(resolvedWalletBalance)}</Text>
                        </View>
                      )}

                      {/* Balance Due - Grand Highlight - Hidden on Quotations */}
                      {type !== 'QUOTATION' && type !== 'SUBSCRIPTION' && (
                        <View style={s.totalRow}>
                          <Text>{type === 'INVOICE' && showInvoiceBalances ? 'Outstanding Balance' : 'Balance Due'}</Text>
                          <Text>{currency} {formatAmount(type === 'INVOICE' && showInvoiceBalances ? resolvedOutstandingBalance : (('totalAmount' in data ? data.totalAmount : 0) - ('amountPaid' in data ? data.amountPaid : 0)))}</Text>
                        </View>
                      )}

                      {/* Subscription Totals */}
                      {type === 'SUBSCRIPTION' && (
                        <View style={s.totalRow}>
                          <Text>Recurring Total</Text>
                          <Text>{currency} {formatAmount('totalAmount' in data ? data.totalAmount : 0)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Thank You Note */}
                <View style={{ marginTop: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: scaledFont(11), color: '#334155' }}>
                    Thank you for choosing <Text style={{ fontWeight: 'bold' }}>{companyName}</Text>
                  </Text>
                </View>

                {/* Quotation Note */}
                {type === 'QUOTATION' && (
                  <View style={{ marginTop: 15, padding: 8, backgroundColor: '#f0f9ff', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#0ea5e9' }}>
                    <Text style={{ fontSize: scaledFont(9), color: '#0369a1', lineHeight: 1.4 }}>
                      Note: Acceptance of this quotation converts it into a formal Sales Order subject to our standard terms and conditions.
                    </Text>
                  </View>
                )}

                {showPaymentTerms && paymentTermsLabel && (
                  <View
                    wrap={false}
                    style={{
                      marginTop: 14,
                      padding: 10,
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      borderLeftWidth: 3,
                      borderLeftColor: templateSettings.accentColor,
                    }}
                  >
                    <Text style={{ fontSize: scaledFont(9), fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                      Payment Terms
                    </Text>
                    <Text style={{ fontSize: scaledFont(10), color: '#334155', marginTop: 4, lineHeight: 1.45 }}>
                      {paymentTermsLabel}
                      {showDueDate && dataAny?.dueDate ? ` | Due by ${formatDateOnly(dataAny.dueDate)}` : ''}
                    </Text>
                  </View>
                )}

                {/* Tax Note - Only show if VAT is NOT enabled */}
                {(!config?.vat?.enabled) && (
                  <View style={{ marginTop: 20, paddingTop: 10 }}>
                    <Text style={{ fontSize: scaledFont(9), color: '#64748b', fontStyle: 'italic' }}>* Not VAT registered</Text>
                  </View>
                )}
              </View>
            )}

            {/* Non-financial cases (original logic) */}
            {!isFinancial && (
              <>
                <View style={s.tableHeader}>
                  <Text style={s.colDesc}>Description / Instructions</Text>
                  <Text style={s.colQty}>Qty</Text>
                </View>

                {('items' in data ? data.items : []).map((item, i) => (
                  <View key={i} style={s.row}>
                    <Text style={s.colDesc}>{item.desc}</Text>
                    <Text style={s.colQty}>{item.qty}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* WORK_ORDER Case */}
        {type === 'WORK_ORDER' && (
          <View style={{ marginTop: 20 }}>
            {/* Job Header Info */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: (data as any).priority === 'Critical' ? '#e11d48' : (data as any).priority === 'High' ? '#f59e0b' : '#3b82f6' }}>
              <View>
                <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Priority Level</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: (data as any).priority === 'Critical' ? '#e11d48' : '#0f172a' }}>{(data as any).priority || 'Normal'}</Text>
              </View>
              {('technician' in data) && data.technician && (
                <View style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Technician</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{data.technician}</Text>
                </View>
              )}
            </View>

            {/* Technical Specifications Grid */}
            {('technicalSpecs' in data) && data.technicalSpecs && Object.keys(data.technicalSpecs).length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Technical Specifications</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {Object.entries(data.technicalSpecs).map(([key, value], i) => (
                    <View key={i} style={{ width: '30%', padding: 8, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e2e8f0', borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{key}</Text>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b' }}>{value as any}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Production Instructions */}
            <View style={{ backgroundColor: '#f1f5f9', padding: 12, marginBottom: 20, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5, color: '#475569', textTransform: 'uppercase' }}>Manufacturing Instructions:</Text>
              <Text style={{ fontSize: 11, color: '#334155', lineHeight: 1.4 }}>{('instructions' in data ? data.instructions : null) || "Standard operating procedure required. Ensure quality check before release."}</Text>
            </View>

            {/* Materials Checklist */}
            {('materialChecklist' in data) && data.materialChecklist && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Materials Checklist</Text>
                <View style={{ borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                  {data.materialChecklist.map((m, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#f1f5f9' }}>
                      <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 10, borderRadius: 2 }} />
                      <Text style={{ fontSize: 10, color: '#334155' }}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Service Tasks */}
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Production Checklist</Text>
            <View style={s.tableHeader}>
              <Text style={s.colDesc}>Service / Process Details</Text>
              <Text style={s.colQty}>Completion</Text>
            </View>

            {('items' in data ? data.items : []).map((item, i) => (
              <View key={i} style={s.row}>
                <Text style={s.colDesc}>{item.desc}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: '#000', marginRight: 5 }} />
                  <Text style={{ fontSize: 9 }}>Initial</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* DELIVERY_NOTE Case */}
        {type === 'DELIVERY_NOTE' && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>
              DELIVERY ITEMS CHECKLIST
            </Text>
            <View style={s.tableHeader}>
              <Text style={s.colDesc}>Item Description</Text>
              <Text style={s.colQty}>Qty Shipped</Text>
            </View>

            {('items' in data ? data.items : []).map((item, i) => (
              <View key={i} style={s.row}>
                <Text style={s.colDesc}>{item.desc}</Text>
                <Text style={s.colQty}>{item.qty}</Text>
              </View>
            ))}

            {/* Receiver's Remarks Box */}
            <View style={s.remarksBox}>
              <Text style={s.remarksTitle}>Receiver's Remarks</Text>
              <Text style={{ fontSize: 9, color: '#666' }}>
                {'notes' in data && (data as any).notes
                  ? (data as any).notes
                  : 'proofOfDelivery' in data && (data as any).proofOfDelivery?.remarks
                    ? (data as any).proofOfDelivery.remarks
                    : 'proofOfDelivery' in data && (data as any).proofOfDelivery?.notes
                      ? (data as any).proofOfDelivery.notes
                      : 'Please note any discrepancies or comments regarding the delivery here...'}
              </Text>
            </View>
          </View>
        )}



        {/* Case: ACCOUNT_STATEMENT */}
        {type === 'ACCOUNT_STATEMENT' && 'transactions' in data && (
          <View style={{ marginTop: 20 }}>
            {/* Period Summary */}
            <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f8fafc', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#64748b' }}>Statement Period:</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{data.startDate} — {data.endDate}</Text>
            </View>

            {/* Ledger Table */}
            <View style={s.tableHeader}>
              <Text style={{ flex: 1.5 }}>Date</Text>
              <Text style={{ flex: 2 }}>Reference</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>Debit ({currency})</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>Credit ({currency})</Text>
              <Text style={{ flex: 1.5, textAlign: 'right' }}>Balance ({currency})</Text>
            </View>

            {data.transactions.map((txn, i) => (
              <View key={i} style={s.row}>
                <Text style={{ flex: 1.5 }}>{txn.date}</Text>
                <Text style={{ flex: 2 }}>{txn.reference}</Text>
                <Text style={{ flex: 1, textAlign: 'right' }}>{txn.debit > 0 ? formatAmount(txn.debit) : '-'}</Text>
                <Text style={{ flex: 1, textAlign: 'right' }}>{txn.credit > 0 ? formatAmount(txn.credit) : '-'}</Text>
                <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(txn.runningBalance)}</Text>
              </View>
            ))}

            {/* Summary Totals */}
            <View style={{ marginTop: 30, borderTopWidth: 2, borderColor: '#000', paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text>Total Debits:</Text>
                <Text>{currency} {formatAmount('totalInvoiced' in data ? (data as any).totalInvoiced : 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text>Total Credits:</Text>
                <Text>{currency} {formatAmount('totalReceived' in data ? (data as any).totalReceived : 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, padding: 8, backgroundColor: '#000', color: '#fff' }}>
                <Text style={{ fontWeight: 'bold' }}>TOTAL OUTSTANDING:</Text>
                <Text style={{ fontWeight: 'bold' }}>{currency} {formatAmount(data.finalBalance)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Case: FISCAL_REPORT */}
        {type === 'FISCAL_REPORT' && 'sections' in data && (
          <View style={{ marginTop: 20 }}>
            {/* Period Summary */}
            <View style={{ marginBottom: 20, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#2563eb' }}>
              <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Report Period</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>{data.period}</Text>
            </View>

            {data.sections.map((section, idx) => (
              <View key={idx} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
                  {section.title}
                </Text>
                {section.rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                    paddingHorizontal: 4,
                    backgroundColor: row.isTotal ? '#f1f5f9' : 'transparent',
                    borderTopWidth: row.isTotal ? 1 : 0,
                    borderColor: '#cbd5e1'
                  }}>
                    <View style={{ marginLeft: row.indent ? 15 : 0 }}>
                      <Text style={{ fontSize: row.isTotal ? 10 : 9, fontWeight: row.isTotal ? 'bold' : 'normal' }}>{row.label}</Text>
                      {row.subText && <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>{row.subText}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 20 }}>
                      {row.prevAmount !== undefined && (
                        <Text style={{ fontSize: 8, color: '#94a3b8', width: 60, textAlign: 'right' }}>
                          {data.currency}{formatAmount(row.prevAmount)}
                        </Text>
                      )}
                      <Text style={{ fontSize: row.isTotal ? 10 : 9, fontWeight: row.isTotal ? 'bold' : 'normal', width: 80, textAlign: 'right' }}>
                        {data.currency}{formatAmount(row.amount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {data.netPerformance && (
              <View style={{ marginTop: 20, padding: 12, backgroundColor: '#0f172a', borderRadius: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{data.netPerformance.label}</Text>
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    {data.netPerformance.prevAmount !== undefined && (
                      <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', width: 60 }}>
                        {data.currency}{formatAmount(data.netPerformance.prevAmount)}
                      </Text>
                    )}
                    <Text style={{ color: data.netPerformance.amount >= 0 ? '#4ade80' : '#f87171', fontSize: 14, fontWeight: 'bold', textAlign: 'right', width: 80 }}>
                      {data.currency}{formatAmount(data.netPerformance.amount)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
        
        {/* Case: EXAMINATION_INVOICE */}
        {type === 'EXAMINATION_INVOICE' && (
          <View style={{ marginTop: 20 }}>
            {/* PAID Stamp for fully paid examination invoices */}
            {'status' in data && data.status === 'Paid' && (
              <View style={s.paidStampContainer} fixed>
                <View style={s.paidStampBox}>
                  <Text style={s.paidStampText}>PAID</Text>
                </View>
              </View>
            )}

            <View style={s.tableHeader}>
              <Text style={{ flex: 3 }}>Class / Subject</Text>
              <Text style={{ flex: 1, textAlign: 'center' }}>Qty</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>Price</Text>
              <Text style={{ flex: 1.5, textAlign: 'right' }}>Total</Text>
            </View>

            {('items' in data ? (data as any).items : []).map((item: any, i: number) => (
              <View key={i} style={s.row}>
                <View style={{ flex: 3 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{item.desc}</Text>
                </View>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{item.qty}</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 12 }}>{formatAmount(item.price)}</Text>
                <Text style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', fontSize: 12 }}>{formatAmount(item.total)}</Text>
              </View>
            ))}

            <View style={s.summaryContainer}>
              {'status' in data && data.status && (
                <View style={s.summaryLeft}>
                  {/* INVOICE STATUS TITLE REMOVED */}
                  <View style={[s.statusBox, { borderLeftColor: getStatusTone(data.status).border }]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: getStatusTone(data.status).text }}>
                      {data.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              <View style={s.summaryRight}>
                <View style={s.summaryBox}>
                  <View style={s.summaryRow}>
                    <Text style={{ fontWeight: 'bold' }}>Grand Total</Text>
                    <Text>{currency} {formatAmount('totalAmount' in data ? (data as any).totalAmount : 0)}</Text>
                  </View>
                  <View style={s.summaryRow}>
                    <Text style={{ fontWeight: 'bold' }}>Amount Paid</Text>
                    <Text>{currency} {formatAmount('amountPaid' in data ? (data as any).amountPaid : 0)}</Text>
                  </View>
                  <View style={s.totalRow}>
                    <Text>Balance Due</Text>
                    <Text>
                      {currency} {formatAmount(('totalAmount' in data ? (data as any).totalAmount : 0) - ('amountPaid' in data ? (data as any).amountPaid : 0))}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 15, alignItems: 'center' }}>
              <Text style={{ fontSize: scaledFont(11), color: '#334155' }}>
                Thank you for choosing <Text style={{ fontWeight: 'bold' }}>{companyName}</Text>
              </Text>
            </View>

            {showPaymentTerms && paymentTermsLabel && (
              <View
                wrap={false}
                style={{
                  marginTop: 14,
                  padding: 10,
                  backgroundColor: '#f8fafc',
                  borderRadius: 6,
                  borderLeftWidth: 3,
                  borderLeftColor: templateSettings.accentColor,
                }}
              >
                <Text style={{ fontSize: scaledFont(9), fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                  Payment Terms
                </Text>
                <Text style={{ fontSize: scaledFont(10), color: '#334155', marginTop: 4, lineHeight: 1.45 }}>
                  {paymentTermsLabel}
                  {showDueDate && dataAny?.dueDate ? ` | Due by ${formatDateOnly(dataAny.dueDate)}` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* DYNAMIC FOOTER (Signatures for Delivery/Work Orders) */}
        {!isFinancial && type !== 'DELIVERY_NOTE' && type !== 'EXAMINATION_INVOICE' && (
          <View style={s.signatureBlock}>
            <View>
              <View style={s.sigLine} />
              <Text>Issued By (Prime)</Text>
            </View>
            <View>
              <View style={s.sigLine} />
              <Text>Received By (Client)</Text>
            </View>
          </View>
        )}

        {/* Delivery Signature Block */}
        {type === 'DELIVERY_NOTE' && (
          <View style={[s.signatureBlock, { marginTop: 40 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5 }}>Logistics Details</Text>
              <Text style={{ fontSize: 9, marginBottom: 3 }}>Driver Name: {('driverName' in data ? data.driverName : '____________________')}</Text>
              <Text style={{ fontSize: 9 }}>Vehicle No: {('vehicleNo' in data ? data.vehicleNo : '____________________')}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {('signatureDataUrl' in data && (data as any).signatureDataUrl) || ('proofOfDelivery' in data && (data as any).proofOfDelivery?.signatureDataUrl) ? (
                <Image src={('signatureDataUrl' in data && (data as any).signatureDataUrl) || ((data as any).proofOfDelivery?.signatureDataUrl)} style={{ height: 40, width: 100, marginBottom: 5 }} />
              ) : (
                <View style={{ height: 45 }} />
              )}
              <View style={[s.sigLine, { width: 180 }]} />
              <Text style={{ fontSize: 9 }}>Received By: {('receivedBy' in data && (data as any).receivedBy) || ('proofOfDelivery' in data && (data as any).proofOfDelivery?.receivedBy) || ('conversionDetails' in data && data.conversionDetails?.acceptedBy) || '____________________'}</Text>
              <Text style={{ fontSize: 7, color: '#666' }}>Stamp & Signature</Text>
              {('conversionDetails' in data && data.conversionDetails?.locationStamp) ? (
                <Text style={{ fontSize: 7, color: '#666', marginTop: 5 }}>
                  GPS: {data.conversionDetails.locationStamp.lat.toFixed(4)}, {data.conversionDetails.locationStamp.lng.toFixed(4)}
                </Text>
              ) : ('proofOfDelivery' in data && (data as any).proofOfDelivery?.locationStamp) ? (
                <Text style={{ fontSize: 7, color: '#666', marginTop: 5 }}>
                  GPS: {(data as any).proofOfDelivery.locationStamp.lat.toFixed(4)}, {(data as any).proofOfDelivery.locationStamp.lng.toFixed(4)}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Standard Receipt Signature */}


        {/* DYNAMIC CENTERED FOOTER (Movable) */}
        <View style={s.footerContainer} wrap={false}>
          <View style={s.footerLine} />
        </View>

        {/* STATIC LEGAL FOOTER (Fixed at the bottom of every page) */}
        <SecurityFooter
          data={dataAny}
          companyName={companyName}
          legalFooterLine1={legalFooterLine1}
          legalFooterLine2={legalFooterLine2}
          fontScale={fontScale}
        />
      </Page>
    </Document>
  );
};
