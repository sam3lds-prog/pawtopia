/**
 * In-app purchases. The game talks to `IapService` only.
 *
 * What can be bought: gem packs (consumables, for premium decorations) and "Remove interruptions" (the non-consumable
 * v1 players may already own). Nothing sold affects puzzles, hearts, hints or rankings, and nothing is random.
 *
 * Which service runs:
 *  - iOS app with `VITE_REVENUECAT_IOS_KEY` set → `RevenueCatIapService` (App Store through RevenueCat).
 *  - Development and tester builds → `TestStoreIapService`: purchases are free and clearly marked; its gems are tagged
 *    `test` and never count in a release build (`setTestEntriesCount`), its entitlements are tagged `dev` (D6).
 *  - Anything else → `UnavailableIapService`: prices show as "coming soon" and nothing can be bought.
 */

import { Capacitor } from '@capacitor/core';
import { REVENUECAT, STORE_PRODUCTS, TEST_BUILD } from '../config/services';

export type ProductId = keyof typeof STORE_PRODUCTS;
export type GemPackId = Exclude<ProductId, 'remove_ads'>;

export interface ProductInfo {
  id: ProductId;
  title: string;
  description: string;
  /** Localized price string from the store. Null until a store answers. */
  price: string | null;
}

export type PurchaseResult =
  | { ok: true; id: ProductId; source: 'store' | 'dev'; /** Unique per purchase; used to grant consumables once. */ transactionId: string }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

/** A consumable purchase the store knows about (for granting gems that a crash interrupted). */
export interface StoreTransaction {
  transactionId: string;
  productId: ProductId;
}

export interface IapService {
  readonly available: boolean;
  readonly isStub: boolean;
  products(): Promise<ProductInfo[]>;
  purchase(id: ProductId): Promise<PurchaseResult>;
  /** Returns the non-consumables the store confirms the player owns. */
  restore(): Promise<{ ok: boolean; owned: ProductId[]; source: 'store' | 'dev' | null }>;
  /** Every consumable transaction the store has on record for this player (empty when unknown). */
  consumableTransactions(): Promise<StoreTransaction[]>;
}

/** Gems in each pack. */
export const GEM_PACKS: Record<GemPackId, number> = { gems_60: 60, gems_160: 160, gems_420: 420 };

/** Catalog copy. Prices are never hard-coded: they come from the store at runtime. */
export const PRODUCT_CATALOG: Array<Omit<ProductInfo, 'price'>> = [
  { id: 'gems_60', title: 'Pouch of Gems', description: '60 gems for premium decorations.' },
  { id: 'gems_160', title: 'Satchel of Gems', description: '160 gems for premium decorations.' },
  { id: 'gems_420', title: 'Chest of Gems', description: '420 gems for premium decorations.' },
  { id: 'remove_ads', title: 'Remove interruptions', description: 'For players from the first version who already own it. Pawtopia shows no forced ads.' },
];

const productIdOf = (storeId: string): ProductId | null =>
  (Object.keys(STORE_PRODUCTS) as ProductId[]).find((k) => STORE_PRODUCTS[k] === storeId) ?? null;

export class UnavailableIapService implements IapService {
  readonly available = false;
  readonly isStub = false;
  async products(): Promise<ProductInfo[]> {
    return PRODUCT_CATALOG.map((p) => ({ ...p, price: null }));
  }
  async purchase(): Promise<PurchaseResult> {
    return { ok: false, reason: 'unavailable' };
  }
  async restore() {
    return { ok: false, owned: [] as ProductId[], source: null };
  }
  async consumableTransactions(): Promise<StoreTransaction[]> {
    return [];
  }
}

