import { attachPricingBreakdown } from '../utils/pricingBreakdown';

export type RevenueSource = 'POS' | 'ORDER_FORM' | 'EXAMINATION';

export interface RevenueAdjustmentLedgerRow {
  source: RevenueSource;
  adjustmentName: string;
  totalAmount: number;
  applicationCount: number;
  transactionCount: number;
}

export interface RevenueItemPerformanceRow {
  source: RevenueSource;
  itemName: string;
  quantity: number;
  revenue: number;
  materialCost: number;
  adjustmentTotal: number;
  profitMargin: number;
  roundingTotal: number;
  grossGain: number;
}

export interface RevenueAnalysisLine {
  lineId: string;
  source: RevenueSource;
  transactionId: string;
  transactionNumber: string;
  transactionType: string;
  date: string;
  status: string;
  customerName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  revenue: number;
  materialCost: number;
  adjustmentTotal: number;
  profitMargin: number;
  roundingTotal: number;
  grossGain: number;
  reconciliationDelta: number;
  adjustmentLines: Array<{ name: string; amount: number }>;
}

export interface RevenueAnalysisTransaction {
  key: string;
  source: RevenueSource;
  transactionId: string;
  transactionNumber: string;
  transactionType: string;
  date: string;
  status: string;
  customerName: string;
  lineCount: number;
  quantity: number;
  revenue: number;
  materialCost: number;
  adjustmentTotal: number;
  profitMargin: number;
  roundingTotal: number;
  grossGain: number;
  reconciliationDelta: number;
}

export interface RevenueSourceSummary {
  source: RevenueSource | 'ALL';
  transactionCount: number;
  lineCount: number;
  quantity: number;
  revenue: number;
  materialCost: number;
  adjustmentTotal: number;
  profitMargin: number;
  roundingTotal: number;
  grossGain: number;
  reconciliationDelta: number;
}

export interface RevenueAnalysisDataset {
  lines: RevenueAnalysisLine[];
  transactions: RevenueAnalysisTransaction[];
  sourceSummaries: RevenueSourceSummary[];
  adjustmentLedger: RevenueAdjustmentLedgerRow[];
  itemPerformance: RevenueItemPerformanceRow[];
}

const roundMoney = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toQuantity = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const toDateKey = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : raw;
};

const sourceLabel = (source: RevenueSource | 'ALL') => {
  if (source === 'POS') return 'POS';
  if (source === 'ORDER_FORM') return 'Order Form';
  if (source === 'EXAMINATION') return 'Examination';
  return 'All Modules';
};

const getTransactionNumber = (transaction: any) => {
  return String(
    transaction?.invoiceNumber
    || transaction?.orderNumber
    || transaction?.saleNumber
    || transaction?.id
    || 'UNKNOWN'
  );
};

const isRecognizedSale = (sale: any) => {
  const status = String(sale?.status || '').toLowerCase();
  return status === 'paid' || status === 'completed' || status === 'partial';
};

export const isExaminationInvoice = (invoice: any) => {
  const origin = String(invoice?.originModule || invoice?.origin_module || '').trim().toLowerCase();
  const documentTitle = String(invoice?.documentTitle || invoice?.document_title || '').trim().toLowerCase();
  const reference = String(invoice?.reference || '').trim().toUpperCase();
  const batchId = String(
    invoice?.batchId
    || invoice?.originBatchId
    || invoice?.origin_batch_id
    || ''
  ).trim();

  return origin === 'examination'
    || documentTitle.includes('examination invoice')
    || reference.startsWith('EXM-BATCH-')
    || batchId.length > 0;
};

