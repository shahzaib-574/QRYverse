import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
  type AdmobConsentInfo,
} from '@capacitor-community/admob';

const googleAndroidTestBannerId = 'ca-app-pub-3940256099942544/9214589741';
const configuredBannerId = import.meta.env.VITE_ADMOB_BANNER_ID?.trim();
const testMode = import.meta.env.VITE_ADMOB_TEST_MODE !== 'false' || !configuredBannerId;
const bannerId = configuredBannerId || googleAndroidTestBannerId;
const testDevices = (import.meta.env.VITE_ADMOB_TEST_DEVICE_IDS ?? '')
  .split(',')
  .map((value: string) => value.trim())
  .filter(Boolean);

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
let currentState = initialMobileAdsState;
let bannerVisible = false;
let desiredBannerVisible = false;
let bannerOperation: Promise<void> = Promise.resolve();
let adsSdkInitialized = false;
let bannerSizeListener: PluginListenerHandle | undefined;
let bannerHeight = 0;
let activeBannerMargin = 0;
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

  try {
    let consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm();
    }

    if (consent.canRequestAds) await ensureAdsSdkInitialized();

    currentState = {
      native: true,
      ready: adsSdkInitialized,
      canRequestAds: consent.canRequestAds,
      privacyOptionsRequired: privacyRequired(consent),
      usingTestAds: testMode,
      message: consent.canRequestAds ? undefined : 'Ads remain off until privacy choices allow requests.',
    };
  } catch (error) {
    currentState = {
      native: true,
      ready: false,
      canRequestAds: false,
      privacyOptionsRequired: false,
      usingTestAds: testMode,
      message: error instanceof Error ? error.message : 'Mobile ads are unavailable.',
    };
  }
  return currentState;
}

async function ensureAdsSdkInitialized(): Promise<void> {
  if (adsSdkInitialized) return;
  await AdMob.initialize({
    initializeForTesting: testMode && testDevices.length > 0,
    testingDevices: testMode ? testDevices : [],
    maxAdContentRating: MaxAdContentRating.General,
  });
  adsSdkInitialized = true;
  bannerSizeListener ??= await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    bannerHeight = Math.max(0, Math.min(180, Math.ceil(size.height)));
    applyBannerSpace();
  });
  if (!resizeListenerInstalled) {
    window.addEventListener('resize', handleViewportResize);
    resizeListenerInstalled = true;
  }
}

function bannerMargin(): number {
  return window.matchMedia('(min-width: 720px)').matches ? 16 : 96;
}

function applyBannerSpace(): void {
  if (!bannerVisible && !desiredBannerVisible) {
    document.documentElement.style.setProperty('--ad-space', '0px');
    return;
  }
  const layoutMargin = window.matchMedia('(min-width: 720px)').matches ? 16 : 96;
  const extraMargin = Math.max(0, activeBannerMargin - layoutMargin);
  document.documentElement.style.setProperty('--ad-space', `${Math.max(50, bannerHeight) + extraMargin + 8}px`);
}

function handleViewportResize(): void {
  applyBannerSpace();
  if (!bannerVisible || activeBannerMargin === bannerMargin() || layoutChangeQueued) return;
  layoutChangeQueued = true;
  bannerOperation = bannerOperation.catch(() => undefined).then(async () => {
    if (bannerVisible) {
      await AdMob.removeBanner();
      bannerVisible = false;
      bannerHeight = 0;
    }
    await synchronizeBanner();
  }).finally(() => { layoutChangeQueued = false; });
}

export function initializeMobileAds(): Promise<MobileAdsState> {
  initialization ??= startMobileAds();
  return initialization;
}

async function synchronizeBanner(): Promise<void> {
  await initializeMobileAds();
  const shouldShow = desiredBannerVisible
    && currentState.native
    && currentState.ready
    && currentState.canRequestAds;

  if (shouldShow === bannerVisible) {
    if (!shouldShow) document.documentElement.style.setProperty('--ad-space', '0px');
    return;
  }

  if (shouldShow) {
    activeBannerMargin = bannerMargin();
    await AdMob.showBanner({
      adId: bannerId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: activeBannerMargin,
      isTesting: testMode,
    });
    bannerVisible = true;
    applyBannerSpace();
    return;
  }

  try {
    await AdMob.removeBanner();
  } finally {
    bannerVisible = false;
    bannerHeight = 0;
    activeBannerMargin = 0;
    document.documentElement.style.setProperty('--ad-space', '0px');
  }
}

function queueBannerSynchronization(): Promise<void> {
  bannerOperation = bannerOperation.catch(() => undefined).then(synchronizeBanner);
  return bannerOperation;
}

export function setMobileBannerVisible(visible: boolean): Promise<void> {
  desiredBannerVisible = visible;
  return queueBannerSynchronization();
}

export async function showMobilePrivacyOptions(): Promise<MobileAdsState> {
  await initializeMobileAds();
  if (!currentState.native) return currentState;
  await AdMob.showPrivacyOptionsForm();
  const consent = await AdMob.requestConsentInfo();
  if (consent.canRequestAds) await ensureAdsSdkInitialized();
  currentState = {
    ...currentState,
    ready: adsSdkInitialized,
    canRequestAds: consent.canRequestAds,
    privacyOptionsRequired: privacyRequired(consent),
    message: consent.canRequestAds ? undefined : 'Ads remain off until privacy choices allow requests.',
  };
  await queueBannerSynchronization();
  return currentState;
}

export async function shutdownMobileAds(): Promise<void> {
  desiredBannerVisible = false;
  await queueBannerSynchronization();
  await bannerSizeListener?.remove();
  bannerSizeListener = undefined;
  if (resizeListenerInstalled) window.removeEventListener('resize', handleViewportResize);
  resizeListenerInstalled = false;
}