/** Test builds only. Everything is free and labeled; nothing it grants counts in a release build. */
export class TestStoreIapService implements IapService {
  readonly available = true;
  readonly isStub = true;
  private owned = new Set<ProductId>();
  private n = 0;
  async products(): Promise<ProductInfo[]> {
    return PRODUCT_CATALOG.map((p) => ({ ...p, price: 'Test' }));
  }
  async purchase(id: ProductId): Promise<PurchaseResult> {
    if (id === 'remove_ads') this.owned.add(id);
    return { ok: true, id, source: 'dev', transactionId: `test-${Date.now().toString(36)}-${(this.n++).toString(36)}` };
  }
  async restore() {
    return { ok: true, owned: [...this.owned], source: 'dev' as const };
  }
  async consumableTransactions(): Promise<StoreTransaction[]> {
    return [];
  }
}

/** Kept for older imports. */
export const DevStubIapService = TestStoreIapService;

/** The App Store through RevenueCat's Capacitor SDK. */
export class RevenueCatIapService implements IapService {
  readonly available = true;
  readonly isStub = false;
  private ready: Promise<boolean> | null = null;
  constructor(private readonly apiKey: string) {}

  private start(): Promise<boolean> {
    this.ready ??= (async () => {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        await Purchases.configure({ apiKey: this.apiKey });
        return true;
      } catch {
        this.ready = null;
        return false;
      }
    })();
    return this.ready;
  }

  async products(): Promise<ProductInfo[]> {
    const fallback = PRODUCT_CATALOG.map((p) => ({ ...p, price: null }));
    if (!(await this.start())) return fallback;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { products } = await Purchases.getProducts({ productIdentifiers: Object.values(STORE_PRODUCTS) });
      return PRODUCT_CATALOG.map((p) => ({ ...p, price: products.find((sp) => sp.identifier === STORE_PRODUCTS[p.id])?.priceString ?? null }));
    } catch {
      return fallback;
    }
  }

  async purchase(id: ProductId): Promise<PurchaseResult> {
    if (!(await this.start())) return { ok: false, reason: 'unavailable' };
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { products } = await Purchases.getProducts({ productIdentifiers: [STORE_PRODUCTS[id]] });
      const product = products.find((p) => p.identifier === STORE_PRODUCTS[id]);
      if (!product) return { ok: false, reason: 'unavailable' };
      const r = await Purchases.purchaseStoreProduct({ product });
      const transactionId = r.transaction?.transactionIdentifier;
      if (!transactionId) return { ok: false, reason: 'failed' };
      return { ok: true, id, source: 'store', transactionId };
    } catch (e) {
      const err = e as { userCancelled?: boolean | null; code?: string | number };
      return { ok: false, reason: err?.userCancelled ? 'cancelled' : 'failed' };
    }
  }

  async restore() {
    if (!(await this.start())) return { ok: false, owned: [] as ProductId[], source: null };
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.restorePurchases();
      const owned: ProductId[] = customerInfo.entitlements.active[REVENUECAT.removeAdsEntitlement] ? ['remove_ads'] : [];
      return { ok: true, owned, source: 'store' as const };
    } catch {
      return { ok: false, owned: [] as ProductId[], source: null };
    }
  }

  async consumableTransactions(): Promise<StoreTransaction[]> {
    if (!(await this.start())) return [];
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.getCustomerInfo();
      const out: StoreTransaction[] = [];
      for (const t of customerInfo.nonSubscriptionTransactions) {
        const id = productIdOf(t.productIdentifier);
        if (id && id !== 'remove_ads') out.push({ transactionId: t.transactionIdentifier, productId: id });
      }
      return out;
    } catch {
      return [];
    }
  }
}

export function createIapService(testBuild: boolean, opts: { native?: boolean; revenueCatKey?: string } = {}): IapService {
  if (opts.native && opts.revenueCatKey) return new RevenueCatIapService(opts.revenueCatKey);
  return testBuild ? new TestStoreIapService() : new UnavailableIapService();
}

export const iap: IapService = createIapService(TEST_BUILD, { native: Capacitor.isNativePlatform(), revenueCatKey: REVENUECAT.iosKey });

/** Whether an entitlement record should count in this build. Dev grants never count in release. */
export function entitlementCounts(source: 'legacy-v1' | 'store' | 'dev' | null, isDev: boolean): boolean {
  if (source === 'store' || source === 'legacy-v1') return true;
  if (source === 'dev') return isDev;
  return false;
}
