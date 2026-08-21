import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { BarChart3, ChevronRight, Download, ExternalLink, Globe2, Link2, Pause, Pencil, Play, Plus, QrCode, Trash2, X } from 'lucide-react';
import { exportQrImage } from '../lib/share';
import { campaignPayload, makeBusinessId, recordCampaignScan, type BusinessState, type DynamicCampaign } from './store';

export function DynamicStudio({ state, onState, onNotice, onOpen }: { state: BusinessState; onState: (state: BusinessState) => void; onNotice: (message: string) => void; onOpen: (destination: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DynamicCampaign>();
  const totalScans = state.campaigns.reduce((sum, campaign) => sum + campaign.scans.length, 0);
  const active = state.campaigns.filter((campaign) => campaign.active).length;
  const top = [...state.campaigns].sort((a, b) => b.scans.length - a.scans.length)[0];
  const remove = (id: string) => onState({ ...state, campaigns: state.campaigns.filter((campaign) => campaign.id !== id) });
  const toggle = (id: string) => onState({ ...state, campaigns: state.campaigns.map((campaign) => campaign.id === id ? { ...campaign, active: !campaign.active } : campaign) });
  const preview = (campaign: DynamicCampaign) => {
    if (!campaign.active) { onNotice('This campaign is paused'); return; }
    onState(recordCampaignScan(state, campaign.id, 'preview'));
    onOpen(campaign.destination);
  };
  return <>
    <section className="campaign-console">
      <div className="campaign-console-head"><span><small>DYNAMIC QR</small><h2>Campaign control</h2><p>Edit destinations without changing the printed QRY code.</p></span><button onClick={() => setCreating(true)}><Plus /> New</button></div>
      <div className="campaign-kpis"><span><strong>{state.campaigns.length}</strong><small>Campaigns</small></span><span><strong>{active}</strong><small>Active</small></span><span><strong>{totalScans}</strong><small>Scans</small></span></div>
      {state.campaigns.length ? <div className="campaign-list">{state.campaigns.map((campaign) => <div key={campaign.id}><span className="campaign-swatch" style={{ background: campaign.color }}><QrCode /></span><button className="campaign-main" onClick={() => preview(campaign)}><strong>{campaign.name}</strong><small>{campaign.destination}</small><em>{campaign.active ? `${campaign.scans.length} scans` : 'Paused'}</em></button><button onClick={() => setEditing(campaign)} aria-label={`Edit ${campaign.name}`}><Pencil /></button><button onClick={() => toggle(campaign.id)} aria-label={campaign.active ? `Pause ${campaign.name}` : `Activate ${campaign.name}`}>{campaign.active ? <Pause /> : <Play />}</button><button className="danger" onClick={() => remove(campaign.id)} aria-label={`Delete ${campaign.name}`}><Trash2 /></button></div>)}</div> : <button className="campaign-empty" onClick={() => setCreating(true)}><Link2 /><strong>Create your first dynamic campaign</strong><small>The QR stays stable while its destination remains editable in QRY.</small></button>}
    </section>
    <section className="analytics-console">
      <div className="analytics-head"><BarChart3 /><span><strong>Privacy-conscious analytics</strong><small>Only QRY-routed campaign scans are counted</small></span></div>
      <div className="analytics-bars">{state.campaigns.slice(0, 5).map((campaign) => <div key={campaign.id}><span>{campaign.name}</span><i><b style={{ width: `${totalScans ? Math.max(5, campaign.scans.length / totalScans * 100) : 0}%` }} /></i><strong>{campaign.scans.length}</strong></div>)}</div>
      {!state.campaigns.length && <p>No campaign scans yet.</p>}
      {top && <p>Top campaign: <strong>{top.name}</strong> with {top.scans.length} scans.</p>}
    </section>
    {creating && <CampaignSheet customDomain={state.integrations.customDomain} onClose={() => setCreating(false)} onCreate={(campaign) => { onState({ ...state, campaigns: [campaign, ...state.campaigns] }); setCreating(false); onNotice('Dynamic campaign created'); }} onNotice={onNotice} />}
    {editing && <CampaignSheet initial={editing} customDomain={state.integrations.customDomain} onClose={() => setEditing(undefined)} onCreate={(campaign) => { onState({ ...state, campaigns: state.campaigns.map((item) => item.id === campaign.id ? campaign : item) }); setEditing(undefined); onNotice('Campaign destination updated'); }} onNotice={onNotice} />}
  </>;
}

function CampaignSheet({ initial, customDomain, onClose, onCreate, onNotice }: { initial?: DynamicCampaign; customDomain: string; onClose: () => void; onCreate: (campaign: DynamicCampaign) => void; onNotice: (message: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [color, setColor] = useState(initial?.color ?? '#173f35');
  const [qr, setQr] = useState('');
  const id = useMemo(() => initial?.id ?? makeBusinessId(), [initial?.id]);
  const payload = campaignPayload(id);
  useEffect(() => { QRCode.toDataURL(payload, { width: 600, margin: 3, errorCorrectionLevel: 'H', color: { dark: color, light: '#fffdf7' } }).then(setQr); }, [payload, color]);
  const safeDestination = /^https?:\/\//i.test(destination.trim()) ? destination.trim() : `https://${destination.trim()}`;
  const valid = Boolean(name.trim() && destination.trim() && /^https?:\/\/[^\s]+$/i.test(safeDestination));
  const create = () => onCreate({ id, name: name.trim(), destination: safeDestination, slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), color, active: initial?.active ?? true, scans: initial?.scans ?? [], createdAt: initial?.createdAt ?? Date.now() });
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={initial ? 'Edit dynamic campaign' : 'Create dynamic campaign'}><button className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className="bottom-sheet campaign-sheet"><div className="sheet-handle" /><button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button><span className="sheet-kicker">DYNAMIC QR</span><h2>{initial ? 'Edit campaign' : 'Create a campaign'}</h2><p>Its QRY payload stays permanent while you edit the destination.</p><div className="campaign-form"><label><span>Campaign name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer menu" /></label><label><span>Destination</span><div><Globe2 /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="https://example.com/menu" /></div></label><label><span>Short slug</span><div><Link2 /><input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="summer-menu" /></div></label></div><div className="campaign-preview"><div>{qr && <img src={qr} alt="Dynamic QR preview" />}</div><span><strong>{customDomain || 'app.qry.local'}/{slug || 'campaign'}</strong><small>App-routed dynamic code · Local analytics</small><button disabled={!qr} onClick={async () => { if (!qr) return; await exportQrImage(qr); onNotice('Campaign QR ready to share'); }}><Download /> Export QR</button></span></div><div className="campaign-palette">{['#173f35', '#172d5b', '#672c3f', '#2f2b46', '#a64f2d'].map((item) => <button key={item} aria-label={`Use color ${item}`} className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)} />)}</div><button className="solid-button full" disabled={!valid} onClick={create}>{initial ? 'Save destination' : 'Create dynamic code'} <ChevronRight /></button><p className="hosted-boundary"><ExternalLink /> Public redirects and geographic analytics activate only after a hosted redirect service is connected.</p></section></div>;
}
