import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  ClipboardCheck,
  ChevronRight,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  History,
  Home as HomeIcon,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  MoreHorizontal,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShieldAlert,
  SunMoon,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { analysePayload, contactPayloadToVcard, createPayload, labelForKind, type CreateMode, type ScanAnalysis } from './lib/qr';
import { confirmSuccessfulScan, openScannerSettings, scanImageFromGallery, scanWithDevice } from './lib/scanner';
import { exportQrImage } from './lib/share';
import { exportTextFile } from './lib/share';
import { clearDiagnostics, diagnosticsExport, readDiagnostics } from './lib/diagnostics';
import { lastItem } from './lib/collections';
import { initializeBilling, type BillingSnapshot } from './lib/billing';
import {
  initialMobileAdsState,
  initializeMobileAds,
  setMobileAdsAppActive,
  setMobileBannerVisible,
  showMobilePrivacyOptions,
  shutdownMobileAds,
  type MobileAdsState,
} from './lib/ads';
import {
  makeId,
  readHistory,
  readPreferences,
  LocalStorageWriteError,
  upsertHistoryItem,
  writeHistory,
  writePreferences,
  type Preferences,
  type SavedItem,
} from './lib/storage';
import { Track } from './track/Track';
import { parseTrackPayload, readTrackCollections, TrackStorageError, writeTrackCollections, type TrackCollection, type TrackCollectionsChange } from './track/store';
import { useI18n } from './i18n/LocaleProvider';
import { DynamicStudio } from './business/DynamicStudio';
import { BusinessStorageError, parseCampaignPayload, readBusinessState, recordCampaignScan, writeBusinessState, type BusinessState, type BusinessStateChange } from './business/store';
import { CloudClient, cloudAccountAvailable, cloudErrorMessage, defaultCloudApiBase, type HostedCampaign } from './cloud/client';
import { CloudAccountCard, type CloudViewState } from './cloud/CloudAccountCard';
import { RemoteSyncAdapter } from './sync/remote';
import type { SyncEnvelope } from './sync/types';
import './business/business.css';

type Tab = 'home' | 'create' | 'library' | 'track' | 'studio';
type ToastValue = string | { message: string; actionLabel: string; onAction: () => void };

const demoPayload = 'https://example.com/qry-welcome';