const extractOrderReferenceKeys = (invoice: any): string[] => {
  const keys = new Set<string>();
  const conversionSourceType = String(invoice?.conversionDetails?.sourceType || '').trim().toLowerCase();
  const conversionSourceNumber = String(invoice?.conversionDetails?.sourceNumber || '').trim();

  if (conversionSourceType === 'order' && conversionSourceNumber) {
    keys.add(conversionSourceNumber.toLowerCase());
  }

  const notes = String(invoice?.notes || '');
  const match = notes.match(/Converted from \[Order\] #\[(.*?)\]/i);
  if (match?.[1]) {
    keys.add(String(match[1]).trim().toLowerCase());
  }

  return Array.from(keys);
};

const buildAdjustmentLines = (
  snapshots: any[] = [],
  quantity: number,
  targetTotal: number
): Array<{ name: string; amount: number }> => {
  const baseLines = (Array.isArray(snapshots) ? snapshots : [])
    .map((snapshot: any) => ({
      name: String(snapshot?.name || snapshot?.adjustmentName || 'Adjustment'),
      amount: roundMoney(toNumber(snapshot?.calculatedAmount ?? snapshot?.amount, 0) * quantity)
    }))
    .filter((line) => Math.abs(line.amount) > 0.0001);

  const baseTotal = roundMoney(baseLines.reduce((sum, line) => sum + line.amount, 0));
  const safeTarget = roundMoney(targetTotal);

  if (baseLines.length === 0 && Math.abs(safeTarget) > 0.0001) {
    return [{ name: 'Adjustment', amount: safeTarget }];
  }

  if (Math.abs(baseTotal - safeTarget) <= 0.01 || Math.abs(baseTotal) <= 0.0001) {
    return baseLines;
  }

  let running = 0;
  return baseLines.map((line, index) => {
    const scaled = index === baseLines.length - 1
      ? roundMoney(safeTarget - running)
      : roundMoney((line.amount / baseTotal) * safeTarget);
    running = roundMoney(running + scaled);
    return {
      name: line.name,
      amount: scaled
    };
  });
};

const createNormalizedLine = ({
  source,
  transaction,
  transactionType,
  item,
  index
}: {
  source: RevenueSource;
  transaction: any;
  transactionType: string;
  item: any;
  index: number;
}): RevenueAnalysisLine => {
  const normalizedItem = attachPricingBreakdown(item);
  const breakdown = normalizedItem.pricingBreakdown;
  const quantity = toQuantity(normalizedItem?.quantity);
  const directRevenue = normalizedItem?.subtotal ?? normalizedItem?.total;
  const unitRevenue = breakdown?.sellingPrice ?? toNumber(normalizedItem?.price ?? normalizedItem?.unitPrice, 0);
  const revenue = roundMoney(
    directRevenue !== undefined
      ? toNumber(directRevenue, unitRevenue * quantity)
      : unitRevenue * quantity
  );
  const materialCost = roundMoney(
    (breakdown?.baseMaterialCost ?? toNumber(normalizedItem?.cost_price ?? normalizedItem?.cost, 0)) * quantity
  );
  const adjustmentTotal = roundMoney(
    (breakdown?.adjustmentTotal ?? toNumber(normalizedItem?.adjustmentTotal, 0)) * quantity
  );
  const roundingTotal = roundMoney(
    (breakdown?.roundingDifference ?? toNumber(normalizedItem?.roundingDifference ?? normalizedItem?.rounding_difference, 0)) * quantity
  );
  const explicitMargin = toNumber(
    breakdown?.profitMarginAmount ?? normalizedItem?.profitMarginAmount,
    Number.NaN
  );
  const profitMargin = roundMoney(
    Number.isFinite(explicitMargin)
      ? explicitMargin * quantity
      : revenue - materialCost - adjustmentTotal - roundingTotal
  );
  const reconciliationDelta = roundMoney(
    revenue - materialCost - adjustmentTotal - profitMargin - roundingTotal
  );

  return {
    lineId: `${source}:${transaction?.id || 'TX'}:${normalizedItem?.id || normalizedItem?.itemId || index}:${index}`,
    source,
    transactionId: String(transaction?.id || ''),
    transactionNumber: getTransactionNumber(transaction),
    transactionType,
    date: toDateKey(transaction?.date || transaction?.orderDate || transaction?.createdAt),
    status: String(transaction?.status || ''),
    customerName: String(transaction?.customerName || 'Walk-in'),
    itemId: String(normalizedItem?.itemId || normalizedItem?.productId || normalizedItem?.id || `ITEM-${index + 1}`),
    itemName: String(
      normalizedItem?.productName
      || normalizedItem?.name
      || normalizedItem?.description
      || `Line ${index + 1}`
    ),
    quantity,
    revenue,
    materialCost,
    adjustmentTotal,
    profitMargin,
    roundingTotal,
    grossGain: roundMoney(revenue - materialCost),
    reconciliationDelta,
    adjustmentLines: buildAdjustmentLines(normalizedItem?.adjustmentSnapshots || [], quantity, adjustmentTotal)
  };
};

const normalizeGenericTransaction = (
  transaction: any,
  source: RevenueSource,
  transactionType: string
): RevenueAnalysisLine[] => {
  const items = Array.isArray(transaction?.items) ? transaction.items : [];
  return items.map((item: any, index: number) =>
    createNormalizedLine({
      source,
      transaction,
      transactionType,
      item,
      index
    })
  );
};

const buildExaminationLines = (invoice: any, batch: any): RevenueAnalysisLine[] => {
  const classes = Array.isArray(batch?.classes) ? batch.classes : [];
  if (classes.length === 0) {
    return normalizeGenericTransaction(invoice, 'EXAMINATION', 'Examination Invoice');
  }

  const totalRevenue = roundMoney(
    classes.reduce((sum: number, cls: any) => {
      const learners = Math.max(0, Math.floor(toNumber(cls?.number_of_learners, 0)));
      const classRevenue = toNumber(
        cls?.live_total_preview,
        toNumber(cls?.final_fee_per_learner ?? cls?.price_per_learner, 0) * learners
      );
      return sum + classRevenue;
    }, 0)
  );
  const totalAdjustment = roundMoney(
    classes.reduce((sum: number, cls: any) => sum + toNumber(cls?.adjustment_total_cost, 0), 0)
  );
  const batchRounding = roundMoney(
    invoice?.roundingDifference
    ?? invoice?.roundingTotal
    ?? batch?.rounding_adjustment_total
    ?? 0
  );
  const rawSnapshots = Array.isArray(invoice?.adjustmentSnapshots)
    ? invoice.adjustmentSnapshots
    : (Array.isArray(batch?.adjustmentSnapshots) ? batch.adjustmentSnapshots : []);

  let allocatedRounding = 0;

  return classes.map((cls: any, index: number) => {
    const learners = Math.max(1, Math.floor(toNumber(cls?.number_of_learners, 1)));
    const revenue = roundMoney(
      toNumber(
        cls?.live_total_preview,
        toNumber(cls?.final_fee_per_learner ?? cls?.price_per_learner, 0) * learners
      )
    );
    const materialCost = roundMoney(toNumber(cls?.material_total_cost, 0));
    const adjustmentTotal = roundMoney(toNumber(cls?.adjustment_total_cost, 0));
    const allocationBase = totalRevenue > 0 ? revenue / totalRevenue : (1 / classes.length);
    const roundingTotal = index === classes.length - 1
      ? roundMoney(batchRounding - allocatedRounding)
      : roundMoney(batchRounding * allocationBase);
    allocatedRounding = roundMoney(allocatedRounding + roundingTotal);
    const profitMargin = roundMoney(revenue - materialCost - adjustmentTotal - roundingTotal);

    const adjustmentRatio = totalAdjustment > 0
      ? adjustmentTotal / totalAdjustment
      : allocationBase;

    const scaledSnapshots = rawSnapshots.map((snapshot: any) => ({
      ...snapshot,
      calculatedAmount: roundMoney(toNumber(snapshot?.calculatedAmount ?? snapshot?.amount ?? snapshot?.value, 0) * adjustmentRatio)
    }));

    return {
      lineId: `EXAMINATION:${invoice?.id || batch?.id || 'BATCH'}:${cls?.id || index}:${index}`,
      source: 'EXAMINATION' as RevenueSource,
      transactionId: String(invoice?.id || batch?.id || ''),
      transactionNumber: getTransactionNumber(invoice),
      transactionType: 'Examination Invoice',
      date: toDateKey(invoice?.date || batch?.updated_at || batch?.created_at),
      status: String(invoice?.status || batch?.status || ''),
      customerName: String(invoice?.customerName || batch?.school_name || batch?.schoolName || 'School'),
      itemId: String(cls?.id || `EXAM-CLASS-${index + 1}`),
      itemName: String(cls?.class_name || `Class ${index + 1}`),
      quantity: learners,
      revenue,
      materialCost,
      adjustmentTotal,
      profitMargin,
      roundingTotal,
      grossGain: roundMoney(revenue - materialCost),
      reconciliationDelta: roundMoney(revenue - materialCost - adjustmentTotal - profitMargin - roundingTotal),
      adjustmentLines: buildAdjustmentLines(scaledSnapshots, 1, adjustmentTotal)
    };
  });
};

const aggregateTransactions = (lines: RevenueAnalysisLine[]): RevenueAnalysisTransaction[] => {
  const map = new Map<string, RevenueAnalysisTransaction>();

  lines.forEach((line) => {
    const key = `${line.source}:${line.transactionId}`;
    const existing = map.get(key);
    if (existing) {
      existing.lineCount += 1;
      existing.quantity = roundMoney(existing.quantity + line.quantity);
      existing.revenue = roundMoney(existing.revenue + line.revenue);
      existing.materialCost = roundMoney(existing.materialCost + line.materialCost);
      existing.adjustmentTotal = roundMoney(existing.adjustmentTotal + line.adjustmentTotal);
      existing.profitMargin = roundMoney(existing.profitMargin + line.profitMargin);
      existing.roundingTotal = roundMoney(existing.roundingTotal + line.roundingTotal);
      existing.grossGain = roundMoney(existing.grossGain + line.grossGain);
      existing.reconciliationDelta = roundMoney(existing.reconciliationDelta + line.reconciliationDelta);
      return;
    }

    map.set(key, {
      key,
      source: line.source,
      transactionId: line.transactionId,
      transactionNumber: line.transactionNumber,
      transactionType: line.transactionType,
      date: line.date,
      status: line.status,
      customerName: line.customerName,
      lineCount: 1,
      quantity: line.quantity,
      revenue: line.revenue,
      materialCost: line.materialCost,
      adjustmentTotal: line.adjustmentTotal,
      profitMargin: line.profitMargin,
      roundingTotal: line.roundingTotal,
      grossGain: line.grossGain,
      reconciliationDelta: line.reconciliationDelta
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

const buildSourceSummaries = (lines: RevenueAnalysisLine[]): RevenueSourceSummary[] => {
  const transactions = aggregateTransactions(lines);
  const sources: Array<RevenueSource | 'ALL'> = ['ALL', 'POS', 'ORDER_FORM', 'EXAMINATION'];

  return sources.map((source) => {
    const scopedLines = source === 'ALL'
      ? lines
      : lines.filter((line) => line.source === source);
    const scopedTransactions = source === 'ALL'
      ? transactions
      : transactions.filter((transaction) => transaction.source === source);

    return {
      source,
      transactionCount: scopedTransactions.length,
      lineCount: scopedLines.length,
      quantity: roundMoney(scopedLines.reduce((sum, line) => sum + line.quantity, 0)),
      revenue: roundMoney(scopedLines.reduce((sum, line) => sum + line.revenue, 0)),
      materialCost: roundMoney(scopedLines.reduce((sum, line) => sum + line.materialCost, 0)),
      adjustmentTotal: roundMoney(scopedLines.reduce((sum, line) => sum + line.adjustmentTotal, 0)),
      profitMargin: roundMoney(scopedLines.reduce((sum, line) => sum + line.profitMargin, 0)),
      roundingTotal: roundMoney(scopedLines.reduce((sum, line) => sum + line.roundingTotal, 0)),
      grossGain: roundMoney(scopedLines.reduce((sum, line) => sum + line.grossGain, 0)),
      reconciliationDelta: roundMoney(scopedLines.reduce((sum, line) => sum + line.reconciliationDelta, 0))
    };
  });
};

const buildAdjustmentLedger = (lines: RevenueAnalysisLine[]): RevenueAdjustmentLedgerRow[] => {
  const map = new Map<string, RevenueAdjustmentLedgerRow & { transactions: Set<string> }>();

  lines.forEach((line) => {
    line.adjustmentLines.forEach((adjustment) => {
      const key = `${line.source}:${adjustment.name}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalAmount = roundMoney(existing.totalAmount + adjustment.amount);
        existing.applicationCount += 1;
        existing.transactions.add(line.transactionId);
        return;
      }

      map.set(key, {
        source: line.source,
        adjustmentName: adjustment.name,
        totalAmount: adjustment.amount,
        applicationCount: 1,
        transactionCount: 0,
        transactions: new Set([line.transactionId])
      });
    });
  });

  return Array.from(map.values())
    .map((entry) => ({
      source: entry.source,
      adjustmentName: entry.adjustmentName,
      totalAmount: roundMoney(entry.totalAmount),
      applicationCount: entry.applicationCount,
      transactionCount: entry.transactions.size
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

const buildItemPerformance = (lines: RevenueAnalysisLine[]): RevenueItemPerformanceRow[] => {
  const map = new Map<string, RevenueItemPerformanceRow>();

  lines.forEach((line) => {
    const key = `${line.source}:${line.itemName}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = roundMoney(existing.quantity + line.quantity);
      existing.revenue = roundMoney(existing.revenue + line.revenue);
      existing.materialCost = roundMoney(existing.materialCost + line.materialCost);
      existing.adjustmentTotal = roundMoney(existing.adjustmentTotal + line.adjustmentTotal);
      existing.profitMargin = roundMoney(existing.profitMargin + line.profitMargin);
      existing.roundingTotal = roundMoney(existing.roundingTotal + line.roundingTotal);
      existing.grossGain = roundMoney(existing.grossGain + line.grossGain);
      return;
    }

    map.set(key, {
      source: line.source,
      itemName: line.itemName,
      quantity: line.quantity,
      revenue: line.revenue,
      materialCost: line.materialCost,
      adjustmentTotal: line.adjustmentTotal,
      profitMargin: line.profitMargin,
      roundingTotal: line.roundingTotal,
      grossGain: line.grossGain
    });
  });

  return Array.from(map.values()).sort((a, b) => b.profitMargin - a.profitMargin);
};

export const buildRevenueAnalysisDataset = ({
  sales = [],
  invoices = [],
  orders = [],
  batches = []
}: {
  sales?: any[];
  invoices?: any[];
  orders?: any[];
  batches?: any[];
}): RevenueAnalysisDataset => {
  const batchMap = new Map<string, any>(
    (Array.isArray(batches) ? batches : [])
      .filter(Boolean)
      .map((batch: any) => [String(batch?.id || batch?.batch_number || ''), batch])
  );

  const orderKeysCoveredByInvoices = new Set<string>();
  (Array.isArray(invoices) ? invoices : []).forEach((invoice: any) => {
    if (isExaminationInvoice(invoice)) return;
    extractOrderReferenceKeys(invoice).forEach((key) => orderKeysCoveredByInvoices.add(key));
  });

  const lines: RevenueAnalysisLine[] = [];

  (Array.isArray(sales) ? sales : [])
    .filter(isRecognizedSale)
    .forEach((sale: any) => {
      lines.push(...normalizeGenericTransaction(sale, 'POS', 'Sale'));
    });

  (Array.isArray(invoices) ? invoices : []).forEach((invoice: any) => {
    if (isExaminationInvoice(invoice)) {
      const batchId = String(
        invoice?.batchId
        || invoice?.originBatchId
        || invoice?.origin_batch_id
        || ''
      ).trim();
      const batch = batchMap.get(batchId);
      lines.push(...buildExaminationLines(invoice, batch));
      return;
    }

    lines.push(...normalizeGenericTransaction(invoice, 'ORDER_FORM', 'Invoice'));
  });

  (Array.isArray(orders) ? orders : []).forEach((order: any) => {
    const status = String(order?.status || '').trim().toLowerCase();
    const orderKeys = [
      String(order?.orderNumber || '').trim().toLowerCase(),
      String(order?.id || '').trim().toLowerCase()
    ].filter(Boolean);
    const alreadyCovered = orderKeys.some((key) => orderKeysCoveredByInvoices.has(key));

    if (status !== 'completed' || alreadyCovered) return;
    lines.push(...normalizeGenericTransaction({
      ...order,
      date: order?.orderDate || order?.date
    }, 'ORDER_FORM', 'Order'));
  });

  const cleanedLines = lines.filter((line) => {
    return Math.abs(line.revenue) > 0.0001
      || Math.abs(line.materialCost) > 0.0001
      || Math.abs(line.adjustmentTotal) > 0.0001
      || Math.abs(line.profitMargin) > 0.0001
      || Math.abs(line.roundingTotal) > 0.0001;
  });

  return {
    lines: cleanedLines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    transactions: aggregateTransactions(cleanedLines),
    sourceSummaries: buildSourceSummaries(cleanedLines),
    adjustmentLedger: buildAdjustmentLedger(cleanedLines),
    itemPerformance: buildItemPerformance(cleanedLines)
  };
};

export const getRevenueSourceLabel = sourceLabel;

