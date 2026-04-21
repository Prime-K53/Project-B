
import React, { useState, useEffect, useMemo } from 'react';
// PRICING RULE: Do NOT implement pricing logic here. All pricing MUST go through pricingEngine.ts
import { useData } from '../context/DataContext';
import { useFinance } from '../context/FinanceContext';
import { CartItem, Item, Sale, PaymentDetail, HeldOrder, ZReport, BOMTemplate } from '../types';
import { ProductGrid } from './pos/components/ProductGrid';
import { CartSidebar } from './pos/components/CartSidebar';
import { PaymentModal } from './pos/components/PaymentModal';
import { CustomerModal, HeldOrdersModal, ReturnsModal, ServiceCalculatorModal } from './pos/components/PosModals';
import QuickPrintModal from '../components/QuickPrintModal';
import { FileText, Printer, X, Plus, Clock as ClockIcon, User as UserIcon, Copy, TrendingUp, DollarSign, ShieldCheck, Landmark, RefreshCw, BookOpen, Eye, CheckCircle, FileDown } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { PrimeDocument } from './shared/components/PDF/PrimeDocument';
import { PreviewModal } from './shared/components/PDF/PreviewModal';
import { PosReceiptSchema } from './shared/components/PDF/schemas';
import { hardwareService } from '../services/hardwareService';
import { transactionService } from '../services/transactionService';
import { pricingService, DynamicServicePricingResult } from '../services/pricingService';
import { dbService } from '../services/db';
import { buildPosReceiptDoc } from '../services/receiptCalculationService';
import { api } from '../services/api';
import { customerNotificationService } from '../services/customerNotificationService';

import { generateNextId, roundFinancial, roundToCurrency, formatNumber, downloadBlob } from '../utils/helpers';
import { attachDocumentSecurity } from '../utils/documentSecurity';
import { getUnitPrice } from '../utils/pricing';
import { calculateSellingPrice, calculateServicePrice } from '../utils/pricing/pricingEngine';