export default function App() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('home');
  const [createMode, setCreateMode] = useState<CreateMode>('link');
  const [history, setHistory] = useState<SavedItem[]>(readHistory);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [collections, setCollections] = useState<TrackCollection[]>(readTrackCollections);
  const [business, setBusiness] = useState<BusinessState>(readBusinessState);
  const [scanSheet, setScanSheet] = useState(false);
  const [result, setResult] = useState<{ payload: string; analysis: ScanAnalysis }>();
  const [detectedCodes, setDetectedCodes] = useState<string[]>([]);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [trackTarget, setTrackTarget] = useState<{ collectionId: string; recordId: string }>();
  const [billing, setBilling] = useState<BillingSnapshot>({ status: 'loading', pro: false, plans: [] });
  const [ads, setAds] = useState<MobileAdsState>(initialMobileAdsState);
  const [cloud, setCloud] = useState<CloudViewState>(() => ({ status: 'disconnected', apiBase: readCloudApiBase(), remoteVersion: 0, remoteUpdatedAt: 0 }));
  const [toast, setToast] = useState<ToastValue>();
  const routeRef = useRef<(payload: string, source?: 'camera' | 'app_link') => Promise<void>>(async () => undefined);
  const cloudClientRef = useRef<CloudClient | undefined>(undefined);
  const tabHistoryRef = useRef<Tab[]>([]);
  const historyRef = useRef(history);
  const businessRef = useRef(business);
  const collectionsRef = useRef(collections);

  const updateHistory = (change: SavedItem[] | ((current: SavedItem[]) => SavedItem[])): boolean => {
    const next = typeof change === 'function' ? change(historyRef.current) : change;
    try {
      writeHistory(next);
      historyRef.current = next;
      setHistory(next);
      return true;
    } catch (error) {
      setToast(error instanceof LocalStorageWriteError ? error.message : 'This Library change could not be saved.');
      return false;
    }
  };

  const updatePreferences = (next: Preferences): boolean => {
    try {
      writePreferences(next);
      setPreferences(next);
      return true;
    } catch (error) {
      setToast(error instanceof LocalStorageWriteError ? error.message : 'This preference could not be saved.');
      return false;
    }
  };

  const updateBusiness = (change: BusinessState | ((current: BusinessState) => BusinessState)): boolean => {
    const next = typeof change === 'function' ? change(businessRef.current) : change;
    try {
      writeBusinessState(next);
      businessRef.current = next;
      setBusiness(next);
      return true;
    } catch (error) {
      setToast(error instanceof BusinessStorageError ? error.message : 'This Studio change could not be saved.');
      return false;
    }
  };

  const updateCollections = (change: TrackCollectionsChange): boolean => {
    const next = typeof change === 'function' ? change(collectionsRef.current) : change;
    if (next === collectionsRef.current) return true;
    try {
      writeTrackCollections(next);
      collectionsRef.current = next;
      setCollections(next);
      return true;
    } catch (error) {
      setToast(error instanceof TrackStorageError ? error.message : 'This Track change could not be saved.');
      return false;
    }
  };

  useEffect(() => { initializeBilling().then(setBilling); }, []);
  useEffect(() => {
    if (preferences.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);
  useEffect(() => {
    if (!toast || typeof toast !== 'string') return;
    const timer = window.setTimeout(() => setToast(undefined), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (billing.status === 'loading') return;
    void initializeMobileAds().then(setAds);
  }, [billing.status]);

  useEffect(() => {
    const shouldShow = !billing.pro && (tab === 'home' || tab === 'library') && !scannerBusy && !scanSheet && !result && detectedCodes.length === 0;
    void setMobileBannerVisible(shouldShow).catch(() => undefined);
  }, [ads.canRequestAds, billing.pro, detectedCodes.length, result, scanSheet, scannerBusy, tab]);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      void setMobileAdsAppActive(isActive).catch(() => undefined);
      if (isActive) void initializeMobileAds().then(setAds);
    }).then((handle) => { removeListener = () => handle.remove(); }).catch(() => undefined);
    return () => { void removeListener?.(); };
  }, []);

  useEffect(() => () => { void shutdownMobileAds(); }, []);

  const navigateTo = (next: Tab) => {
    setTab((current) => {
      if (current === next) return current;
      tabHistoryRef.current.push(current);
      if (tabHistoryRef.current.length > 12) tabHistoryRef.current.shift();
      return next;
    });
  };

  const restoreCurrentPageFocus = () => {
    window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('.main-content .screen h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('.main-content .screen h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  }, [tab]);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;
    CapacitorApp.addListener('backButton', () => {
      const dialog = lastItem(document.querySelectorAll<HTMLElement>('.modal-layer'));
      if (dialog) {
        dialog.querySelector<HTMLButtonElement>('.close-button, .modal-backdrop')?.click();
        return;
      }
      const nestedBack = document.querySelector<HTMLButtonElement>('.track-back');
      if (nestedBack && nestedBack.offsetParent !== null) {
        nestedBack.click();
        return;
      }
      setTab((current) => {
        if (current === 'home') {
          void CapacitorApp.exitApp();
          return current;
        }
        return tabHistoryRef.current.pop() ?? 'home';
      });
    }).then((handle) => { removeListener = () => handle.remove(); }).catch(() => undefined);
    return () => { void removeListener?.(); };
  }, []);

  useEffect(() => installDialogAccessibility(), []);

  const addItem = (payload: string, source: SavedItem['source']): boolean => {
    const analysis = analysePayload(payload);
    return updateHistory((current) => upsertHistoryItem(current, {
      id: makeId(),
      payload,
      title: analysis.title,
      kind: analysis.kind,
      risk: analysis.risk,
      source,
      createdAt: Date.now(),
      favourite: false,
    }));
  };

  const showResult = async (payload: string, source: 'camera' | 'app_link' = 'camera') => {
    const trackRecord = parseTrackPayload(payload);
    if (trackRecord) {
      setTrackTarget(trackRecord);
      navigateTo('track');
      return;
    }
    const campaignId = parseCampaignPayload(payload);
    if (campaignId) {
      const campaign = business.campaigns.find((item) => item.id === campaignId);
      if (!campaign) { setToast('This QRY campaign is not available on this device'); return; }
      if (!campaign.active) { setToast('This QRY campaign is paused'); return; }
      updateBusiness((current) => recordCampaignScan(current, campaignId, source));
      const analysis = analysePayload(campaign.destination);
      await setMobileBannerVisible(false).catch(() => undefined);
      setResult({ payload: campaign.destination, analysis });
      if (preferences.autoSave) addItem(campaign.destination, 'scan');
      return;
    }
    if (/^qry:\/\/(?:track|go)(?:\/|$)/i.test(payload.trim())) {
      setToast('Invalid QRY link');
      return;
    }
    const analysis = analysePayload(payload);
    await setMobileBannerVisible(false).catch(() => undefined);
    setResult({ payload, analysis });
    if (preferences.autoSave) addItem(payload, 'scan');
  };
  routeRef.current = showResult;

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    CapacitorApp.getLaunchUrl().then((event) => { if (!disposed && event?.url) void routeRef.current(event.url, 'app_link'); }).catch(() => undefined);
    CapacitorApp.addListener('appUrlOpen', (event) => { void routeRef.current(event.url, 'app_link'); }).then((handle) => { removeListener = () => handle.remove(); }).catch(() => undefined);
    return () => { disposed = true; void removeListener?.(); };
  }, []);

  const handleDetected = async (values: string[]) => {
    await confirmSuccessfulScan(preferences.haptics);
    if (values.length === 1) await showResult(values[0]);
    else {
      await setMobileBannerVisible(false).catch(() => undefined);
      setDetectedCodes(values);
    }
  };

  const openPaste = async () => {
    await setMobileBannerVisible(false).catch(() => undefined);
    setScanSheet(true);
  };

  const beginScan = async () => {
    setScannerBusy(true);
    try {
      await setMobileBannerVisible(false).catch(() => undefined);
      const outcome = await scanWithDevice();
      if (outcome.status === 'success') await handleDetected(outcome.values);
      if (outcome.status === 'unavailable') {
        setToast(outcome.message);
        setScanSheet(true);
      }
      if (outcome.status === 'permission-denied') {
        setToast({ message: outcome.message, actionLabel: 'Open settings', onAction: () => { void openScannerSettings().catch(() => setToast('Android settings could not be opened')); } });
      }
    } finally {
      setScannerBusy(false);
    }
  };

  const scanGallery = async () => {
    setScannerBusy(true);
    try {
      await setMobileBannerVisible(false).catch(() => undefined);
      const outcome = await scanImageFromGallery();
      if (outcome.status === 'success') await handleDetected(outcome.values);
      if (outcome.status === 'unavailable') setToast(outcome.message);
    } finally {
      setScannerBusy(false);
    }
  };

  const toggleFavourite = (id: string) => {
    updateHistory((items) => items.map((item) => item.id === id ? { ...item, favourite: !item.favourite } : item));
  };

  const authenticateCloud = async (mode: 'login' | 'register', input: { apiBase: string; name: string; email: string; password: string; organizationName: string }) => {
    if (!cloudAccountAvailable()) {
      cloudClientRef.current = undefined;
      setCloud({ status: 'disconnected', apiBase: '', remoteVersion: 0, remoteUpdatedAt: 0, message: 'Cloud is not enabled in this release. Offline features remain available.', messageKind: 'status' });
      return;
    }
    setCloud((current) => ({ ...current, status: 'working', apiBase: input.apiBase, message: undefined, messageKind: undefined }));
    try {
      const client = new CloudClient(input.apiBase);
      const session = mode === 'register' ? await client.register(input) : await client.login(input.email, input.password);
      client.setToken(session.token);
      cloudClientRef.current = client;
      localStorage.setItem('qry.cloud.api.v1', client.apiBase);
      const remote = await client.getSync<SyncEnvelope>();
      const hosted = await client.listCampaigns();
      updateBusiness((current) => mergeHostedCampaigns(current, hosted));
      setCloud({ status: 'connected', apiBase: client.apiBase, session, remoteVersion: remote.version, remoteUpdatedAt: remote.updatedAt, message: remote.version ? 'Cloud backup found. Pull it explicitly to replace this device data.' : 'Connected. This device has not been backed up yet.', messageKind: 'status' });
    } catch (error) {
      cloudClientRef.current = undefined;
      setCloud((current) => ({ ...current, status: 'disconnected', session: undefined, message: cloudErrorMessage(error), messageKind: 'error' }));
    }
  };

  const logoutCloud = async () => {
    setCloud((current) => ({ ...current, status: 'working', message: undefined, messageKind: undefined }));
    try { await cloudClientRef.current?.logout(); } catch { /* The local session is still cleared. */ }
    cloudClientRef.current = undefined;
    setCloud((current) => ({ status: 'disconnected', apiBase: current.apiBase, remoteVersion: 0, remoteUpdatedAt: 0, message: 'Cloud session ended. Local data remains on this device.', messageKind: 'status' }));
  };

  const pushCloud = async () => {
    const client = cloudClientRef.current;
    if (!client || !cloud.session) return;
    setCloud((current) => ({ ...current, status: 'working', message: undefined, messageKind: undefined }));
    try {
      const adapter = new RemoteSyncAdapter(client, cloud.remoteVersion);
      const result = await adapter.push(makeSyncEnvelope(collections, business));
      if (result.status === 'conflict') {
        setCloud((current) => ({ ...current, status: 'connected', remoteVersion: result.remoteVersion ?? adapter.remoteVersion, message: 'Cloud data changed elsewhere. Pull it before attempting another backup.', messageKind: 'status' }));
        return;
      }
      setCloud((current) => ({ ...current, status: 'connected', remoteVersion: result.remoteVersion ?? adapter.remoteVersion, remoteUpdatedAt: Date.now(), message: 'This device snapshot is now backed up.', messageKind: 'status' }));
    } catch (error) { setCloud((current) => ({ ...current, status: 'connected', message: cloudErrorMessage(error), messageKind: 'error' })); }
  };

  const pullCloud = async () => {
    const client = cloudClientRef.current;
    if (!client || !cloud.session) return;
    if (!window.confirm('Replace the local QRYverse business snapshot with the latest cloud backup? Local changes that are not backed up will be lost.')) return;
    setCloud((current) => ({ ...current, status: 'working', message: undefined, messageKind: undefined }));
    try {
      const adapter = new RemoteSyncAdapter(client, cloud.remoteVersion);
      const result = await adapter.pull(makeSyncEnvelope(collections, business));
      if (adapter.remoteVersion === 0) {
        setCloud((current) => ({ ...current, status: 'connected', message: 'No cloud backup exists yet. Use Back up now to create one.', messageKind: 'status' }));
        return;
      }
      const previousCollections = collections;
      if (!updateCollections(result.envelope.collections)) {
        setCloud((current) => ({ ...current, status: 'connected', message: 'The cloud backup was not applied because it exceeds safe local storage.', messageKind: 'error' }));
        return;
      }
      if (!updateBusiness(result.envelope.business)) {
        updateCollections(previousCollections);
        setCloud((current) => ({ ...current, status: 'connected', message: 'The cloud backup was not applied because its business data exceeds safe local storage.', messageKind: 'error' }));
        return;
      }
      setCloud((current) => ({ ...current, status: 'connected', remoteVersion: adapter.remoteVersion, remoteUpdatedAt: result.envelope.updatedAt, message: 'Cloud data was applied to this device.', messageKind: 'status' }));
    } catch (error) { setCloud((current) => ({ ...current, status: 'connected', message: cloudErrorMessage(error), messageKind: 'error' })); }
  };

  const refreshHostedCampaigns = async () => {
    const client = cloudClientRef.current;
    if (!client || !cloud.session) return;
    setCloud((current) => ({ ...current, status: 'working', message: undefined, messageKind: undefined }));
    try {
      const hosted = await client.listCampaigns();
      updateBusiness((current) => mergeHostedCampaigns(current, hosted));
      setCloud((current) => ({ ...current, status: 'connected', message: `Refreshed ${hosted.length} hosted campaign${hosted.length === 1 ? '' : 's'}.`, messageKind: 'status' }));
    } catch (error) { setCloud((current) => ({ ...current, status: 'connected', message: cloudErrorMessage(error), messageKind: 'error' })); }
  };

  const deleteCloudAccount = async () => {
    const client = cloudClientRef.current;
    if (!client || !cloud.session) return;
    setCloud((current) => ({ ...current, status: 'working', message: undefined, messageKind: undefined }));
    try {
      await client.deleteAccount();
      cloudClientRef.current = undefined;
      setCloud((current) => ({ status: 'disconnected', apiBase: current.apiBase, remoteVersion: 0, remoteUpdatedAt: 0, message: 'Cloud account and hosted data were permanently deleted. Local device data remains.', messageKind: 'status' }));
      setToast('Cloud account deleted');
    } catch (error) {
      setCloud((current) => ({ ...current, status: 'connected', message: cloudErrorMessage(error), messageKind: 'error' }));
      throw error;
    }
  };

  const campaignCloud = cloud.session && cloudClientRef.current ? {
    publicBaseUrl: cloud.session.service.publicBaseUrl,
    upsert: (campaign: BusinessState['campaigns'][number]) => cloudClientRef.current!.upsertCampaign(campaign),
    remove: (id: string) => cloudClientRef.current!.deleteCampaign(id),
  } : undefined;

  const deleteLibraryItem = (id: string) => {
    const index = history.findIndex((item) => item.id === id);
    const removed = history[index];
    if (!removed) return;
    if (!updateHistory((items) => items.filter((item) => item.id !== id))) return;
    setToast({
      message: `Removed ${removed.title}`,
      actionLabel: 'Undo',
      onAction: () => {
        if (updateHistory((items) => {
          if (items.some((item) => item.id === removed.id)) return items;
          const restored = [...items];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return restored;
        })) setToast('Item restored');
      },
    });
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => navigateTo('home')} aria-label="Go home">
          <Logo />
          <span>QRY</span>
        </button>
        <button
          className="plan-pill"
          onClick={() => navigateTo('studio')}
          aria-label="Open QRY Studio and settings"
          aria-current={tab === 'studio' ? 'page' : undefined}
        >
          <Sparkles size={14} /> {billing.pro ? 'Studio Pro' : 'Studio'}
        </button>
      </header>

      <main className="main-content" id="main-content">
        {tab === 'home' && (
          <Home
            history={history}
            onScan={beginScan}
            onPaste={() => { void openPaste(); }}
            onGallery={scanGallery}
            onOpen={(item) => showResult(item.payload)}
            onCreate={(mode) => { setCreateMode(mode); navigateTo('create'); }}
            onLibrary={() => navigateTo('library')}
            onTrack={() => navigateTo('track')}
          />
        )}
        {tab === 'create' && (
          <Create
            initialMode={createMode}
            onModeChange={setCreateMode}
            onSaved={(payload) => {
              if (addItem(payload, 'created')) setToast('Saved to your library');
            }}
            onNotice={setToast}
          />
        )}
        {tab === 'library' && (
          <Library
            items={history}
            onOpen={(item) => showResult(item.payload)}
            onFavourite={toggleFavourite}
            onDelete={deleteLibraryItem}
          />
        )}
        {tab === 'studio' && (
          <Studio
            preferences={preferences}
            onPreferences={updatePreferences}
            onNotice={setToast}
            business={business}
            onBusiness={updateBusiness}
            onOpenDestination={(destination) => showResult(destination)}
            cloud={cloud}
            onCloudAuthenticate={authenticateCloud}
            onCloudLogout={logoutCloud}
            onCloudPull={pullCloud}
            onCloudPush={pushCloud}
            onCloudRefreshCampaigns={refreshHostedCampaigns}
            onCloudDeleteAccount={deleteCloudAccount}
            campaignCloud={campaignCloud}
            ads={ads}
            onPrivacyOptions={async () => {
              try {
                setAds(await showMobilePrivacyOptions());
              } catch {
                setToast('Privacy choices are not available yet');
              }
            }}
          />
        )}
        {tab === 'track' && (
          <Track
            collections={collections}
            onCollections={updateCollections}
            target={trackTarget}
            onTargetHandled={() => setTrackTarget(undefined)}
            onNotice={setToast}
            business={business}
            onBusiness={updateBusiness}
          />
        )}
      </main>

      <div className="mobile-ad-rail" aria-hidden="true" />
      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === 'home'} label={t('Home')} icon={<HomeIcon />} onClick={() => navigateTo('home')} />
        <NavButton active={tab === 'create'} label={t('Create')} icon={<Plus />} onClick={() => navigateTo('create')} />
        <button className="scan-fab" onClick={beginScan} aria-label="Scan QR code">
          <ScanLine />
          <span>Scan</span>
        </button>
        <NavButton active={tab === 'library'} label={t('Library')} icon={<LayoutGrid />} onClick={() => navigateTo('library')} />
        <NavButton active={tab === 'track'} label={t('Track')} icon={<ClipboardCheck />} onClick={() => navigateTo('track')} />
      </nav>

      {scanSheet && (
        <PasteSheet
          onClose={() => setScanSheet(false)}
          onSubmit={(value) => {
            setScanSheet(false);
            showResult(value);
          }}
        />
      )}
      {result && (
        <ResultSheet
          payload={result.payload}
          analysis={result.analysis}
          onNotice={(message) => setToast(message)}
          onClose={() => setResult(undefined)}
          onSave={() => {
            if (addItem(result.payload, 'scan')) setToast('Saved to your library');
          }}
          onCopy={() => copyText(result.payload, setToast)}
        />
      )}
      {detectedCodes.length > 1 && (
        <MultiCodeSheet
          values={detectedCodes}
          onClose={() => setDetectedCodes([])}
          onSelect={(value) => {
            setDetectedCodes([]);
            showResult(value);
          }}
        />
      )}
      {toast && <div className="toast" role="status" aria-live="polite">
        <span>{typeof toast === 'string' ? toast : toast.message}</span>
        {typeof toast !== 'string' && <>
          <button className="toast-action" onClick={() => {
            const currentToast = toast;
            toast.onAction();
            setToast((value) => value === currentToast ? undefined : value);
            restoreCurrentPageFocus();
          }}>{toast.actionLabel}</button>
          <button className="toast-dismiss" onClick={() => { setToast(undefined); restoreCurrentPageFocus(); }} aria-label="Dismiss notification"><X /></button>
        </>}
      </div>}
    </div>
  );
}

