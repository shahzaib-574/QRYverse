export function resolveCloudAccountAvailability(configuredValue: unknown, development: boolean): boolean {
  return development || String(configuredValue ?? '').trim().length > 0;
}

export function resolveDefaultCloudApiBase(configuredValue: unknown, development: boolean): string {
  const configured = String(configuredValue ?? '').trim();
  if (configured) return configured;
  return development ? 'http://127.0.0.1:8787' : '';
}
