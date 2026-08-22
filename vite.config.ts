import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const buildProfile = {
    schemaVersion: 1,
    mode,
    cloudEnabled: Boolean(env.VITE_QRY_CLOUD_API_URL?.trim()),
    admobBannerConfigured: Boolean(env.VITE_ADMOB_BANNER_ID?.trim()),
    admobBannerId: env.VITE_ADMOB_BANNER_ID?.trim() ?? '',
    admobTestMode: env.VITE_ADMOB_TEST_MODE !== 'false',
  };
  return {
    plugins: [react(), emitBuildProfile(buildProfile)],
    server: { host: true },
  };
});

function emitBuildProfile(profile: Record<string, unknown>): Plugin {
  return {
    name: 'qry-build-profile',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'qry-build-profile.json', source: `${JSON.stringify(profile, null, 2)}\n` });
    },
  };
}
