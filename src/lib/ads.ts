import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentDebugGeography,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
  type AdmobConsentInfo,
  type AdmobConsentRequestOptions,
} from '@capacitor-community/admob';
import { desktopBannerMargin, resolveMobileBannerMargin } from './ad-layout';

const googleAndroidTestBannerId = 'ca-app-pub-3940256099942544/9214589741';
const configuredBannerId = import.meta.env.VITE_ADMOB_BANNER_ID?.trim();
const testMode = import.meta.env.VITE_ADMOB_TEST_MODE !== 'false' || !configuredBannerId;
const bannerId = configuredBannerId || googleAndroidTestBannerId;
const testDevices = (import.meta.env.VITE_ADMOB_TEST_DEVICE_IDS ?? '')
  .split(',')
  .map((value: string) => value.trim())
  .filter(Boolean);
const consentDebugGeographyName = (import.meta.env.VITE_ADMOB_CONSENT_DEBUG_GEOGRAPHY ?? 'DISABLED').trim().toUpperCase();
const consentDebugGeographies: Record<string, AdmobConsentDebugGeography> = {
  DISABLED: AdmobConsentDebugGeography.DISABLED,
  EEA: AdmobConsentDebugGeography.EEA,
  US: AdmobConsentDebugGeography.US,
  OTHER: AdmobConsentDebugGeography.OTHER,
};
const consentDebugGeography = consentDebugGeographies[consentDebugGeographyName] ?? AdmobConsentDebugGeography.DISABLED;
const consentRequestOptions: AdmobConsentRequestOptions = testMode && testDevices.length > 0
  ? { testDeviceIdentifiers: testDevices, debugGeography: consentDebugGeography }
  : {};
const minimumBannerRequestIntervalMs = 60_000;

export type MobileAdsState = {
  native: boolean;
  ready: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  usingTestAds: boolean;
  message?: string;
};

export const initialMobileAdsState: MobileAdsState = {
  native: false,
  ready: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  usingTestAds: true,
};

let initialization: Promise<MobileAdsState> | undefined;
let initializationFailed = false;
let currentState = initialMobileAdsState;
let appActive = true;
let bannerCreated = false;
let bannerVisible = false;
let bannerLoaded = false;
let desiredBannerVisible = false;
let bannerOperation: Promise<void> = Promise.resolve();
let adsSdkInitialized = false;
let bannerSizeListener: PluginListenerHandle | undefined;
let bannerLoadedListener: PluginListenerHandle | undefined;
let bannerFailedListener: PluginListenerHandle | undefined;
let bannerHeight = 0;
let activeBannerMargin = 0;
let lastBannerRequestAt = 0;
let bannerRetryTimer: number | undefined;
let resizeListenerInstalled = false;
let layoutChangeQueued = false;

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function privacyRequired(info: AdmobConsentInfo): boolean {
  return String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
}

async function startMobileAds(): Promise<MobileAdsState> {
  if (!isAndroidNative()) return initialMobileAdsState;

  let latestConsent: AdmobConsentInfo | undefined;
  try {
    latestConsent = await AdMob.requestConsentInfo(consentRequestOptions);
    if (latestConsent.status === AdmobConsentStatus.REQUIRED) {
      latestConsent = await AdMob.showConsentForm();
    }

    if (latestConsent.canRequestAds) await ensureAdsSdkInitialized();

    currentState = {
      native: true,
      ready: adsSdkInitialized,
      canRequestAds: latestConsent.canRequestAds,
      privacyOptionsRequired: privacyRequired(latestConsent),
      usingTestAds: testMode,
      message: latestConsent.canRequestAds ? undefined : 'Ads remain off until privacy choices allow requests.',
    };
  } catch (error) {
    initializationFailed = true;
    currentState = {
      native: true,
      ready: adsSdkInitialized,
      canRequestAds: false,
      privacyOptionsRequired: latestConsent ? privacyRequired(latestConsent) : currentState.privacyOptionsRequired,
      usingTestAds: testMode,
      message: error instanceof Error ? error.message : 'Mobile ads are unavailable.',
    };
  }
  return currentState;
}