const POS: React.FC = () => {
  const { inventory, user, sales, invoices, customers, parkOrder, heldOrders, retrieveOrder, notify, companyConfig, generateZReport, accounts, addBOM, fetchSalesData, updateReservedStock, marketAdjustments = [] } = useData();
  const { postZReportToLedger, fetchFinanceData } = useFinance();
  const currency = companyConfig.currencySymbol;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>('Main');
  const [globalDiscount, setGlobalDiscount] = useState(0);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [showZReport, setShowZReport] = useState(false);
  const [selectedServiceForCalculator, setSelectedServiceForCalculator] = useState<Item | null>(null);
    
    const handleConfigureService = (service: Item) => {
        console.log('handleConfigureService called with:', service.name, service.type, service.category);
        setSelectedServiceForCalculator(service);
    };
  const [quickPrintModal, setQuickPrintModal] = useState<{ open: boolean; type: 'photocopy' | 'printing' }>({
    open: false,
    type: 'photocopy'
  });
  const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);

  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [zReportData, setZReportData] = useState<ZReport | null>(null);
  const [isClosingDrawer, setIsClosingDrawer] = useState(false);
  const [previewState, setPreviewState] = useState<{ isOpen: boolean, data: any, type: 'POS_RECEIPT' }>({
    isOpen: false,
    data: null,
    type: 'POS_RECEIPT'
  });

  const getPosReceiptFooter = () =>
    companyConfig.transactionSettings?.pos?.receiptFooter || companyConfig.footer?.receiptFooter;

  const buildValidatedPosReceipt = (sale: Sale) => {
    const receipt = buildPosReceiptDoc({
      sale,
      cashierName: sale.cashierId === user?.id ? (user?.name || 'Cashier') : (sale.cashierId || user?.name || 'Cashier'),
      customerName: sale.customerName || 'Walk-in Customer',
      itemDescriptionFormatter: formatServiceDescription,
      footerMessage: getPosReceiptFooter(),
      companyConfig
    });

    const parsed = PosReceiptSchema.safeParse(receipt);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid POS receipt payload';
      throw new Error(`POS receipt validation failed: ${message}`);
    }

    return parsed.data;
  };

  useEffect(() => {
    let mounted = true;
    dbService.getAll<BOMTemplate>('bomTemplates')
      .then((templates) => {
        if (mounted) setBomTemplates(templates || []);
      })
      .catch((err) => {
        console.error('Failed to load BOM templates for POS service pricing', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const formatServiceDescription = (lineItem: any) => {
    // If it already has a detailed description (like from Quick Print), use it
    if (lineItem?.desc) return lineItem.desc;

    const service = lineItem?.serviceDetails;
    const name = lineItem?.name || lineItem?.productName || 'Service';
    if (!service) return name;

    // Use single line format for POS receipts to ensure visibility and follow OrderForm pattern
    return `${name} (${service.pages || 0} pages x ${service.copies || 0} copies)`;
  };

  const upsertDynamicServiceInCart = async (service: Item, pricing: DynamicServicePricingResult) => {
    const lineId = `${service.id}::${pricing.pages}`;
    const adjustmentSnapshots = pricing.adjustmentSnapshots || [];
    const adjustmentTotal = adjustmentSnapshots.reduce((sum: number, s: any) => sum + (s.calculatedAmount || 0), 0);

    const activeAdjs = marketAdjustments.filter((ma: any) => ma.active ?? ma.isActive).map((adj: any) => ({
      name: adj.name,
      type: adj.type,
      value: adj.value,
      percentage: adj.percentage ?? adj.value,
      adjustmentId: adj.id,
      isActive: true
    }));

    const recalculatePricing = async (serviceId: string, categoryId: string, baseCost: number, pages: number, copies: number) => {
      if (!activeAdjs.length) {
        const unitPrice = pricing.unitPricePerCopy;
        const total = unitPrice * copies;
        return { unitPrice, cost: baseCost, totalPrice: total, adjustmentSnapshots: [], adjustmentTotal: 0 };
      }
      return calculateServicePrice({
        itemId: serviceId,
        categoryId: categoryId,
        baseCost: baseCost,
        pages: pages,
        copies: copies,
        adjustments: activeAdjs,
        marketAdjustments: activeAdjs,
        context: 'SERVICE'
      });
    };

    const dynamicLine: CartItem = {
      ...service,
      id: lineId,
      itemId: service.id,
      productId: service.id,
      quantity: pricing.copies,
      price: pricing.unitPricePerCopy,
      cost: pricing.unitCostPerCopy,
      basePrice: pricing.unitCostPerCopy,
      pagesOverride: pricing.pages,
      adjustmentSnapshots,
      adjustmentTotal,
      serviceDetails: pricing.serviceDetails,
      // Store price lock information to prevent recalculation on quantity changes
      priceLocked: pricing.priceLocked || false,
      lockedTotalPrice: pricing.lockedTotalPrice,
      lockedUnitPricePerCopy: pricing.lockedUnitPricePerCopy,
      lockedUnitCostPerCopy: pricing.lockedUnitCostPerCopy
    } as any;

    setCart(prev => {
      const existing = prev.find(i => i.id === lineId);
      if (!existing) return [...prev, dynamicLine];

      const updatedCopies = (existing.quantity || 0) + pricing.copies;

      // If price is locked, maintain the locked unit price and scale the total
      if (pricing.priceLocked && pricing.lockedUnitPricePerCopy !== undefined) {
        const lockedAdjustmentTotal = adjustmentTotal; // Preserve original adjustment
        return prev.map(i => i.id === lineId ? {
          ...i,
          quantity: updatedCopies,
          price: pricing.lockedUnitPricePerCopy,
          cost: pricing.lockedUnitCostPerCopy || i.cost,
          basePrice: pricing.lockedUnitCostPerCopy || i.basePrice,
          pagesOverride: pricing.pages,
          adjustmentSnapshots,
          adjustmentTotal: lockedAdjustmentTotal,
          serviceDetails: pricing.serviceDetails,
          priceLocked: true,
          lockedTotalPrice: pricing.lockedTotalPrice,
          lockedUnitPricePerCopy: pricing.lockedUnitPricePerCopy,
          lockedUnitCostPerCopy: pricing.lockedUnitCostPerCopy
        } : i);
      }

      // For non-locked services, we need to handle async - use existing values as fallback
      // The actual recalculation will happen via useEffect triggered updates
      const totalPages = pricing.pages * updatedCopies;
      return prev.map(i => i.id === lineId ? {
        ...i,
        quantity: updatedCopies,
        price: pricing.unitPricePerCopy,
        cost: pricing.unitCostPerCopy || i.cost,
        basePrice: pricing.unitCostPerCopy || i.basePrice,
        pagesOverride: pricing.pages,
        adjustmentSnapshots,
        adjustmentTotal: adjustmentTotal,
        serviceDetails: {
          pages: pricing.pages,
          copies: updatedCopies,
          totalPages,
          unitCostPerPage: (pricing.unitCostPerCopy || 0) / pricing.pages,
          unitPricePerCopy: pricing.unitPricePerCopy,
          unitCostPerCopy: pricing.unitCostPerCopy,
          totalCost: pricing.unitCostPerCopy * updatedCopies,
          totalPrice: pricing.unitPricePerCopy * updatedCopies
        }
      } : i);
    });
  };

  const handleDownloadReceipt = async (sale: Sale) => {
    try {
      notify("Preparing Receipt PDF...", "info");

      const pdfData = buildValidatedPosReceipt(sale);
      const securedPdfData = await attachDocumentSecurity(pdfData, companyConfig?.companyName);
      const blob = await pdf(<PrimeDocument data={securedPdfData as any} type="POS_RECEIPT" />).toBlob();
      downloadBlob(blob, `RECEIPT-${sale.id}.pdf`);
      notify("Receipt PDF downloaded successfully", "success");
    } catch (error) {
      console.error("PDF generation failed:", error);
      notify("Failed to generate PDF", "error");
    }
  };

  // Apply default customer from settings
  useEffect(() => {
    const defaultCustId = companyConfig.transactionSettings?.posDefaultCustomer;
    if (defaultCustId && !selectedCustomerName) {
      const defaultCust = (customers as any[]).find(c => c.id === defaultCustId || c.name === defaultCustId);
      if (defaultCust) {
        setSelectedCustomerName(defaultCust.name);
      }
    }
  }, [companyConfig.transactionSettings?.posDefaultCustomer, customers]);

  // Global Keyboard Shortcuts for POS
  useEffect(() => {
    if (companyConfig.transactionSettings?.pos?.enableShortcuts === false) return;

    const handleGlobalPOS = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setShowCustomerModal(true); }
      if (e.key === 'F2') { e.preventDefault(); handleQuickPhotocopy(); }
      if (e.key === 'F3') { e.preventDefault(); handleQuickTypePrinting(); }
      if (e.key === 'F10') { e.preventDefault(); handlePay(); }
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); handleParkOrder(); }
    };
    window.addEventListener('keydown', handleGlobalPOS);
    return () => window.removeEventListener('keydown', handleGlobalPOS);
  }, [cart, selectedCustomerName, companyConfig.transactionSettings?.pos?.enableShortcuts]);

  const handlePay = () => {
    if (cart.length === 0) return;
    if (companyConfig.transactionSettings?.pos?.requireCustomer && !selectedCustomerName) {
      notify("Customer selection is required for this transaction", "error");
      setShowCustomerModal(true);
      return;
    }
    setShowPaymentModal(true);
  };

  const { total, processedItems } = useMemo(() => {
    const items = cart.map(item => {
      return {
        ...item,
        totalAmount: item.price * item.quantity
      };
    });

    const subTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const finalTotal = subTotal;

    return {
      total: finalTotal,
      processedItems: items
    };
  }, [cart]);

  const payableTotal = total;

  // Calculate adjustment summary from cart items for display in totals section
  const cartAdjustmentSummary = useMemo(() => {
    const summary: { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number }[] = [];
    const seen = new Map<string, number>();

    cart.forEach(item => {
      const snapshots = item.adjustmentSnapshots || [];
      snapshots.forEach((snapshot: any) => {
        const key = snapshot.adjustmentId || snapshot.name || 'Unknown';
        if (!seen.has(key)) {
          seen.set(key, summary.length);
          summary.push({
            adjustmentId: snapshot.adjustmentId || key,
            adjustmentName: snapshot.name || key,
            totalAmount: 0,
            itemCount: 0
          });
        }
        const idx = seen.get(key)!;
        summary[idx].totalAmount += (snapshot.calculatedAmount || 0) * (item.quantity || 1);
        summary[idx].itemCount += item.quantity || 1;
      });
    });

    return summary;
  }, [cart]);

  const roundingAccumulation = useMemo(() => {
    const totalRounding = cart.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      if (!qty) return sum;

      const serviceDetails = (item as any).serviceDetails;
      if (serviceDetails && isFinite(Number(serviceDetails.calculatedTotalPrice))) {
        const calculated = Number(serviceDetails.calculatedTotalPrice);
        const rounded = Number(serviceDetails.totalPrice ?? (item.price * qty));
        if (isFinite(calculated) && isFinite(rounded)) {
          return sum + (rounded - calculated);
        }
      }

      const directDiff = Number((item as any).rounding_difference);
      if (isFinite(directDiff)) {
        return sum + (directDiff * qty);
      }

      const calculated = Number((item as any).calculated_price);
      const rounded = Number((item as any).selling_price ?? item.price);
      if (isFinite(calculated) && isFinite(rounded)) {
        return sum + ((rounded - calculated) * qty);
      }

      return sum;
    }, 0);

    return roundToCurrency(totalRounding);
  }, [cart]);

  const addToCart = async (item: any) => {
    if (item.type !== 'Service') {
      updateReservedStock(item.parentId || item.id, item.quantity || 1, 'POS Cart Addition', item.parentId ? item.id : undefined);
    }

    const baseItem = item.parentId ? inventory.find(i => i.id === item.parentId) || item : item;
    const variantId = item.parentId ? item.id : undefined;

    const existing = cart.find(i => i.id === item.id);
    const newQty = existing ? (existing.quantity + (item.quantity || 1)) : (item.quantity || 1);

    const activeAdjs = marketAdjustments.filter((ma: any) => ma.active ?? ma.isActive);
    const marketAdjustmentsInput = activeAdjs.map((adj: any) => {
      const isPercentage = adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage';
      let calcAmount = 0;
      if (isPercentage) {
        calcAmount = Number(baseItem.cost) * (adj.value / 100);
      } else {
        calcAmount = adj.value;
      }
      return {
        name: adj.name,
        type: adj.type || (isPercentage ? 'PERCENTAGE' : 'FIXED'),
        value: adj.value,
        percentage: isPercentage ? adj.value : undefined,
        calculatedAmount: Number((calcAmount || 0).toFixed(2)),
        adjustmentId: adj.id,
        isActive: true
      };
    });

    const pricing = await calculateSellingPrice({
      itemId: baseItem.id,
      categoryId: baseItem.category,
      baseCost: Number(baseItem.cost),
      quantity: newQty,
      adjustments: marketAdjustmentsInput,
      context: 'POS'
    });

    const resolvedPrice = item.type !== 'Service' ? pricing.unitPrice : pricing.unitPrice;
    const originalPrice = Number((item as any).selling_price ?? item.price) || 0;
    let productionCostSnapshot = (item as any).productionCostSnapshot;

    setCart(prev => {
      if (existing) {
        return prev.map(i => i.id === item.id ? {
          ...i,
          quantity: newQty,
          price: resolvedPrice,
          originalPrice,
          cost: pricing.cost,
          adjustmentTotal: pricing.adjustmentTotal,
          adjustmentSnapshots: pricing.adjustmentSnapshots,
          productionCostSnapshot
        } : i);
      }
      return [...prev, {
        ...item,
        quantity: newQty,
        price: resolvedPrice,
        originalPrice,
        cost: pricing.cost,
        adjustmentTotal: pricing.adjustmentTotal,
        adjustmentSnapshots: pricing.adjustmentSnapshots,
        productionCostSnapshot
      }];
    });
  };

  const handleQuickPhotocopy = () => {
    setQuickPrintModal({ open: true, type: 'photocopy' });
  };

  const handleQuickTypePrinting = () => {
    setQuickPrintModal({ open: true, type: 'printing' });
  };