function Home({ history, onScan, onPaste, onGallery, onOpen, onCreate, onLibrary, onTrack }: {
  history: SavedItem[];
  onScan: () => void;
  onPaste: () => void;
  onGallery: () => void;
  onOpen: (item: SavedItem) => void;
  onCreate: (mode: CreateMode) => void;
  onLibrary: () => void;
  onTrack: () => void;
}) {
  const { t } = useI18n();
  const recent = history.slice(0, 3);
  return (
    <div className="screen home-screen">
      <section className="hero-card">
        <div className="eyebrow"><ShieldCheck size={15} /> {t('Private by design')}</div>
        <h1>{t('Point. Scan.')}<br /><em>{t('Know first.')}</em></h1>
        <p>{t('See where a code leads before you follow it. Your scans stay on this device.')}</p>
        <button className="primary-cta" onClick={onScan}>
          <span className="cta-icon"><ScanLine /></span>
          <span><strong>{t('Scan a QR code')}</strong><small>{t('Camera opens only when you ask')}</small></span>
          <ArrowRight />
        </button>
        <div className="hero-utility-row">
          <button className="text-action" onClick={onGallery}><ImageIcon size={15} /> {t('Scan from photo')}</button>
          <button className="text-action" onClick={onPaste}><Copy size={15} /> {t('Paste a value')}</button>
        </div>
        <div className="hero-decoration" aria-hidden="true"><QrCode /></div>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><span>{t('Quick create')}</span><h2>{t('Make something useful')}</h2></div></div>
        <div className="quick-grid">
          <QuickCard icon={<Link2 />} title={t('Website')} detail={t('Open any link')} tone="sage" onClick={() => onCreate('link')} />
          <QuickCard icon={<Wifi />} title={t('Wi-Fi')} detail={t('Join in one scan')} tone="peach" onClick={() => onCreate('wifi')} />
          <QuickCard icon={<UserRound />} title={t('Contact')} detail={t('Share your details')} tone="lilac" onClick={() => onCreate('contact')} />
          <QuickCard icon={<MoreHorizontal />} title={t('More')} detail={t('Create a plain text code')} tone="sand" onClick={() => onCreate('text')} />
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading row">
          <div><span>{t('Your space')}</span><h2>{t('Recent activity')}</h2></div>
          {recent.length > 0 && <button className="see-all" onClick={onLibrary}>{t('See all')} <ChevronRight size={16} /></button>}
        </div>
        {recent.length === 0 ? (
          <button className="empty-card" onClick={() => onOpen({
            id: 'demo', payload: demoPayload, title: 'example.com', kind: 'link', risk: 'clear', source: 'scan', createdAt: Date.now(), favourite: false,
          })}>
            <span className="empty-icon"><History /></span>
            <span><strong>{t('Your scans will live here')}</strong><small>{t('Try a safe preview with our sample code.')}</small></span>
            <ChevronRight />
          </button>
        ) : recent.map((item) => <HistoryRow key={item.id} item={item} onClick={() => onOpen(item)} />)}
      </section>

      <button className="studio-banner" onClick={onTrack}>
        <span className="banner-icon"><BarChart3 /></span>
        <span><small>NEW · QRY TRACK</small><strong>{t('Turn scans into actions')}</strong><p>{t('Assets, attendance and inventory—offline.')}</p></span>
        <ChevronRight />
      </button>
    </div>
  );
}

