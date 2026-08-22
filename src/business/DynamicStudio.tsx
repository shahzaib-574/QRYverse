import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import QRCode from 'qrcode';
import { BarChart3, ChevronRight, Download, ExternalLink, Globe2, Link2, Pause, Pencil, Play, Plus, QrCode, Trash2, Upload, X } from 'lucide-react';
import { exportQrImage, exportTextFile } from '../lib/share';
import { normaliseHttpUrl } from '../lib/qr';
import type { HostedCampaign } from '../cloud/client';
import { businessBackupJson, campaignPayload, campaignScanCount, makeBusinessId, parseBusinessBackup, recordCampaignScan, type BusinessState, type BusinessStateChange, type DynamicCampaign } from './store';

export type HostedCampaignBridge = {
  publicBaseUrl: string;
  upsert: (campaign: DynamicCampaign) => Promise<HostedCampaign>;
  remove: (id: string) => Promise<void>;
};

export function DynamicStudio({ state, onState, onNotice, onOpen, cloud }: { state: BusinessState; onState: (state: BusinessStateChange) => boolean; onNotice: (message: string) => void; onOpen: (destination: string) => void; cloud?: HostedCampaignBridge }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DynamicCampaign>();
  const totalScans = state.campaigns.reduce((sum, campaign) => sum + campaignScanCount(campaign), 0);
  const active = state.campaigns.filter((campaign) => campaign.active).length;
  const top = [...state.campaigns].sort((a, b) => campaignScanCount(b) - campaignScanCount(a))[0];
  const remove = async (campaign: DynamicCampaign) => {
    const scope = campaign.hosted ? 'the hosted redirect and its aggregate analytics' : 'this local campaign';
    if (!window.confirm(`Delete “${campaign.name}”? This permanently removes ${scope}. Printed QR codes may stop working.`)) return;
    try {
      if (campaign.hosted && cloud) await cloud.remove(campaign.id);
      if (!onState((current) => ({ ...current, campaigns: current.campaigns.filter((item) => item.id !== campaign.id) }))) return;
      onNotice(campaign.hosted ? 'Hosted campaign deleted' : 'Local campaign deleted');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Campaign could not be deleted'); }
  };
  const toggle = async (campaign: DynamicCampaign) => {
    const changed = { ...campaign, active: !campaign.active };
    try {
      if (campaign.hosted && cloud) {
        const next = withHosted(changed, await cloud.upsert(changed));
        onState((current) => ({ ...current, campaigns: current.campaigns.map((item) => item.id === campaign.id ? next : item) }));
      } else {
        onState((current) => ({ ...current, campaigns: current.campaigns.map((item) => item.id === campaign.id ? { ...item, active: !item.active } : item) }));
      }
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Campaign status could not be changed'); }
  };
  const save = async (campaign: DynamicCampaign, editingCampaign: boolean) => {
    try {
      const next = cloud ? withHosted(campaign, await cloud.upsert(campaign)) : campaign;
      if (!onState((current) => ({ ...current, campaigns: editingCampaign ? current.campaigns.map((item) => item.id === next.id ? next : item) : [next, ...current.campaigns] }))) return;
      setCreating(false); setEditing(undefined);
      onNotice(cloud ? 'Hosted campaign published' : editingCampaign ? 'Campaign destination updated' : 'Dynamic campaign created');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Campaign could not be published'); }
  };
  const preview = (campaign: DynamicCampaign) => {
    if (!campaign.active) { onNotice('This campaign is paused'); return; }
    onState((current) => recordCampaignScan(current, campaign.id, 'preview'));
    onOpen(campaign.destination);
  };
  const exportBackup = async () => {
    try {
      await exportTextFile(`qryverse-studio-backup-${new Date().toISOString().slice(0, 10)}.json`, businessBackupJson(state), 'application/json');
      onNotice('Studio backup ready');
    } catch { onNotice('Studio backup could not be exported'); }
  };
  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Studio backup files are limited to 2 MB.');
      const restored = parseBusinessBackup(await file.text());
      if (!window.confirm(`Replace local Studio data with ${restored.campaigns.length} backed-up campaign${restored.campaigns.length === 1 ? '' : 's'}? Export the current backup first if you may need it.`)) return;
      if (!onState(restored)) return;
      onNotice('Studio campaigns and settings restored');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Studio backup could not be restored'); }
  };
  return <>
    <section className="campaign-console">
      <div className="campaign-console-head"><span><small>DYNAMIC QR</small><h2>Campaign control</h2><p>Edit destinations without changing the printed QRY code.</p></span><button onClick={() => setCreating(true)}><Plus /> New</button></div>
      <div className="campaign-kpis"><span><strong>{state.campaigns.length}</strong><small>Campaigns</small></span><span><strong>{active}</strong><small>Active</small></span><span><strong>{totalScans}</strong><small>Scans</small></span></div>
      <div className="campaign-backup-actions"><button onClick={() => void exportBackup()}><Download /> Export backup</button><label><Upload /> Restore backup<input type="file" accept=".json,application/json" onChange={(event) => void restoreBackup(event)} /></label><small>Back up before reinstalling or clearing app data so printed local campaign codes remain recoverable.</small></div>
      {state.campaigns.length ? <div className="campaign-list">{state.campaigns.map((campaign) => <div key={campaign.id}><span className="campaign-swatch" style={{ background: campaign.color }}><QrCode /></span><button className="campaign-main" onClick={() => preview(campaign)}><strong>{campaign.name}</strong><small>{campaign.hosted?.publicUrl ?? campaign.destination}</small><em>{campaign.active ? `${campaignScanCount(campaign)} scans${campaign.hosted ? ' · Hosted' : ''}` : 'Paused'}</em></button><span className="campaign-actions"><button onClick={() => setEditing(campaign)} aria-label={`Edit ${campaign.name}`}><Pencil /></button><button onClick={() => void toggle(campaign)} aria-label={campaign.active ? `Pause ${campaign.name}` : `Activate ${campaign.name}`}>{campaign.active ? <Pause /> : <Play />}</button><button className="danger" onClick={() => void remove(campaign)} aria-label={`Delete ${campaign.name}`}><Trash2 /></button></span></div>)}</div> : <button className="campaign-empty" onClick={() => setCreating(true)}><Link2 /><strong>Create your first dynamic campaign</strong><small>The QR stays stable while its destination remains editable in QRY.</small></button>}
    </section>
    <section className="analytics-console">
      <div className="analytics-head"><BarChart3 /><span><strong>Privacy-conscious analytics</strong><small>Only QRY-routed campaign scans are counted</small></span></div>
      <div className="analytics-bars">{state.campaigns.slice(0, 5).map((campaign) => <div key={campaign.id}><span>{campaign.name}</span><i><b style={{ width: `${totalScans ? Math.max(5, campaignScanCount(campaign) / totalScans * 100) : 0}%` }} /></i><strong>{campaignScanCount(campaign)}</strong></div>)}</div>
      {!state.campaigns.length && <p>No campaign scans yet.</p>}
      {top && <p>Top campaign: <strong>{top.name}</strong> with {campaignScanCount(top)} scans.</p>}
    </section>
    {creating && <CampaignSheet hostedBaseUrl={cloud?.publicBaseUrl} onClose={() => setCreating(false)} onCreate={(campaign) => save(campaign, false)} onNotice={onNotice} />}
    {editing && <CampaignSheet initial={editing} hostedBaseUrl={cloud?.publicBaseUrl} onClose={() => setEditing(undefined)} onCreate={(campaign) => save(campaign, true)} onNotice={onNotice} />}
  </>;
}

function CampaignSheet({ initial, hostedBaseUrl, onClose, onCreate, onNotice }: { initial?: DynamicCampaign; hostedBaseUrl?: string; onClose: () => void; onCreate: (campaign: DynamicCampaign) => void | Promise<void>; onNotice: (message: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [color, setColor] = useState(initial?.color ?? '#173f35');
  const [generatedQr, setGeneratedQr] = useState<{ payload: string; color: string; url: string }>();
  const id = useMemo(() => initial?.id ?? makeBusinessId(), [initial?.id]);
  const resolvedSlug = slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const payload = hostedBaseUrl && resolvedSlug ? `${hostedBaseUrl.replace(/\/+$/, '')}/r/${resolvedSlug}` : campaignPayload(id);
  const qr = generatedQr?.payload === payload && generatedQr.color === color ? generatedQr.url : '';
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, { width: 600, margin: 3, errorCorrectionLevel: 'H', color: { dark: color, light: '#fffdf7' } })
      .then((url) => { if (active) setGeneratedQr({ payload, color, url }); })
      .catch(() => { if (active) setGeneratedQr(undefined); });
    return () => { active = false; };
  }, [payload, color]);
  const safeDestination = normaliseHttpUrl(destination);
  const valid = Boolean(name.trim() && safeDestination);
  const create = () => onCreate({ id, name: name.trim(), destination: safeDestination, slug: resolvedSlug, color, active: initial?.active ?? true, scans: initial?.scans ?? [], localTotalScans: initial?.localTotalScans ?? initial?.scans.length ?? 0, createdAt: initial?.createdAt ?? Date.now(), hosted: initial?.hosted });
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={initial ? 'Edit dynamic campaign' : 'Create dynamic campaign'}>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close" />
      <section className="bottom-sheet campaign-sheet">
        <div className="sheet-handle" />
        <button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>
        <span className="sheet-kicker">DYNAMIC QR</span>
        <h2>{initial ? 'Edit campaign' : 'Create a campaign'}</h2>
        <p>Its QRY payload stays permanent while you edit the destination.</p>
        <div className="campaign-form">
          <label><span>Campaign name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer menu" /></label>
          <label><span>Destination</span><div><Globe2 /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="https://example.com/menu" /></div></label>
          <label><span>Short slug</span><div><Link2 /><input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="summer-menu" /></div></label>
        </div>
        <div className="campaign-preview">
          <div>{qr && <img src={qr} alt="Dynamic QR preview" />}</div>
          <span>
            <strong>{payload}</strong>
            <small>{hostedBaseUrl ? 'Hosted redirect · Aggregate analytics' : 'App-routed dynamic code · Local analytics'}</small>
            <button disabled={!qr} onClick={async () => { if (!qr) return; try { await exportQrImage(qr); onNotice('Campaign QR ready to share'); } catch { onNotice('Campaign QR could not be exported'); } }}><Download /> Export QR</button>
          </span>
        </div>
        <div className="campaign-palette">
          {['#173f35', '#172d5b', '#672c3f', '#2f2b46', '#a64f2d'].map((item) => (
            <button key={item} aria-label={`Use color ${item}`} aria-pressed={color === item} className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)} />
          ))}
        </div>
        <button className="solid-button full" disabled={!valid || !qr} onClick={() => void create()}>
          {initial ? 'Save destination' : hostedBaseUrl ? 'Publish dynamic code' : 'Create dynamic code'} <ChevronRight />
        </button>
        <p className="hosted-boundary"><ExternalLink /> {hostedBaseUrl ? 'Published links count only daily aggregate scans; IP addresses are not retained.' : 'This app-routed code works with QRYverse and keeps its campaign data on this device.'}</p>
      </section>
    </div>
  );
}

function withHosted(campaign: DynamicCampaign, hosted: HostedCampaign): DynamicCampaign {
  return { ...campaign, name: hosted.name, slug: hosted.slug, destination: hosted.destination, color: hosted.color, active: hosted.active, hosted: { publicUrl: hosted.publicUrl, totalScans: hosted.totalScans, lastScanAt: hosted.lastScanAt, updatedAt: hosted.updatedAt } };
}