const handleQuickPrintConfirm = (quantity: number, pagesPerCopy: number, total: number, printType: 'photocopy' | 'printing', pinningCost?: number, pinningCount?: number) => {
        const isPhotocopy = printType === 'photocopy';
        const pricePerPage = isPhotocopy 
          ? (companyConfig.transactionSettings?.pos?.photocopyPrice || 2.00)
          : (companyConfig.transactionSettings?.pos?.typePrintingPrice || 5.00);

        // For quick print, we use the total FROM THE MODAL (which includes stapling if configured)
        // This ensures the cart calculation matches the modal total
        const finalPrice = total;

        const quickItem: CartItem = {
          id: `QUICK-${isPhotocopy ? 'PHOTO' : 'PRINT'}-${Date.now()}`,
          itemId: isPhotocopy ? 'SVC-PHOTOCOPY' : 'SVC-TYPE-PRINT',
          name: isPhotocopy ? 'Quick Photocopy' : 'Type & Printing',
          sku: isPhotocopy ? 'QUICK-PHOTO' : 'QUICK-PRINT',
          desc: isPhotocopy 
            ? `Quick Photocopy (${pagesPerCopy} pages × ${quantity} copies)`
            : `Type & Printing (${pagesPerCopy} pages × ${quantity} copies)`,
          price: finalPrice,
          quantity: 1,
          pagesOverride: pagesPerCopy,
          category: 'Service',
          type: 'Service',
          unit: 'page',
          pages: pagesPerCopy,
          stock: 9999,
          minStockLevel: 0,
          adjustedPrice: finalPrice,
          priceLocked: true,
          lockedUnitPricePerCopy: finalPrice,
          serviceDetails: {
            pages: pagesPerCopy,
            copies: quantity,
            pinningCost: pinningCost,
            pinningCount: pinningCount
          }
        } as any;

        // Add to cart (stapling cost is included in item price)
        setCart(prev => [...prev, quickItem]);
        notify(`${quantity}x${pagesPerCopy} pages added to cart`, 'success');
      };

  const updateQuantity = async (id: string, value: number, isAbsolute?: boolean) => {
    const itemInCart = cart.find(i => i.id === id);
    if (!itemInCart) return;

    const oldQty = itemInCart.quantity;
    const newQty = Math.max(1, isAbsolute ? value : oldQty + value);
    if (newQty < 1) return;

    if ((itemInCart as any).serviceDetails) {
      const cartItem = itemInCart as any;
      const serviceInfo = cartItem.serviceDetails;
      const pages = Number(serviceInfo?.pages || cartItem.pagesOverride || 1);
      const baseServiceId = cartItem.itemId || itemInCart.id.split('::')[0];
      const baseService = inventory.find(i => i.id === baseServiceId) || ({ ...itemInCart, id: baseServiceId } as Item);

      if (cartItem.priceLocked && cartItem.lockedUnitPricePerCopy !== undefined) {
        const lockedAdjustmentTotal = cartItem.adjustmentTotal || 0;
        setCart(prev => prev.map(i => i.id === id ? {
          ...i,
          quantity: newQty,
          price: cartItem.lockedUnitPricePerCopy,
          cost: cartItem.lockedUnitCostPerCopy || i.cost,
          basePrice: cartItem.lockedUnitCostPerCopy || i.basePrice,
          adjustmentTotal: lockedAdjustmentTotal,
          priceLocked: true,
          lockedTotalPrice: cartItem.lockedTotalPrice,
          lockedUnitPricePerCopy: cartItem.lockedUnitPricePerCopy,
          lockedUnitCostPerCopy: cartItem.lockedUnitCostPerCopy
        } : i));
        return;
      }

      const activeAdjs = marketAdjustments.filter((ma: any) => ma.active ?? ma.isActive).map((adj: any) => ({
        name: adj.name,
        type: adj.type,
        value: adj.value,
        percentage: adj.percentage ?? adj.value,
        adjustmentId: adj.id,
        isActive: true
      }));

      const baseCost = Number(baseService.cost) || 0;
      const unitCostPerCopy = newQty > 0 ? roundToCurrency(baseCost / newQty) : baseCost;

      const pricing = await calculateServicePrice({
        itemId: baseService.id,
        categoryId: baseService.category,
        baseCost: baseCost,
        pages: pages,
        copies: newQty,
        adjustments: activeAdjs,
        marketAdjustments: activeAdjs,
        context: 'SERVICE'
      });

      setCart(prev => prev.map(i => i.id === id ? {
        ...i,
        quantity: newQty,
        price: pricing.unitPrice,
        cost: pricing.cost,
        basePrice: pricing.cost,
        pagesOverride: pages,
        adjustmentSnapshots: pricing.adjustmentSnapshots,
        adjustmentTotal: pricing.adjustmentTotal,
        serviceDetails: {
          pages,
          copies: newQty,
          totalPages: pages * newQty,
          unitCostPerPage: pricing.cost / pages,
          unitPricePerCopy: pricing.unitPrice,
          unitCostPerCopy: pricing.cost,
          totalCost: baseCost,
          totalPrice: pricing.totalPrice
        }
      } : i));
      return;
    }

    const delta = newQty - oldQty;
    if (delta !== 0 && itemInCart.type !== 'Service') {
      updateReservedStock(itemInCart.parentId || itemInCart.id, delta, 'POS Quantity Change', itemInCart.parentId ? itemInCart.id : undefined);
    }

    const baseItemId = (itemInCart as any).parentId || itemInCart.id.split('::')[0];
    const baseItem = inventory.find(i => i.id === baseItemId) || itemInCart;

    const activeAdjs = marketAdjustments.filter((ma: any) => ma.active ?? ma.isActive);
    const marketAdjustmentsInput = activeAdjs.map((adj: any) => {
      const isPercentage = adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage';
      let calcAmount = 0;
      if (isPercentage) {
        calcAmount = Number(baseItem.cost) * (adj.value / 100);
      } else {
        calcAmount = adj.value;
      }
      return {
        name: adj.name,
        type: adj.type || (isPercentage ? 'PERCENTAGE' : 'FIXED'),
        value: adj.value,
        percentage: isPercentage ? adj.value : undefined,
        calculatedAmount: Number((calcAmount || 0).toFixed(2)),
        adjustmentId: adj.id,
        isActive: true
      };
    });

    const pricing = await calculateSellingPrice({
      itemId: baseItem.id,
      categoryId: baseItem.category,
      baseCost: Number(baseItem.cost),
      quantity: newQty,
      adjustments: marketAdjustmentsInput,
      context: 'POS'
    });

    setCart(prev => prev.map(i => i.id === id ? {
      ...i,
      quantity: newQty,
      price: pricing.unitPrice,
      cost: pricing.cost,
      originalPrice: (itemInCart as any).originalPrice,
      adjustmentSnapshots: pricing.adjustmentSnapshots,
      adjustmentTotal: pricing.adjustmentTotal,
      productionCostSnapshot: (itemInCart as any).productionCostSnapshot
    } : i));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.type !== 'Service') {
        updateReservedStock(item.parentId || item.id, -item.quantity, 'POS Item Removal', item.parentId ? item.id : undefined);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const clearCart = (releaseReservation: boolean = true) => {
    if (releaseReservation && cart.length > 0) {
      cart.forEach(item => {
        if (item.type !== 'Service') {
          updateReservedStock(item.parentId || item.id, -item.quantity, 'POS Cart Clear', item.parentId ? item.id : undefined);
        }
      });
    }
    setCart([]);
    setSelectedCustomerName(null);
    setSelectedSubAccount('Main');
    setGlobalDiscount(0);
  };

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message || String(err);
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as any;
      if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message;
      if (typeof anyErr.name === 'string' && anyErr.name.trim()) return anyErr.name;
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }
    return 'Unknown error';
  };

  const handleCustomerSelect = (name: string) => {
    setSelectedCustomerName(name);
    setSelectedSubAccount('Main');
    setShowCustomerModal(false);
  };

  const handleParkOrder = () => {
    if (cart.length === 0) return;
    parkOrder({ id: '', customerName: selectedCustomerName || 'Walk-in', date: new Date().toISOString(), items: cart, note: 'Parked from POS' });
    clearCart();
    notify("Order Parked", 'success');
  };

  const handleCompletePayment = async (payments: PaymentDetail[], excessHandling?: 'Change' | 'Wallet') => {
    try {
      const [persistedSales, idempotencyKeys] = await Promise.all([
        dbService.getAll<Sale>('sales'),
        dbService.getAll<any>('idempotencyKeys')
      ]);

      const knownSales = [...(sales || []), ...(persistedSales || [])];
      const blockedSaleIds = new Set(
        (idempotencyKeys || [])
          .filter((entry: any) => String(entry?.scope || '').trim() === 'sale')
          .map((entry: any) => String(entry?.sourceId || '').trim())
          .filter(Boolean)
      );

      let idCollection = knownSales.slice();
      let saleId = generateNextId('POS', idCollection, companyConfig);
      while (blockedSaleIds.has(saleId) || idCollection.some((entry: any) => String(entry?.id || '').trim() === saleId)) {
        idCollection = [...idCollection, { id: saleId, date: new Date().toISOString() } as any];
        saleId = generateNextId('POS', idCollection, companyConfig);
      }

      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const changeDue = Math.max(totalPaid - payableTotal, 0);

      // Aggregate market adjustments from items
      const totalAdjustment = cart.reduce((sum, item) => sum + (item.adjustmentTotal || 0) * item.quantity, 0);
      const aggregatedSnapshots: any[] = [];
      const processesedItemsWithSnapshots = processedItems.map((item: any) => {
        let snapshots = item.adjustmentSnapshots || [];

        // Fallback calculation for held orders or legacy items
        if ((!snapshots || snapshots.length === 0) && item.type !== 'Service') {
          const activeAdjs = marketAdjustments.filter((ma: any) => ma.active ?? ma.isActive);
          const itemCost = item.cost || 0;
          snapshots = activeAdjs.map((adj: any) => {
            const isPercentage = adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage';
            let calcAmount = 0;
            if (isPercentage) {
              calcAmount = itemCost * (adj.value / 100);
            } else {
              calcAmount = adj.value;
            }
            return {
              name: adj.name,
              type: adj.type || (isPercentage ? 'PERCENTAGE' : 'FIXED'),
              value: adj.value,
              percentage: isPercentage ? adj.value : undefined,
              calculatedAmount: Number((calcAmount || 0).toFixed(2))
            };
          });
        }

        // Aggregate
        snapshots.forEach((snap: any) => {
          const existing = aggregatedSnapshots.find(s => s.name === snap.name);
          if (existing) {
            existing.calculatedAmount += snap.calculatedAmount * item.quantity;
          } else {
            aggregatedSnapshots.push({ ...snap, calculatedAmount: snap.calculatedAmount * item.quantity });
          }
        });

        return { ...item, adjustmentSnapshots: snapshots };
      });

       const saleData: Sale = {
         id: saleId,
         date: new Date().toISOString(),
         source: 'POS',
         totalAmount: payableTotal,
         discount: 0,
         status: 'Paid',
         items: processesedItemsWithSnapshots.map((item: any) => ({
           ...item,
           productId: item.productId || item.id,
           productName: item.name,
           unitPrice: item.price,
           subtotal: item.price * item.quantity,
           discount: 0,
           productionCostSnapshot: item.productionCostSnapshot,
           adjustmentSnapshots: item.adjustmentSnapshots,
           desc: item.desc
         })) as any,
         paymentMethod: payments.length === 1 ? payments[0].method : 'Split',
         payments: payments,
         cashierId: user?.id || 'unknown',
         customerId: selectedCustomerName || 'walk-in',
         customerName: selectedCustomerName || 'Walk-in',
         subAccountName: selectedSubAccount,
         total: payableTotal,
         bill_total: payableTotal,
         cash_tendered: totalPaid,
         change_due: changeDue,
         adjustmentTotal: totalAdjustment,
adjustmentSnapshots: aggregatedSnapshots
        };

      try {
        const serverPricing = await calculateSellingPrice({
          itemId: 'BATCH_SALE',
          categoryId: null,
          baseCost: totalCost,
          quantity: 1,
          adjustments: aggregatedSnapshots,
          context: 'POS'
        });
        if (Math.abs(serverPricing.totalPrice - payableTotal) > 0.01) {
          console.warn('⚠️ Price mismatch detected before submit', { 
            serverPrice: serverPricing.totalPrice, 
            frontendPrice: payableTotal,
            diff: serverPricing.totalPrice - payableTotal
          });
        }
      } catch (pricingError) {
        console.error('[Pricing Integrity Check Failed]', pricingError);
      }

      await api.sales.createSale(saleData);

      // Refresh data across modules
      await Promise.all([
        fetchSalesData?.(),
        fetchFinanceData?.()
      ]);

      const persistedSale = await dbService.get<Sale>('sales', saleId);
      const receiptSale: Sale = persistedSale || {
        ...saleData,
        excessHandling: (excessHandling || 'Change') as 'Change' | 'Wallet',
        excessAmount: changeDue
      };
      setLastSale(receiptSale as any);
      setShowPaymentModal(false);

      const previewData = buildValidatedPosReceipt(receiptSale);

      // Proactively start PDF generation in background if possible, 
      // but for now just ensure the state is set immediately.
      setPreviewState({
        isOpen: true,
        type: 'POS_RECEIPT',
        data: previewData
      });

      if (companyConfig.transactionSettings?.autoPrintReceipt) {
        if (hardwareService.isConnected()) {
          try {
            await hardwareService.printPosReceipt(previewData as any, companyConfig);
          } catch (printError) {
            console.error('Auto-print failed:', printError);
            notify('Auto-print failed. Receipt preview is available.', 'warning');
          }
        } else {
          notify('Auto-print is enabled but no printer is connected.', 'warning');
        }
      }

      clearCart(true);
      notify(`Sale #${saleId} completed`, 'success');
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('POS Sale Error:', error, message);
      notify(message || 'Error processing sale', 'error');
    }
  };

  const handleProcessRefund = async (saleId: string, items: { itemId: string, qty: number }[], refundAccountId?: string) => {
    try {
      await transactionService.processRefund({
        saleId,
        refundItems: items.map(i => ({ itemId: i.itemId, quantity: i.qty, reason: 'POS Return', condition: 'Sellable' as const })),
        reason: 'POS Return',
        refundMethod: 'Cash' as any,
        accountId: refundAccountId || '1000', // Default to Cash Account if not specified
        date: new Date().toISOString(),
        id: generateNextId('refund', [], companyConfig),
        refundAmount: 0, // Should be calculated
        restock: true
      });

      await fetchSalesData?.();
      notify(`Refund processed for Sale #${saleId}`, 'success');
      setShowReturnsModal(false);
    } catch (error: any) {
      notify(`Refund Failed: ${error.message}`, 'error');
    }
  };

  const handleCloseRegister = async () => {
    if (!zReportData) return;
    setIsClosingDrawer(true);
    const bankAccId = accounts.find((a: any) => a.code === '1050')?.id || '1050';
    await postZReportToLedger(zReportData, bankAccId);
    setIsClosingDrawer(false);
    setShowZReport(false);
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-[#F8FAFC] relative font-sans text-slate-800">
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header Mimicking QBO */}
        <div className="px-6 py-3 flex items-center justify-between z-30 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#393a3d] flex items-center justify-center text-white">
                <UserIcon size={14} />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cashier</p>
                <p className="text-sm font-bold text-slate-800">{user?.name || 'Cashier'}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="hidden lg:flex gap-4">
              <button onClick={handleQuickPhotocopy} className="text-blue-600 hover:underline flex items-center gap-1.5 text-sm font-semibold">
                <Copy size={16} /> Photocopy
              </button>
              <button onClick={handleQuickTypePrinting} className="text-blue-600 hover:underline flex items-center gap-1.5 text-sm font-semibold">
                <FileText size={16} /> Type and Printing
              </button>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {companyConfig?.transactionSettings?.pos?.showShortcutHints !== false && (
              <span className="text-[11px] text-slate-500 font-medium hidden xl:block italic">
                {companyConfig?.transactionSettings?.pos?.shortcutLabels?.F1 ? `F1: ${companyConfig.transactionSettings.pos.shortcutLabels.F1} • ` : 'F1: Cust • '}
                {companyConfig?.transactionSettings?.pos?.shortcutLabels?.F2 ? `F2: ${companyConfig.transactionSettings.pos.shortcutLabels.F2} • ` : 'F2: Photo • '}
                {companyConfig?.transactionSettings?.pos?.shortcutLabels?.F3 ? `F3: ${companyConfig.transactionSettings.pos.shortcutLabels.F3} • ` : 'F3: Print • '}
                {companyConfig?.transactionSettings?.pos?.shortcutLabels?.F10 ? `F10: ${companyConfig.transactionSettings.pos.shortcutLabels.F10}` : 'F10: Pay'}
              </span>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowHeldOrdersModal(true)} className="px-4 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-100 flex items-center gap-2">
                <ClockIcon size={14} /> Held ({heldOrders.length})
              </button>
              <button onClick={() => { setZReportData(generateZReport(user?.id || '')); setShowZReport(true); }} className="px-4 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-100 flex items-center gap-2">
                <TrendingUp size={14} /> Register
              </button>
            </div>
          </div>
        </div>
        <ProductGrid
          inventory={inventory}
          addToCart={addToCart}
          onConfigureService={handleConfigureService}
          onRecall={() => setShowHeldOrdersModal(true)}
          heldCount={heldOrders.length}
          onZReport={() => { setZReportData(generateZReport(user?.id || '')); setShowZReport(true); }}
        />
      </div>

      {/* Right Sidebar - Checkout */}
      <div className="w-full md:w-1/3 h-full relative z-20 border-l border-slate-200">
        <div className="absolute inset-0 bg-white">
          <CartSidebar
            cart={cart}
            selectedCustomerName={selectedCustomerName}
            selectedSubAccount={selectedSubAccount}
            setSelectedSubAccount={setSelectedSubAccount}
            onSelectCustomer={() => setShowCustomerModal(true)}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onPark={handleParkOrder}
            onReturn={() => setShowReturnsModal(true)}
            onPay={handlePay}
            totals={{ subtotal: total, discount: 0, total: payableTotal }}
            adjustmentSummary={cartAdjustmentSummary}
          />
        </div>
      </div>

      {showZReport && zReportData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider"><TrendingUp size={16} className="text-blue-600" /> Register Summary</h2>
              <button onClick={() => setShowZReport(false)} className="text-slate-400 hover:text-red-600"><X size={20} /></button>
            </div>
            <div id="register-details" className="flex-1 overflow-y-auto p-8 text-sm bg-white">
              <div className="text-center border-b border-slate-100 pb-6 mb-6">
                <h1 className="font-bold text-lg text-slate-800 uppercase tracking-tight">{companyConfig.companyName}</h1>
                <p className="text-slate-500 text-xs mt-1 font-medium">Daily Sales Summary</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-slate-500">Gross Sales</span><span className="font-bold text-slate-800">{currency}{formatNumber(zReportData.totalSales)}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Cash in Drawer</span><span className="font-bold text-emerald-600">{currency}{formatNumber(zReportData.cashSales)}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Card Terminal</span><span className="font-bold text-slate-800">{currency}{formatNumber(zReportData.cardSales)}</span></div>
              </div>
              <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                Closing the register will automatically transfer the cash balance to the Main Ledger account.
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <button
                onClick={handleCloseRegister}
                disabled={isClosingDrawer}
                className="w-full py-3.5 bg-emerald-600 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-sm"
              >
                {isClosingDrawer ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {isClosingDrawer ? 'Posting to Ledger...' : 'Close Register & Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          total={payableTotal}
          onComplete={handleCompletePayment}
          onCancel={() => setShowPaymentModal(false)}
          customerName={selectedCustomerName}
          availableCredit={0}
          walletBalance={customers.find((c: any) => c.name === selectedCustomerName || c.id === selectedCustomerName)?.walletBalance || 0}
          subAccountName={selectedSubAccount}
          adjustmentSummary={cartAdjustmentSummary}
          roundingAccumulation={roundingAccumulation}
        />
      )}
      {showCustomerModal && <CustomerModal onSelect={handleCustomerSelect} onClose={() => setShowCustomerModal(false)} />}
      {showHeldOrdersModal && <HeldOrdersModal orders={heldOrders} onRetrieve={(o) => { setCart(o.items); retrieveOrder(o.id); setShowHeldOrdersModal(false); }} onClose={() => setShowHeldOrdersModal(false)} />}
      {showReturnsModal && <ReturnsModal sales={sales} onProcess={handleProcessRefund} onClose={() => setShowReturnsModal(false)} />}
      {selectedServiceForCalculator && (
        <ServiceCalculatorModal
          service={selectedServiceForCalculator}
          currencySymbol={currency}
          initialPages={selectedServiceForCalculator.pages || 1}
          initialCopies={1}
          onConfirm={async (pricing) => {
            await upsertDynamicServiceInCart(selectedServiceForCalculator, pricing);
            setSelectedServiceForCalculator(null);
            notify(`${selectedServiceForCalculator.name} added`, 'success');
          }}
          onClose={() => setSelectedServiceForCalculator(null)}
        />
      )}
      {quickPrintModal.open && (
        <QuickPrintModal
          open={quickPrintModal.open}
          type={quickPrintModal.type}
          pricePerPage={quickPrintModal.type === 'photocopy'
            ? (companyConfig.transactionSettings?.pos?.photocopyPrice || 2.00)
            : (companyConfig.transactionSettings?.pos?.typePrintingPrice || 5.00)}
          currency={currency}
          staplePrice={companyConfig.transactionSettings?.pos?.staplePrice}
          pinningItem={(() => {
            const pinning = inventory.find(i => i.name?.toLowerCase().includes('staple') || i.name?.toLowerCase().includes('pin'));
            if (!pinning) return null;
            const conversionRate = Number((pinning as any).conversionRate ?? (pinning as any).conversion_rate ?? 1);
            return {
              costPerUnit: Number((pinning as any).cost_price ?? (pinning as any).cost_per_unit ?? pinning.cost ?? 0),
              conversionRate: conversionRate,
              materialId: pinning.id
            };
          })()}
          onConfirm={(quantity, pagesPerCopy, total, printType, pinningCost, pinningCount) => {
            handleQuickPrintConfirm(quantity, pagesPerCopy, total, printType, pinningCost, pinningCount);
            setQuickPrintModal({ open: false, type: quickPrintModal.type });
          }}
          onClose={() => setQuickPrintModal({ open: false, type: quickPrintModal.type })}
        />
      )}

      {/* Receipt Preview Banner */}
      {lastSale && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
          <CheckCircle size={20} />
          <div className="text-sm font-bold">Sale #{lastSale.id} completed</div>
          <button
            onClick={() => handleDownloadReceipt(lastSale)}
            className="ml-4 px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-colors flex items-center gap-1"
          >
            <FileDown size={12} /> Download Receipt
          </button>
        </div>
      )}

      <PreviewModal
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
        type={previewState.type as any}
        data={previewState.data}
      />
    </div>
  );
};

export default POS;
