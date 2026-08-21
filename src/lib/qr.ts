export type ScanKind =
  | 'link'
  | 'wifi'
  | 'contact'
  | 'email'
  | 'phone'
  | 'sms'
  | 'location'
  | 'text';

export type RiskLevel = 'clear' | 'caution' | 'danger';

export type ScanAnalysis = {
  kind: ScanKind;
  title: string;
  displayValue: string;
  host?: string;
  actionLabel: string;
  actionHref?: string;
  risk: RiskLevel;
  riskTitle: string;
  riskReasons: string[];
};

const shorteners = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
]);

const suspiciousWords = [
  'verify-account',
  'wallet-connect',
  'claim-prize',
  'urgent-login',
  'password-reset',
];

export function analysePayload(raw: string): ScanAnalysis {
  const value = raw.trim();

  if (/^WIFI:/i.test(value)) {
    const ssid = value.match(/(?:^|;)S:((?:\\.|[^;])*)/i)?.[1]?.replace(/\\([;,:\\])/g, '$1');
    return {
      kind: 'wifi',
      title: ssid || 'Wi-Fi network',
      displayValue: ssid ? `Join ${ssid}` : 'Wi-Fi credentials',
      actionLabel: 'Open Wi-Fi settings',
      actionHref: 'intent:#Intent;action=android.settings.WIFI_SETTINGS;end',
      risk: 'caution',
      riskTitle: 'Check the network name',
      riskReasons: ['Only join networks you recognize.'],
    };
  }

  if (/^(BEGIN:VCARD|MECARD:)/i.test(value)) {
    const name = value.match(/(?:^|\n)(?:FN|N):([^\r\n;]+)/i)?.[1] ??
      value.match(/(?:^|;)N:([^;]+)/i)?.[1];
    return {
      kind: 'contact',
      title: name || 'New contact',
      displayValue: 'Contact card',
      actionLabel: 'Save contact',
      actionHref: `data:text/vcard;charset=utf-8,${encodeURIComponent(value)}`,
      risk: 'clear',
      riskTitle: 'Contact card detected',
      riskReasons: ['Review the details before saving.'],
    };
  }

  const schemes: Array<[RegExp, ScanKind, string]> = [
    [/^mailto:/i, 'email', 'Compose email'],
    [/^tel:/i, 'phone', 'Call number'],
    [/^sms:/i, 'sms', 'Write message'],
    [/^geo:/i, 'location', 'Open map'],
  ];
  for (const [pattern, kind, actionLabel] of schemes) {
    if (pattern.test(value)) {
      return {
        kind,
        title: labelForKind(kind),
        displayValue: value.replace(pattern, ''),
        actionLabel,
        actionHref: value,
        risk: kind === 'phone' || kind === 'sms' ? 'caution' : 'clear',
        riskTitle: kind === 'phone' || kind === 'sms' ? 'Confirm before continuing' : 'Standard QR format',
        riskReasons: kind === 'phone' || kind === 'sms' ? ['Carrier charges may apply.'] : ['No link redirect is involved.'],
      };
    }
  }

  const url = toHttpUrl(value);
  if (url) return analyseUrl(url);

  return {
    kind: 'text',
    title: 'Plain text',
    displayValue: value || 'Empty QR code',
    actionLabel: 'Copy text',
    risk: 'clear',
    riskTitle: 'Plain text only',
    riskReasons: ['This code does not open an external destination.'],
  };
}

function analyseUrl(url: URL): ScanAnalysis {
  const reasons: string[] = [];
  let risk: RiskLevel = 'clear';

  if (url.protocol !== 'https:') {
    risk = 'caution';
    reasons.push('The connection is not encrypted with HTTPS.');
  }
  if (url.username || url.password) {
    risk = 'danger';
    reasons.push('The link hides credentials before the domain.');
  }
  if (/^xn--/i.test(url.hostname) || url.hostname.includes('.xn--')) {
    risk = 'caution';
    reasons.push('The domain uses encoded international characters.');
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname)) {
    risk = 'caution';
    reasons.push('The destination uses a raw IP address.');
  }
  if (shorteners.has(url.hostname.replace(/^www\./, ''))) {
    risk = risk === 'danger' ? 'danger' : 'caution';
    reasons.push('A shortened link hides the final destination.');
  }
  if (suspiciousWords.some((word) => url.href.toLowerCase().includes(word))) {
    risk = 'danger';
    reasons.push('The address contains language commonly used in deceptive links.');
  }
  if (reasons.length === 0) reasons.push('No obvious warning signs found by on-device checks.');

  return {
    kind: 'link',
    title: url.hostname.replace(/^www\./, ''),
    displayValue: url.href,
    host: url.hostname,
    actionLabel: risk === 'danger' ? 'Open anyway' : 'Open link',
    actionHref: url.href,
    risk,
    riskTitle:
      risk === 'danger' ? 'High-risk pattern detected' :
      risk === 'caution' ? 'Take a closer look' :
      'Looks clear',
    riskReasons: reasons,
  };
}

function toHttpUrl(value: string): URL | undefined {
  try {
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function labelForKind(kind: ScanKind): string {
  return ({
    link: 'Website',
    wifi: 'Wi-Fi',
    contact: 'Contact',
    email: 'Email',
    phone: 'Phone number',
    sms: 'Message',
    location: 'Location',
    text: 'Text',
  } satisfies Record<ScanKind, string>)[kind];
}

export type CreateMode = 'link' | 'wifi' | 'text' | 'contact';

export function createPayload(
  mode: CreateMode,
  fields: Record<string, string>,
): string {
  if (mode === 'link') return normaliseWebsite(fields.url ?? '');
  if (mode === 'text') return fields.text?.trim() ?? '';
  if (mode === 'wifi') {
    const escape = (part: string) => part.replace(/([\\;,:])/g, '\\$1');
    const security = fields.security || 'WPA';
    return `WIFI:T:${security};S:${escape(fields.ssid ?? '')};P:${escape(fields.password ?? '')};H:${fields.hidden === 'true'};;`;
  }
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fields.name?.trim() ?? ''}`,
    fields.phone ? `TEL:${fields.phone.trim()}` : '',
    fields.email ? `EMAIL:${fields.email.trim()}` : '',
    fields.company ? `ORG:${fields.company.trim()}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n');
}

function normaliseWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
