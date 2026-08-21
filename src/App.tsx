import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  ClipboardCheck,
  CloudOff,
  Check,
  ChevronRight,
  Copy,
  Crown,
  CreditCard,
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
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { analysePayload, createPayload, labelForKind, type CreateMode, type ScanAnalysis } from './lib/qr';
import { confirmSuccessfulScan, scanImageFromGallery, scanWithDevice } from './lib/scanner';
import { exportQrImage } from './lib/share';
import { exportTextFile } from './lib/share';
import { clearDiagnostics, diagnosticsExport, readDiagnostics } from './lib/diagnostics';
import { initializeBilling, purchasePlan, restoreBilling, type BillingSnapshot } from './lib/billing';
import {
  makeId,
  readHistory,
  readPreferences,
  writeHistory,
  writePreferences,
  type Preferences,
  type SavedItem,
} from './lib/storage';
import { Track } from './track/Track';
import { parseTrackPayload, readTrackCollections, writeTrackCollections, type TrackCollection } from './track/store';
import { useI18n } from './i18n/LocaleProvider';
import { DynamicStudio } from './business/DynamicStudio';
import { parseCampaignPayload, readBusinessState, recordCampaignScan, writeBusinessState, type BusinessState } from './business/store';
import './business/business.css';

type Tab = 'home' | 'create' | 'library' | 'track' | 'studio';

const demoPayload = 'https://qry.app/welcome';

