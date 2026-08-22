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

// The first Play release is deliberately ad-supported and does not bundle a
// billing SDK. Keeping this adapter boundary means a future verified store
// integration can replace only this module without changing the application UI.
function unavailableSnapshot(): BillingSnapshot {
  return { status: 'unconfigured', pro: false, plans: [] };
}

export function initializeBilling(): Promise<BillingSnapshot> {
  return Promise.resolve(unavailableSnapshot());
}

export function purchasePlan(_id: string): Promise<BillingSnapshot> {
  return Promise.resolve(unavailableSnapshot());
}

export function restoreBilling(): Promise<BillingSnapshot> {
  return Promise.resolve(unavailableSnapshot());
}
