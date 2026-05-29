export type PaymentProviderKey = "none" | "stripe" | "gocardless";

export type PaymentProviderConfig = {
  stripe_account_id?: string | null;
  gocardless_merchant_id?: string | null;
};

export type PaymentProvider = {
  key: PaymentProviderKey;
  label: string;
  isConfigured: (config: PaymentProviderConfig) => boolean;
};

const providers = new Map<PaymentProviderKey, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider) {
  providers.set(provider.key, provider);
}

export function getPaymentProvider(key: PaymentProviderKey) {
  return providers.get(key) ?? providers.get("none")!;
}

export function listPaymentProviders() {
  return [...providers.values()];
}

registerPaymentProvider({
  key: "none",
  label: "None",
  isConfigured: () => true,
});

registerPaymentProvider({
  key: "stripe",
  label: "Stripe",
  isConfigured: (config) => Boolean(config.stripe_account_id?.trim()),
});

registerPaymentProvider({
  key: "gocardless",
  label: "GoCardless",
  isConfigured: (config) => Boolean(config.gocardless_merchant_id?.trim()),
});
