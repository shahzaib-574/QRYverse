import { Capacitor } from '@capacitor/core';
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

export type BillingPlan = {
  id: string;
  title: string;
  price: string;
  period: string;
};

export type BillingSnapshot = {
  status: 'unconfigured' | 'loading' | 'ready' | 'error';
  pro: boolean;
  plans: BillingPlan[];
  message?: string;
};

const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined;
const entitlementId = (import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID as string | undefined) || 'track_pro';
const packages = new Map<string, PurchasesPackage>();
let configured = false;

export async function initializeBilling(): Promise<BillingSnapshot> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !apiKey) {
    return { status: 'unconfigured', pro: false, plans: [] };
  }
  try {
    if (!configured) {
      await Purchases.configure({ apiKey });
      configured = true;
    }
    const [{ customerInfo }, offerings] = await Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ]);
    const available = offerings.current?.availablePackages ?? [];
    packages.clear();
    const plans = available.map((item) => {
      packages.set(item.identifier, item);
      return {
        id: item.identifier,
        title: item.product.title,
        price: item.product.priceString,
        period: packagePeriod(item.identifier),
      };
    });
    return { status: 'ready', pro: isPro(customerInfo), plans };
  } catch (error) {
    return { status: 'error', pro: false, plans: [], message: error instanceof Error ? error.message : 'Billing is temporarily unavailable.' };
  }
}

export async function purchasePlan(id: string): Promise<BillingSnapshot> {
  const selected = packages.get(id);
  if (!configured || !selected) return { status: 'error', pro: false, plans: [], message: 'This plan is not available.' };
  try {
    const result = await Purchases.purchasePackage({ aPackage: selected });
    const refreshed = await initializeBilling();
    return { ...refreshed, pro: isPro(result.customerInfo) };
  } catch (error) {
    return { status: 'error', pro: false, plans: currentPlans(), message: error instanceof Error ? error.message : 'Purchase was not completed.' };
  }
}

export async function restoreBilling(): Promise<BillingSnapshot> {
  if (!configured) return { status: 'unconfigured', pro: false, plans: [] };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const refreshed = await initializeBilling();
    return { ...refreshed, pro: isPro(customerInfo) };
  } catch (error) {
    return { status: 'error', pro: false, plans: currentPlans(), message: error instanceof Error ? error.message : 'Purchases could not be restored.' };
  }
}

function isPro(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[entitlementId]);
}

function currentPlans(): BillingPlan[] {
  return [...packages.values()].map((item) => ({ id: item.identifier, title: item.product.title, price: item.product.priceString, period: packagePeriod(item.identifier) }));
}

function packagePeriod(identifier: string): string {
  const value = identifier.toLowerCase();
  if (value.includes('annual') || value.includes('year')) return 'per year';
  if (value.includes('month')) return 'per month';
  return 'subscription';
}