function Create({ initialMode, onModeChange, onSaved, onNotice }: { initialMode: CreateMode; onModeChange: (mode: CreateMode) => void; onSaved: (payload: string) => void; onNotice: (message: string) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<CreateMode>(initialMode);
  const [fields, setFields] = useState<Record<string, string>>({ security: 'WPA', hidden: 'false' });
  const [color, setColor] = useState('#173f35');
  const [generatedQr, setGeneratedQr] = useState<{ payload: string; color: string; url: string }>();
  const payload = useMemo(() => createPayload(mode, fields), [mode, fields]);
  const dataUrl = generatedQr?.payload === payload && generatedQr.color === color ? generatedQr.url : '';

  useEffect(() => {
    if (!payload) {
      setGeneratedQr(undefined);
      return;
    }
    let active = true;
    QRCode.toDataURL(payload, {
      width: 720,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: color, light: '#fffdf7' },
    }).then((url) => { if (active) setGeneratedQr({ payload, color, url }); }).catch(() => { if (active) setGeneratedQr(undefined); });
    return () => { active = false; };
  }, [payload, color]);

  const update = (name: string, value: string) => setFields((current) => ({ ...current, [name]: value }));

  return (
    <div className="screen create-screen">
      <div className="page-title"><span>{t('Create')}</span><h1>{t('Make your code')}</h1><p>{t('Simple, sharp, and yours to keep.')}</p></div>

      <div className="mode-tabs">
        {(['link', 'wifi', 'contact', 'text'] as CreateMode[]).map((item) => (
          <button key={item} className={mode === item ? 'active' : ''} aria-pressed={mode === item} onClick={() => { setMode(item); onModeChange(item); }}>
            {item === 'link' ? <Link2 /> : item === 'wifi' ? <Wifi /> : item === 'contact' ? <UserRound /> : <QrCode />}
            {item === 'link' ? t('Website') : item === 'text' ? t('Text') : item === 'wifi' ? t('Wi-Fi') : t('Contact')}
          </button>
        ))}
      </div>

      <div className="creator-card">
        <div className="form-stack">
          {mode === 'link' && <Field label={t('Website address')} value={fields.url ?? ''} placeholder="yourwebsite.com" onChange={(v) => update('url', v)} icon={<Globe2 />} inputMode="url" autoComplete="url" required invalid={Boolean(fields.url?.trim()) && !payload} describedBy={!payload ? 'creator-validation' : undefined} />}
          {mode === 'text' && <TextField label={t('Text message')} value={fields.text ?? ''} placeholder="Type anything you want to share…" onChange={(v) => update('text', v)} required invalid={Boolean(fields.text) && !payload} describedBy={!payload ? 'creator-validation' : undefined} />}
          {mode === 'wifi' && <>
            <Field label={t('Network name')} value={fields.ssid ?? ''} placeholder="Office Wi-Fi" onChange={(v) => update('ssid', v)} icon={<Wifi />} required invalid={Boolean(fields.ssid) && !payload} describedBy={!payload ? 'creator-validation' : undefined} />
            <Field label={t('Password')} value={fields.password ?? ''} placeholder="Wi-Fi password" onChange={(v) => update('password', v)} icon={<LockKeyhole />} type="password" />
            <label className="select-field"><span>{t('Security')}</span><select value={fields.security} onChange={(e) => update('security', e.target.value)}><option>WPA</option><option>WEP</option><option value="nopass">No password</option></select></label>
          </>}
          {mode === 'contact' && <div className="contact-field-group" role="group" aria-label="Contact details; at least one required" aria-invalid={!payload} aria-describedby={!payload ? 'creator-validation' : undefined}>
            <p className="field-group-label">Contact details · at least one required</p>
            <Field label={t('Full name')} value={fields.name ?? ''} placeholder="Your name" onChange={(v) => update('name', v)} icon={<UserRound />} autoComplete="name" />
            <Field label={t('Phone')} value={fields.phone ?? ''} placeholder="+1 555 0123" onChange={(v) => update('phone', v)} icon={<Copy />} type="tel" autoComplete="tel" />
            <Field label={t('Email')} value={fields.email ?? ''} placeholder="hello@example.com" onChange={(v) => update('email', v)} icon={<Mail />} type="email" autoComplete="email" />
          </div>}
        </div>

        <div className="qr-preview-wrap">
          <div className="qr-preview">
            {dataUrl ? <img src={dataUrl} alt="Generated QR code preview" /> : <div className="qr-placeholder"><QrCode /><span>{t('Your QR preview')}</span></div>}
          </div>
          <div className="palette-row" aria-label="QR color">
            {['#173f35', '#172d5b', '#672c3f', '#2f2b46'].map((item) => <button key={item} aria-label={`Use color ${item}`} aria-pressed={color === item} className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)} />)}
          </div>
        </div>
      </div>

      <div className="create-actions">
        <button className="secondary-button" disabled={!dataUrl} onClick={async () => {
          if (!dataUrl) return;
          try {
            const outcome = await exportQrImage(dataUrl);
            onNotice(outcome === 'shared' ? 'Ready to share or save' : 'QR image downloaded');
          } catch {
            onNotice('Could not export the QR image');
          }
        }}><Download /> {t('Export')}</button>
        <button className="solid-button" disabled={!dataUrl} onClick={() => onSaved(payload)}><Bookmark /> {t('Save code')}</button>
      </div>
      {!payload && <p className="creator-validation" id="creator-validation" role="status">{mode === 'wifi' ? 'Enter a network name to generate this code.' : mode === 'contact' ? 'Enter at least one contact detail to generate this code.' : mode === 'link' && fields.url ? 'Enter a valid HTTP or HTTPS website address.' : 'Enter content to generate this code.'}</p>}
      <p className="privacy-note"><LockKeyhole size={14} /> {t('Static codes are generated entirely on your device.')}</p>
    </div>
  );
}