export default function App() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('home');
  const [history, setHistory] = useState<SavedItem[]>(readHistory);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [collections, setCollections] = useState<TrackCollection[]>(readTrackCollections);
  const [business, setBusiness] = useState<BusinessState>(readBusinessState);
  const [scanSheet, setScanSheet] = useState(false);
  const [result, setResult] = useState<{ payload: string; analysis: ScanAnalysis }>();
  const [detectedCodes, setDetectedCodes] = useState<string[]>([]);
  const [trackTarget, setTrackTarget] = useState<{ collectionId: string; recordId: string }>();
  const [billing, setBilling] = useState<BillingSnapshot>({ status: 'loading', pro: false, plans: [] });
  const [toast, setToast] = useState<string>();
  const routeRef = useRef<(payload: string, source?: 'camera' | 'app_link') => void>(() => undefined);

  useEffect(() => writeHistory(history), [history]);
  useEffect(() => writePreferences(preferences), [preferences]);
  useEffect(() => writeTrackCollections(collections), [collections]);
  useEffect(() => writeBusinessState(business), [business]);
  useEffect(() => { initializeBilling().then(setBilling); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addItem = (payload: string, source: SavedItem['source']) => {
    const analysis = analysePayload(payload);
    setHistory((current) => [{
      id: makeId(),
      payload,
      title: analysis.title,
      kind: analysis.kind,
      risk: analysis.risk,
      source,
      createdAt: Date.now(),
      favourite: false,
    }, ...current.filter((item) => item.payload !== payload)]);
  };

  const showResult = (payload: string, source: 'camera' | 'app_link' = 'camera') => {
    const trackRecord = parseTrackPayload(payload);
    if (trackRecord) {
      setTrackTarget(trackRecord);
      setTab('track');
      return;
    }
    const campaignId = parseCampaignPayload(payload);
    if (campaignId) {
      const campaign = business.campaigns.find((item) => item.id === campaignId);
      if (!campaign) { setToast('This QRY campaign is not available on this device'); return; }
      if (!campaign.active) { setToast('This QRY campaign is paused'); return; }
      setBusiness((current) => recordCampaignScan(current, campaignId, source));
      const analysis = analysePayload(campaign.destination);
      setResult({ payload: campaign.destination, analysis });
      if (preferences.autoSave) addItem(campaign.destination, 'scan');
      return;
    }
    const analysis = analysePayload(payload);
    setResult({ payload, analysis });
    if (preferences.autoSave) addItem(payload, 'scan');
  };
  routeRef.current = showResult;

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    CapacitorApp.getLaunchUrl().then((event) => { if (!disposed && event?.url) routeRef.current(event.url, 'app_link'); }).catch(() => undefined);
    CapacitorApp.addListener('appUrlOpen', (event) => routeRef.current(event.url, 'app_link')).then((handle) => { removeListener = () => handle.remove(); }).catch(() => undefined);
    return () => { disposed = true; void removeListener?.(); };
  }, []);

  const handleDetected = async (values: string[]) => {
    await confirmSuccessfulScan(preferences.haptics);
    if (values.length === 1) showResult(values[0]);
    else setDetectedCodes(values);
  };

  const beginScan = async () => {
    const outcome = await scanWithDevice();
    if (outcome.status === 'success') await handleDetected(outcome.values);
    if (outcome.status === 'unavailable') {
      setToast(outcome.message);
      setScanSheet(true);
    }
  };

  const scanGallery = async () => {
    const outcome = await scanImageFromGallery();
    if (outcome.status === 'success') await handleDetected(outcome.values);
    if (outcome.status === 'unavailable') setToast(outcome.message);
  };

  const toggleFavourite = (id: string) => {
    setHistory((items) => items.map((item) => item.id === id ? { ...item, favourite: !item.favourite } : item));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('home')} aria-label="Go home">
          <Logo />
          <span>QRY</span>
        </button>
        <button className="plan-pill" onClick={() => setTab('studio')}>
          <Sparkles size={14} /> {billing.pro ? 'Track Pro' : t('Free plan')}
        </button>
      </header>

      <main className="main-content">
        {tab === 'home' && (
          <Home
            history={history}
            onScan={beginScan}
            onPaste={() => setScanSheet(true)}
            onGallery={scanGallery}
            onOpen={(item) => showResult(item.payload)}
            onCreate={() => setTab('create')}
            onLibrary={() => setTab('library')}
            onTrack={() => setTab('track')}
          />
        )}
        {tab === 'create' && (
          <Create
            onSaved={(payload) => {
              addItem(payload, 'created');
              setToast('Saved to your library');
            }}
            onNotice={setToast}
          />
        )}
        {tab === 'library' && (
          <Library
            items={history}
            onOpen={(item) => showResult(item.payload)}
            onFavourite={toggleFavourite}
            onDelete={(id) => setHistory((items) => items.filter((item) => item.id !== id))}
          />
        )}
        {tab === 'studio' && (
          <Studio
            preferences={preferences}
            onPreferences={setPreferences}
            billing={billing}
            onPurchase={async (id) => setBilling(await purchasePlan(id))}
            onRestore={async () => setBilling(await restoreBilling())}
            onNotice={setToast}
            business={business}
            onBusiness={setBusiness}
            onOpenDestination={(destination) => showResult(destination)}
          />
        )}
        {tab === 'track' && (
          <Track
            collections={collections}
            onCollections={setCollections}
            target={trackTarget}
            onTargetHandled={() => setTrackTarget(undefined)}
            onNotice={setToast}
            pro={billing.pro}
            business={business}
            onBusiness={setBusiness}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === 'home'} label={t('Home')} icon={<HomeIcon />} onClick={() => setTab('home')} />
        <NavButton active={tab === 'create'} label={t('Create')} icon={<Plus />} onClick={() => setTab('create')} />
        <button className="scan-fab" onClick={beginScan} aria-label="Scan QR code">
          <ScanLine />
        </button>
        <NavButton active={tab === 'library'} label={t('Library')} icon={<LayoutGrid />} onClick={() => setTab('library')} />
        <NavButton active={tab === 'track'} label={t('Track')} icon={<ClipboardCheck />} onClick={() => setTab('track')} />
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
          analysis={result.analysis}
          onClose={() => setResult(undefined)}
          onSave={() => {
            addItem(result.payload, 'scan');
            setToast('Saved to your library');
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
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Home({ history, onScan, onPaste, onGallery, onOpen, onCreate, onLibrary, onTrack }: {
  history: SavedItem[];
  onScan: () => void;
  onPaste: () => void;
  onGallery: () => void;
  onOpen: (item: SavedItem) => void;
  onCreate: () => void;
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
          <QuickCard icon={<Link2 />} title={t('Website')} detail={t('Open any link')} tone="sage" onClick={onCreate} />
          <QuickCard icon={<Wifi />} title={t('Wi-Fi')} detail={t('Join in one scan')} tone="peach" onClick={onCreate} />
          <QuickCard icon={<UserRound />} title={t('Contact')} detail={t('Share your details')} tone="lilac" onClick={onCreate} />
          <QuickCard icon={<MoreHorizontal />} title={t('More')} detail={t('Text, email & more')} tone="sand" onClick={onCreate} />
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading row">
          <div><span>{t('Your space')}</span><h2>{t('Recent activity')}</h2></div>
          {recent.length > 0 && <button className="see-all" onClick={onLibrary}>{t('See all')} <ChevronRight size={16} /></button>}
        </div>
        {recent.length === 0 ? (
          <button className="empty-card" onClick={() => onOpen({
            id: 'demo', payload: demoPayload, title: 'qry.app', kind: 'link', risk: 'clear', source: 'scan', createdAt: Date.now(), favourite: false,
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

function Create({ onSaved, onNotice }: { onSaved: (payload: string) => void; onNotice: (message: string) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<CreateMode>('link');
  const [fields, setFields] = useState<Record<string, string>>({ security: 'WPA', hidden: 'false' });
  const [color, setColor] = useState('#173f35');
  const [dataUrl, setDataUrl] = useState('');
  const payload = useMemo(() => createPayload(mode, fields), [mode, fields]);

  useEffect(() => {
    if (!payload) {
      setDataUrl('');
      return;
    }
    QRCode.toDataURL(payload, {
      width: 720,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: color, light: '#fffdf7' },
    }).then(setDataUrl).catch(() => setDataUrl(''));
  }, [payload, color]);

  const update = (name: string, value: string) => setFields((current) => ({ ...current, [name]: value }));

  return (
    <div className="screen create-screen">
      <div className="page-title"><span>{t('Create')}</span><h1>{t('Make your code')}</h1><p>{t('Simple, sharp, and yours to keep.')}</p></div>

      <div className="mode-tabs">
        {(['link', 'wifi', 'contact', 'text'] as CreateMode[]).map((item) => (
          <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
            {item === 'link' ? <Link2 /> : item === 'wifi' ? <Wifi /> : item === 'contact' ? <UserRound /> : <QrCode />}
            {item === 'link' ? t('Website') : item === 'text' ? t('Text') : item === 'wifi' ? t('Wi-Fi') : t('Contact')}
          </button>
        ))}
      </div>

      <div className="creator-card">
        <div className="form-stack">
          {mode === 'link' && <Field label={t('Website address')} value={fields.url ?? ''} placeholder="yourwebsite.com" onChange={(v) => update('url', v)} icon={<Globe2 />} />}
          {mode === 'text' && <TextField label={t('Text message')} value={fields.text ?? ''} placeholder="Type anything you want to share…" onChange={(v) => update('text', v)} />}
          {mode === 'wifi' && <>
            <Field label={t('Network name')} value={fields.ssid ?? ''} placeholder="Office Wi-Fi" onChange={(v) => update('ssid', v)} icon={<Wifi />} />
            <Field label={t('Password')} value={fields.password ?? ''} placeholder="Wi-Fi password" onChange={(v) => update('password', v)} icon={<LockKeyhole />} type="password" />
            <label className="select-field"><span>{t('Security')}</span><select value={fields.security} onChange={(e) => update('security', e.target.value)}><option>WPA</option><option>WEP</option><option value="nopass">No password</option></select></label>
          </>}
          {mode === 'contact' && <>
            <Field label={t('Full name')} value={fields.name ?? ''} placeholder="Your name" onChange={(v) => update('name', v)} icon={<UserRound />} />
            <Field label={t('Phone')} value={fields.phone ?? ''} placeholder="+1 555 0123" onChange={(v) => update('phone', v)} icon={<Copy />} type="tel" />
            <Field label={t('Email')} value={fields.email ?? ''} placeholder="hello@example.com" onChange={(v) => update('email', v)} icon={<Mail />} type="email" />
          </>}
        </div>

        <div className="qr-preview-wrap">
          <div className="qr-preview">
            {dataUrl ? <img src={dataUrl} alt="Generated QR code preview" /> : <div className="qr-placeholder"><QrCode /><span>{t('Your QR preview')}</span></div>}
          </div>
          <div className="palette-row" aria-label="QR color">
            {['#173f35', '#172d5b', '#672c3f', '#2f2b46'].map((item) => <button key={item} aria-label={`Use color ${item}`} className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)} />)}
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
        <button className="solid-button" disabled={!payload} onClick={() => onSaved(payload)}><Bookmark /> {t('Save code')}</button>
      </div>
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
      <label className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search your library')} /></label>
      <div className="filter-pills">
        {(['all', 'scan', 'created', 'favourite'] as const).map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item === 'all' ? t('All') : item === 'scan' ? t('Scanned') : item === 'created' ? t('Created') : t('Starred')}</button>)}
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
            <button className={`icon-button ${item.favourite ? 'active' : ''}`} onClick={() => onFavourite(item.id)} aria-label="Toggle favourite"><Star fill={item.favourite ? 'currentColor' : 'none'} /></button>
            <button className="icon-button danger" onClick={() => onDelete(item.id)} aria-label="Delete item"><Trash2 /></button>
          </div>
        ))}</div>
      )}
      <p className="storage-caption"><LockKeyhole /> {t('Stored locally on this device · Up to 100 items')}</p>
    </div>
  );
}

function Studio({ preferences, onPreferences, billing, onPurchase, onRestore, onNotice, business, onBusiness, onOpenDestination }: {
  preferences: Preferences;
  onPreferences: (value: Preferences) => void;
  billing: BillingSnapshot;
  onPurchase: (id: string) => Promise<void>;
  onRestore: () => Promise<void>;
  onNotice: (message: string) => void;
  business: BusinessState;
  onBusiness: (state: BusinessState) => void;
  onOpenDestination: (destination: string) => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const [diagnosticCount, setDiagnosticCount] = useState(() => readDiagnostics().length);
  return (
    <div className="screen studio-screen">
      <div className="studio-hero">
        <span className="studio-kicker"><Crown /> QRY Studio</span>
        <h1>{t('Your codes.')}<br /><em>{t('Working harder.')}</em></h1>
        <p>A focused workspace for campaigns, menus, events, and every scan in between.</p>
        <span className="coming-pill">Business preview</span>
      </div>

      <div className="studio-feature-grid">
        <FeatureCard icon={<Zap />} title="Dynamic codes" text="Change the destination without reprinting." />
        <FeatureCard icon={<BarChart3 />} title="Clear analytics" text="Understand when and where people scan." />
        <FeatureCard icon={<Sparkles />} title="Your branding" text="Custom colors, domains, and campaign pages." />
        <FeatureCard icon={<UserRound />} title="Team spaces" text="Organize work across clients and locations." />
      </div>

      <DynamicStudio state={business} onState={onBusiness} onNotice={onNotice} onOpen={onOpenDestination} />

      <div className="roadmap-card">
        <div className="roadmap-head"><span><small>HOSTED SERVICES</small><strong>Cloud activation boundary</strong></span><span className="status-dot">Optional</span></div>
        <ul>
          <li><Check /> Local editable destinations and scan counts work now</li>
          <li><Check /> Alerts, reports, workflow packs, and local role staging work now</li>
          <li><CloudOff /> Cross-device sync requires authentication and tenant isolation</li>
          <li><CloudOff /> Public redirects and custom domains require hosted DNS and routing</li>
        </ul>
        <p>QRY does not simulate cloud delivery. Connection endpoints can be staged in Track automation settings and activated only after infrastructure review.</p>
      </div>

      <div className="billing-card">
        <div className="settings-title"><CreditCard /><span><strong>{billing.pro ? 'Track Pro is active' : t('Upgrade QRY Track')}</strong><small>{billing.pro ? 'Higher limits are unlocked on this account' : t('More workspaces, records, and workflow packs')}</small></span></div>
        {billing.status === 'ready' && billing.plans.length > 0 ? (
          <div className="billing-plans">{billing.plans.map((plan) => <button key={plan.id} disabled={billing.pro} onClick={() => onPurchase(plan.id)}><span><strong>{plan.title}</strong><small>{plan.period}</small></span><b>{plan.price}</b></button>)}</div>
        ) : billing.status === 'loading' ? (
          <p className="billing-message">Checking available plans…</p>
        ) : (
          <div className="billing-unconfigured"><CloudOff /><span><strong>{t('Store connection not configured')}</strong><small>Add the public RevenueCat Android key to activate live Play plans. No purchase can start in this build.</small></span></div>
        )}
        {billing.message && <p className="billing-error">{billing.message}</p>}
        <button className="restore-button" disabled={billing.status === 'unconfigured'} onClick={onRestore}><RefreshCw /> {t('Restore purchases')}</button>
      </div>

      <div className="settings-card">
        <div className="settings-title"><Settings /><span><strong>{t('Local preferences')}</strong><small>{t('Controls that work in this build')}</small></span></div>
        <label className="language-row"><span><strong>{t('Language')}</strong><small>English / اردو</small></span><select value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'ur')}><option value="en">English</option><option value="ur">اردو</option></select></label>
        <ToggleRow label={t('Save scans automatically')} detail={t('Keep successful scans in your library')} checked={preferences.autoSave} onChange={(checked) => onPreferences({ ...preferences, autoSave: checked })} />
        <ToggleRow label={t('Haptic feedback')} detail={t('Confirm successful scans on supported devices')} checked={preferences.haptics} onChange={(checked) => onPreferences({ ...preferences, haptics: checked })} />
      </div>

      <div className="settings-card diagnostics-card">
        <div className="settings-title"><FileText /><span><strong>{t('Private diagnostics')}</strong><small>{diagnosticCount ? `${diagnosticCount} event${diagnosticCount === 1 ? '' : 's'} stored locally` : t('No errors recorded')}</small></span></div>
        <p>Diagnostics exclude scan values, Track records, contact details, and browsing history.</p>
        <div>
          <button disabled={!diagnosticCount} onClick={async () => {
            await exportTextFile('qry-diagnostics.json', diagnosticsExport(), 'application/json');
            onNotice('Diagnostic export ready');
          }}><Download /> Export</button>
          <button disabled={!diagnosticCount} onClick={() => { clearDiagnostics(); setDiagnosticCount(0); onNotice('Local diagnostics cleared'); }}><Trash2 /> Clear</button>
        </div>
      </div>
    </div>
  );
}

function ResultSheet({ analysis, onClose, onSave, onCopy }: {
  analysis: ScanAnalysis;
  onClose: () => void;
  onSave: () => void;
  onCopy: () => void;
}) {
  const riskIcon = analysis.risk === 'clear' ? <ShieldCheck /> : <ShieldAlert />;
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
          {analysis.actionHref ? (
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
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
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

function Field({ label, value, placeholder, icon, onChange, type = 'text' }: { label: string; value: string; placeholder: string; icon: React.ReactNode; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><div>{icon}<input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div></label>;
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="feature-card"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>;
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