async function ensureAdsSdkInitialized(): Promise<void> {
  if (!adsSdkInitialized) {
    await AdMob.initialize({
      initializeForTesting: testMode && testDevices.length > 0,
      testingDevices: testMode ? testDevices : [],
      maxAdContentRating: MaxAdContentRating.General,
    });
    adsSdkInitialized = true;
  }
  bannerSizeListener ??= await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    bannerHeight = Math.max(0, Math.min(180, Math.ceil(size.height)));
    applyBannerSpace();
  });
  bannerLoadedListener ??= await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    if (!bannerCreated) return;
    bannerLoaded = true;
    applyBannerSpace();
  });
  bannerFailedListener ??= await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
    if (!bannerCreated) return;
    bannerLoaded = false;
    clearBannerSpace();
    bannerOperation = bannerOperation.catch(() => undefined).then(async () => {
      await removeBannerView();
      scheduleBannerRetry();
    });
  });
  if (!resizeListenerInstalled) {
    window.addEventListener('resize', handleViewportResize);
    resizeListenerInstalled = true;
  }
}

function clearBannerSpace(): void {
  const root = document.documentElement;
  root.style.setProperty('--ad-space', '0px');
  root.style.setProperty('--ad-rail-bottom', '0px');
  root.style.setProperty('--ad-rail-height', '0px');
  delete root.dataset.mobileAdState;
}

function bannerMargin(): number {
  if (window.matchMedia('(min-width: 720px)').matches) return desktopBannerMargin;

  const navigation = document.querySelector<HTMLElement>('.bottom-nav');
  const scanButton = document.querySelector<HTMLElement>('.scan-fab');
  const exclusionTops = [navigation, scanButton]
    .filter((element): element is HTMLElement => Boolean(element))
    .map((element) => element.getBoundingClientRect().top)
    .filter(Number.isFinite);
  const exclusionTop = exclusionTops.length > 0 ? Math.min(...exclusionTops) : undefined;
  const safeBottomInset = navigation
    ? Number.parseFloat(window.getComputedStyle(navigation).paddingBottom) || 0
    : 0;
  return resolveMobileBannerMargin(window.innerHeight, exclusionTop, safeBottomInset);
}

function applyBannerSpace(): void {
  if (!bannerCreated || !bannerVisible || !desiredBannerVisible || !appActive) {
    clearBannerSpace();
    return;
  }
  const layoutMargin = window.matchMedia('(min-width: 720px)').matches ? desktopBannerMargin : 96;
  const extraMargin = Math.max(0, activeBannerMargin - layoutMargin);
  const displayedBannerHeight = Math.max(50, bannerHeight);
  const root = document.documentElement;
  root.style.setProperty('--ad-space', `${displayedBannerHeight + extraMargin + 8}px`);
  root.style.setProperty('--ad-rail-bottom', `${activeBannerMargin}px`);
  root.style.setProperty('--ad-rail-height', `${displayedBannerHeight}px`);
  root.dataset.mobileAdState = bannerLoaded ? 'loaded' : 'loading';
}

function handleViewportResize(): void {
  applyBannerSpace();
  if (!bannerCreated || activeBannerMargin === bannerMargin() || layoutChangeQueued) return;
  layoutChangeQueued = true;
  bannerOperation = bannerOperation.catch(() => undefined).then(async () => {
    await removeBannerView();
    scheduleBannerRetry();
  }).finally(() => { layoutChangeQueued = false; });
}

export function initializeMobileAds(): Promise<MobileAdsState> {
  if (!initialization) {
    initializationFailed = false;
    const attempt = startMobileAds();
    initialization = attempt;
    void attempt.then(() => {
      if (initializationFailed && initialization === attempt) initialization = undefined;
    });
  }
  return initialization.then(() => currentState);
}

function cancelBannerRetry(): void {
  if (bannerRetryTimer === undefined) return;
  window.clearTimeout(bannerRetryTimer);
  bannerRetryTimer = undefined;
}

function scheduleBannerRetry(): void {
  if (bannerRetryTimer !== undefined || !desiredBannerVisible || !appActive || !currentState.canRequestAds) return;
  const elapsed = Date.now() - lastBannerRequestAt;
  const delay = lastBannerRequestAt > 0 ? Math.max(0, minimumBannerRequestIntervalMs - elapsed) : 0;
  bannerRetryTimer = window.setTimeout(() => {
    bannerRetryTimer = undefined;
    void queueBannerSynchronization().catch(() => undefined);
  }, delay);
}

async function removeBannerView(): Promise<void> {
  const shouldRemove = bannerCreated;
  try {
    if (shouldRemove) await AdMob.removeBanner();
  } finally {
    bannerCreated = false;
    bannerVisible = false;
    bannerLoaded = false;
    bannerHeight = 0;
    activeBannerMargin = 0;
    clearBannerSpace();
  }
}