function Library({ items, onOpen, onFavourite, onDelete }: {
  items: SavedItem[];
  onOpen: (item: SavedItem) => void;
  onFavourite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'scan' | 'created' | 'favourite'>('all');
  const filtered = items.filter((item) => {
    const filterMatches = filter === 'all' || item.source === filter || (filter === 'favourite' && item.favourite);
    return filterMatches && `${item.title} ${item.payload}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="screen library-screen">
      <div className="page-title"><span>{t('Library')}</span><h1>{t('Everything, organized')}</h1><p>{t('Your scans and creations stay close.')}</p></div>
      <label className="search-box"><Search /><input aria-label={t('Search your library')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search your library')} /></label>
      <div className="filter-pills">
        {(['all', 'scan', 'created', 'favourite'] as const).map((item) => <button className={filter === item ? 'active' : ''} aria-pressed={filter === item} key={item} onClick={() => setFilter(item)}>{item === 'all' ? t('All') : item === 'scan' ? t('Scanned') : item === 'created' ? t('Created') : t('Starred')}</button>)}
      </div>

      {filtered.length === 0 ? (
        <div className="library-empty"><span><ImageIcon /></span><h2>{items.length ? 'No matches found' : t('A calm, empty library')}</h2><p>{items.length ? 'Try another search or filter.' : t('Scanned and created codes will appear here.')}</p></div>
      ) : (
        <div className="library-list">{filtered.map((item) => (
          <div className="library-item" key={item.id}>
            <button className="library-main" onClick={() => onOpen(item)}>
              <KindIcon kind={item.kind} />
              <span><strong>{item.title}</strong><small>{labelForKind(item.kind)} · {relativeDate(item.createdAt)}</small></span>
            </button>
            <button className={`icon-button ${item.favourite ? 'active' : ''}`} onClick={() => onFavourite(item.id)} aria-label="Favourite" aria-pressed={item.favourite}><Star fill={item.favourite ? 'currentColor' : 'none'} /></button>
            <button className="icon-button danger" onClick={() => onDelete(item.id)} aria-label="Delete item"><Trash2 /></button>
          </div>
        ))}</div>
      )}
      <p className="storage-caption"><LockKeyhole /> {t('Stored locally on this device · Up to 100 items')}</p>
    </div>
  );
}

function Studio({ preferences, onPreferences, onNotice, business, onBusiness, onOpenDestination, cloud, onCloudAuthenticate, onCloudLogout, onCloudPull, onCloudPush, onCloudRefreshCampaigns, onCloudDeleteAccount, campaignCloud, ads, onPrivacyOptions }: {
  preferences: Preferences;
  onPreferences: (value: Preferences) => void;
  onNotice: (message: string) => void;
  business: BusinessState;
  onBusiness: (state: BusinessStateChange) => boolean;
  onOpenDestination: (destination: string) => void;
  cloud: CloudViewState;
  onCloudAuthenticate: (mode: 'login' | 'register', input: { apiBase: string; name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  onCloudLogout: () => Promise<void>;
  onCloudPull: () => Promise<void>;
  onCloudPush: () => Promise<void>;
  onCloudRefreshCampaigns: () => Promise<void>;
  onCloudDeleteAccount: () => Promise<void>;
  campaignCloud?: { publicBaseUrl: string; upsert: (campaign: BusinessState['campaigns'][number]) => Promise<HostedCampaign>; remove: (id: string) => Promise<void> };
  ads: MobileAdsState;
  onPrivacyOptions: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [diagnosticCount, setDiagnosticCount] = useState(() => readDiagnostics().length);
  return (
    <div className="screen studio-screen">
      <div className="studio-hero">
        <span className="studio-kicker"><Crown /> QRY Studio</span>
        <h1>{t('Your codes.')}<br /><em>{t('Working harder.')}</em></h1>
        <p>A focused workspace for campaigns, menus, events, and every scan in between.</p>
        <span className="coming-pill">Business tools</span>
      </div>

      <div className="studio-feature-grid">
        <FeatureCard icon={<Zap />} title="Local campaigns" text="Create app-routed campaign codes with editable on-device destinations." />
        <FeatureCard icon={<BarChart3 />} title="Local scan counts" text="Review privacy-conscious campaign counts stored only on this device." />
        <FeatureCard icon={<Sparkles />} title="QR colors" text="Choose a distinct code color for each campaign." />
        <FeatureCard icon={<UserRound />} title="Team staging" text="Prepare member roles locally; connected invitations are not enabled yet." />
      </div>

      {cloudAccountAvailable() && <CloudAccountCard cloud={cloud} onAuthenticate={onCloudAuthenticate} onLogout={onCloudLogout} onPull={onCloudPull} onPush={onCloudPush} onRefreshCampaigns={onCloudRefreshCampaigns} onDeleteAccount={onCloudDeleteAccount} />}

      <DynamicStudio state={business} onState={onBusiness} onNotice={onNotice} onOpen={onOpenDestination} cloud={campaignCloud} />

      <div className="settings-card">
        <div className="settings-title"><Settings /><span><strong>{t('Local preferences')}</strong><small>{t('Controls that work in this build')}</small></span></div>
        <label className="language-row"><span><strong>Appearance</strong><small>Follow your device or choose a theme</small></span><SunMoon aria-hidden="true" /><select aria-label="Color theme" value={preferences.theme} onChange={(event) => onPreferences({ ...preferences, theme: event.target.value as Preferences['theme'] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <ToggleRow label={t('Save scans automatically')} detail={t('Keep successful scans in your library')} checked={preferences.autoSave} onChange={(checked) => onPreferences({ ...preferences, autoSave: checked })} />
        <ToggleRow label={t('Haptic feedback')} detail={t('Confirm successful scans on supported devices')} checked={preferences.haptics} onChange={(checked) => onPreferences({ ...preferences, haptics: checked })} />
      </div>

      <div className="settings-card ads-privacy-card">
        <div className="settings-title"><ShieldCheck /><span><strong>Ads & privacy</strong><small>{ads.native ? (ads.usingTestAds ? 'Android test ads · no live revenue' : 'Android production ads') : 'Browser preview stays ad-free'}</small></span></div>
        <p>{ads.message ?? 'The Android release may show one reserved banner on Home and Library. Ads never cover scanning, results, editing, account, consent, or deletion surfaces.'}</p>
        {ads.native && ads.privacyOptionsRequired && <button className="secondary-button privacy-options-button" onClick={() => void onPrivacyOptions()}><ShieldCheck /> Privacy choices</button>}
        <nav className="legal-links" aria-label="Legal and privacy links">
          <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
          <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a href="/account-deletion.html" target="_blank" rel="noreferrer">Delete local data</a>
        </nav>
      </div>

      <div className="settings-card diagnostics-card">
        <div className="settings-title"><FileText /><span><strong>{t('Private diagnostics')}</strong><small>{diagnosticCount ? `${diagnosticCount} event${diagnosticCount === 1 ? '' : 's'} stored locally` : t('No errors recorded')}</small></span></div>
        <p>Diagnostics exclude scan values, Track records, contact details, and browsing history.</p>
        <div>
          <button disabled={!diagnosticCount} onClick={async () => {
            try {
              await exportTextFile('qry-diagnostics.json', diagnosticsExport(), 'application/json');
              onNotice('Diagnostic export ready');
            } catch { onNotice('Diagnostic export could not be completed'); }
          }}><Download /> Export</button>
          <button disabled={!diagnosticCount} onClick={() => { if (clearDiagnostics()) { setDiagnosticCount(0); onNotice('Local diagnostics cleared'); } else onNotice('Diagnostics could not be cleared from device storage'); }}><Trash2 /> Clear</button>
        </div>
      </div>
    </div>
  );
}

function readCloudApiBase(): string {
  if (!cloudAccountAvailable()) return '';
  try { return localStorage.getItem('qry.cloud.api.v1') || defaultCloudApiBase(); } catch { return defaultCloudApiBase(); }
}

function makeSyncEnvelope(collections: TrackCollection[], business: BusinessState): SyncEnvelope {
  let deviceId = localStorage.getItem('qry.device.id');
  if (!deviceId) { deviceId = globalThis.crypto.randomUUID(); localStorage.setItem('qry.device.id', deviceId); }
  return { schemaVersion: 1, deviceId, updatedAt: Date.now(), collections, business };
}

function mergeHostedCampaigns(state: BusinessState, hosted: HostedCampaign[]): BusinessState {
  const local = new Map(state.campaigns.map((campaign) => [campaign.id, campaign]));
  const campaigns = hosted.map((item) => {
    const existing = local.get(item.id);
    local.delete(item.id);
    return { id: item.id, name: item.name, destination: item.destination, slug: item.slug, color: item.color, active: item.active, scans: existing?.scans ?? [], createdAt: item.createdAt, hosted: { publicUrl: item.publicUrl, totalScans: item.totalScans, lastScanAt: item.lastScanAt, updatedAt: item.updatedAt } };
  });
  return { ...state, campaigns: [...campaigns, ...local.values()] };
}

function ResultSheet({ payload, analysis, onClose, onSave, onCopy, onNotice }: {
  payload: string;
  analysis: ScanAnalysis;
  onClose: () => void;
  onSave: () => void;
  onCopy: () => void;
  onNotice: (message: string) => void;
}) {
  const riskIcon = analysis.risk === 'clear' ? <ShieldCheck /> : <ShieldAlert />;
  const contactVcard = analysis.kind === 'contact' ? contactPayloadToVcard(payload) : '';
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Scan result">
      <button className="modal-backdrop" onClick={onClose} aria-label="Close result" />
      <section className="bottom-sheet result-sheet">
        <div className="sheet-handle" />
        <div className="result-top">
          <KindIcon kind={analysis.kind} large />
          <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <span className="result-type">{labelForKind(analysis.kind)}</span>
        <h2>{analysis.title}</h2>
        <p className="result-value">{analysis.displayValue}</p>
        <div className={`risk-card ${analysis.risk}`}>
          {riskIcon}
          <span><strong>{analysis.riskTitle}</strong>{analysis.riskReasons.map((reason) => <small key={reason}>{reason}</small>)}</span>
        </div>
        <div className="result-actions">
          {analysis.kind === 'contact' && contactVcard ? (
            <button className="solid-button" onClick={async () => {
              try { await exportTextFile(`qryverse-contact-${Date.now()}.vcf`, contactVcard, 'text/vcard'); onNotice('Contact file ready'); }
              catch { onNotice('Contact file could not be exported'); }
            }}>
              {analysis.actionLabel} <Download />
            </button>
          ) : analysis.actionHref ? (
            <a className={`solid-button ${analysis.risk === 'danger' ? 'danger-action' : ''}`} href={analysis.actionHref} target={analysis.kind === 'link' ? '_blank' : undefined} rel="noreferrer">
              {analysis.actionLabel} <ExternalLink />
            </a>
          ) : <button className="solid-button" onClick={onCopy}>{analysis.actionLabel} <Copy /></button>}
          <button className="secondary-button" onClick={onSave}><Bookmark /> Save</button>
        </div>
        <button className="copy-raw" onClick={onCopy}><Copy /> Copy raw value</button>
      </section>
    </div>
  );
}

function PasteSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Paste QR value">
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
      <section className="bottom-sheet paste-sheet">
        <div className="sheet-handle" />
        <button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>
        <span className="sheet-kicker">Browser preview</span>
        <h2>Paste a QR value</h2>
        <p>Use a URL, Wi-Fi payload, contact card, or any text.</p>
        <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://example.com" />
        <button className="solid-button full" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>Inspect value <Eye /></button>
      </section>
    </div>
  );
}

function MultiCodeSheet({ values, onClose, onSelect }: { values: string[]; onClose: () => void; onSelect: (value: string) => void }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Choose detected QR code">
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
      <section className="bottom-sheet multi-sheet">
        <div className="sheet-handle" />
        <button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>
        <span className="sheet-kicker">Multiple codes found</span>
        <h2>Which one should we inspect?</h2>
        <div className="detected-list">
          {values.map((value) => {
            const analysis = analysePayload(value);
            return <button key={value} onClick={() => onSelect(value)}><KindIcon kind={analysis.kind} /><span><strong>{analysis.title}</strong><small>{analysis.displayValue}</small></span><ChevronRight /></button>;
          })}
        </div>
      </section>
    </div>
  );
}

function Logo() {
  return <span className="logo-mark"><i /><i /><i /><b /></span>;
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function QuickCard({ icon, title, detail, tone, onClick }: { icon: React.ReactNode; title: string; detail: string; tone: string; onClick: () => void }) {
  return <button className={`quick-card ${tone}`} onClick={onClick}><span>{icon}</span><strong>{title}</strong><small>{detail}</small><ChevronRight /></button>;
}

function HistoryRow({ item, onClick }: { item: SavedItem; onClick: () => void }) {
  return <button className="history-row" onClick={onClick}><KindIcon kind={item.kind} /><span><strong>{item.title}</strong><small>{labelForKind(item.kind)} · {relativeDate(item.createdAt)}</small></span><ChevronRight /></button>;
}

function KindIcon({ kind, large = false }: { kind: SavedItem['kind']; large?: boolean }) {
  const icon = kind === 'wifi' ? <Wifi /> : kind === 'contact' ? <UserRound /> : kind === 'email' ? <Mail /> : kind === 'location' ? <MapPin /> : kind === 'link' ? <Globe2 /> : <QrCode />;
  return <span className={`kind-icon kind-${kind} ${large ? 'large' : ''}`}>{icon}</span>;
}

function Field({ label, value, placeholder, icon, onChange, type = 'text', inputMode, autoComplete, required = false, invalid = false, describedBy }: { label: string; value: string; placeholder: string; icon: React.ReactNode; onChange: (value: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string; required?: boolean; invalid?: boolean; describedBy?: string }) {
  return <label className="field"><span>{label}{required ? ' (required)' : ''}</span><div className={invalid ? 'field-invalid' : undefined}>{icon}<input type={type} inputMode={inputMode} value={value} placeholder={placeholder} autoComplete={autoComplete} required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} /></div></label>;
}

function TextField({ label, value, placeholder, onChange, required = false, invalid = false, describedBy }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; required?: boolean; invalid?: boolean; describedBy?: string }) {
  return <label className="field"><span>{label}{required ? ' (required)' : ''}</span><textarea value={value} placeholder={placeholder} required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} /></label>;
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="feature-card"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>;
}

function installDialogAccessibility(): () => void {
  let activeDialog: HTMLElement | undefined;
  let restoreFocus: HTMLElement | null = null;
  let lastOutsideFocus: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const inerted = new Map<HTMLElement, boolean>();

  const clearInert = () => {
    for (const [element, previous] of inerted) element.inert = previous;
    inerted.clear();
  };

  const inertOutside = (dialog: HTMLElement) => {
    const root = document.getElementById('root');
    let activeBranch: HTMLElement | null = dialog;
    while (activeBranch && activeBranch !== root) {
      const parent: HTMLElement | null = activeBranch.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (!(sibling instanceof HTMLElement) || sibling === activeBranch) continue;
        if (!inerted.has(sibling)) inerted.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      activeBranch = parent;
    }
  };

  const sync = () => {
    const dialogs = [...document.querySelectorAll<HTMLElement>('.modal-layer[role="dialog"]')];
    const next = dialogs.at(-1);
    if (next === activeDialog) return;

    clearInert();
    if (!next) {
      document.body.style.removeProperty('overflow');
      activeDialog = undefined;
      restoreFocus?.focus({ preventScroll: true });
      restoreFocus = null;
      return;
    }

    if (!activeDialog) restoreFocus = lastOutsideFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    activeDialog = next;
    document.body.style.overflow = 'hidden';

    inertOutside(next);

    window.requestAnimationFrame(() => {
      const initial = next.querySelector<HTMLElement>('[autofocus]')
        ?? next.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
        ?? next.querySelector<HTMLElement>('.close-button, button:not(.modal-backdrop):not([disabled]), a[href]');
      initial?.focus({ preventScroll: true });
    });
  };

  const focusin = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && !event.target.closest('.modal-layer')) lastOutsideFocus = event.target;
  };

  const keydown = (event: KeyboardEvent) => {
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      activeDialog.querySelector<HTMLButtonElement>('.close-button, .modal-backdrop')?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...activeDialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary')]
      .filter((element) => element.offsetParent !== null && !element.classList.contains('modal-backdrop'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  document.addEventListener('keydown', keydown);
  document.addEventListener('focusin', focusin);
  sync();
  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('focusin', focusin);
    clearInert();
    document.body.style.removeProperty('overflow');
  };
}

function relativeDate(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

async function copyText(value: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    notify('Copied to clipboard');
  } catch {
    notify('Could not access the clipboard');
  }
}