async function hideBannerView(): Promise<void> {
  if (!bannerCreated || !bannerVisible) {
    clearBannerSpace();
    return;
  }
  try {
    await AdMob.hideBanner();
  } finally {
    bannerVisible = false;
    clearBannerSpace();
  }
}

async function synchronizeBanner(): Promise<void> {
  if (!desiredBannerVisible || !appActive) {
    cancelBannerRetry();
    await hideBannerView();
    return;
  }

  await initializeMobileAds();
  if (!desiredBannerVisible || !appActive) {
    cancelBannerRetry();
    await hideBannerView();
    return;
  }

  const canShow = currentState.native && currentState.ready && currentState.canRequestAds;
  if (!canShow) {
    cancelBannerRetry();
    await removeBannerView();
    return;
  }

  const nextMargin = bannerMargin();
  if (bannerCreated && activeBannerMargin !== nextMargin) {
    await removeBannerView();
  }

  if (bannerCreated) {
    cancelBannerRetry();
    if (!bannerVisible) {
      await AdMob.resumeBanner();
      bannerVisible = true;
    }
    applyBannerSpace();
    return;
  }

  if (lastBannerRequestAt > 0 && Date.now() - lastBannerRequestAt < minimumBannerRequestIntervalMs) {
    scheduleBannerRetry();
    return;
  }

  cancelBannerRetry();
  activeBannerMargin = nextMargin;
  lastBannerRequestAt = Date.now();
  bannerCreated = true;
  bannerVisible = true;
  bannerLoaded = false;
  applyBannerSpace();
  try {
    await AdMob.showBanner({
      adId: bannerId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: activeBannerMargin,
      isTesting: testMode,
    });
  } catch (error) {
    await removeBannerView().catch(() => undefined);
    scheduleBannerRetry();
    throw error;
  }
}

function queueBannerSynchronization(): Promise<void> {
  bannerOperation = bannerOperation.catch(() => undefined).then(synchronizeBanner);
  return bannerOperation;
}

function queueBannerRemoval(): Promise<void> {
  bannerOperation = bannerOperation.catch(() => undefined).then(removeBannerView);
  return bannerOperation;
}

export function setMobileBannerVisible(visible: boolean): Promise<void> {
  desiredBannerVisible = visible;
  const synchronization = queueBannerSynchronization();
  if (!visible) {
    clearBannerSpace();
    return bannerCreated ? synchronization : Promise.resolve();
  }
  return synchronization;
}

export function setMobileAdsAppActive(active: boolean): Promise<void> {
  appActive = active;
  const synchronization = queueBannerSynchronization();
  if (!active) {
    clearBannerSpace();
    return bannerCreated ? synchronization : Promise.resolve();
  }
  return synchronization;
}

export async function showMobilePrivacyOptions(): Promise<MobileAdsState> {
  await initializeMobileAds();
  if (!currentState.native) return currentState;

  currentState = {
    ...currentState,
    canRequestAds: false,
    message: 'Ads are paused while privacy choices update.',
  };
  await queueBannerRemoval().catch(() => undefined);

  try {
    await AdMob.showPrivacyOptionsForm();
    const consent = await AdMob.requestConsentInfo(consentRequestOptions);
    if (consent.canRequestAds) await ensureAdsSdkInitialized();
    currentState = {
      ...currentState,
      ready: adsSdkInitialized,
      canRequestAds: consent.canRequestAds,
      privacyOptionsRequired: privacyRequired(consent),
      message: consent.canRequestAds ? undefined : 'Ads remain off until privacy choices allow requests.',
    };
  } catch {
    initialization = undefined;
    currentState = {
      ...currentState,
      ready: adsSdkInitialized,
      canRequestAds: false,
      message: 'Privacy choices could not be refreshed. Ads will stay off until the next successful check.',
    };
  }

  await queueBannerSynchronization().catch(() => undefined);
  return currentState;
}

export async function shutdownMobileAds(): Promise<void> {
  desiredBannerVisible = false;
  appActive = false;
  cancelBannerRetry();
  await queueBannerSynchronization().catch(() => undefined);
  await removeBannerView().catch(() => undefined);
  await bannerSizeListener?.remove();
  await bannerLoadedListener?.remove();
  await bannerFailedListener?.remove();
  bannerSizeListener = undefined;
  bannerLoadedListener = undefined;
  bannerFailedListener = undefined;
  if (resizeListenerInstalled) window.removeEventListener('resize', handleViewportResize);
  resizeListenerInstalled = false;
  initialization = undefined;
  initializationFailed = false;
  currentState = initialMobileAdsState;
  appActive = true;
}
