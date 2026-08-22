import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportedVersion = '8.1.0';
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginRoot = join(projectRoot, 'node_modules', '@capacitor-community', 'admob');
const packagePath = join(pluginRoot, 'package.json');
const executorPath = join(
  pluginRoot,
  'android',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'community',
  'admob',
  'banner',
  'BannerExecutor.java',
);
const checkOnly = process.argv.includes('--check');

const pluginPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
if (pluginPackage.version !== supportedVersion) {
  throw new Error(
    `QRYverse's reviewed AdMob Android patch supports ${supportedVersion}; found ${pluginPackage.version}. Review the native diff before upgrading.`,
  );
}

const patches = [
  {
    label: 'resolve the existing-banner show call',
    before: `        if (mAdView != null) {
            updateExistingAdView(adOptions);
            return;
        }`,
    after: `        if (mAdView != null) {
            updateExistingAdView(adOptions, call);
            return;
        }`,
  },
  {
    label: 'scope Android 15+ insets to the banner container',
    before: `                View rootView = activitySupplier.get().getWindow().getDecorView();
                rootView.setOnApplyWindowInsetsListener((v, insets) -> {`,
    after: `                mAdViewLayout.setOnApplyWindowInsetsListener((v, insets) -> {`,
  },
  {
    label: 'make removal completion a UI-thread teardown barrier',
    before: `    public void removeBanner(final PluginCall call) {
        try {
            if (mAdView != null) {
                activitySupplier
                    .get()
                    .runOnUiThread(() -> {
                        if (mAdView != null) {
                            mViewGroup.removeView(mAdViewLayout);
                            mAdViewLayout.removeView(mAdView);
                            mAdView.destroy();
                            mAdView = null;
                            Log.d(logTag, "Banner AD Removed");
                            final BannerAdSizeInfo sizeInfo = new BannerAdSizeInfo(0, 0);
                            notifyListeners(BannerAdPluginEvents.SizeChanged.getWebEventName(), sizeInfo);
                        }
                    });
            }

            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage(), ex);
        }
    }`,
    after: `    public void removeBanner(final PluginCall call) {
        try {
            activitySupplier
                .get()
                .runOnUiThread(() -> {
                    try {
                        final RelativeLayout adViewLayout = mAdViewLayout;
                        final AdView adView = mAdView;

                        if (adViewLayout != null) {
                            adViewLayout.setOnApplyWindowInsetsListener(null);
                            mViewGroup.removeView(adViewLayout);
                            if (adView != null) {
                                adViewLayout.removeView(adView);
                            }
                        }
                        if (adView != null) {
                            adView.destroy();
                            Log.d(logTag, "Banner AD Removed");
                        }

                        mAdView = null;
                        mAdViewLayout = null;
                        final BannerAdSizeInfo sizeInfo = new BannerAdSizeInfo(0, 0);
                        notifyListeners(BannerAdPluginEvents.SizeChanged.getWebEventName(), sizeInfo);
                        call.resolve();
                    } catch (Exception ex) {
                        call.reject(ex.getLocalizedMessage(), ex);
                    }
                });
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage(), ex);
        }
    }`,
  },
  {
    label: 'settle the existing-banner update call on the UI thread',
    before: `    private void updateExistingAdView(AdOptions adOptions) {
        // Bind to the AdView present when this call was made. \`mAdView\` is a
        // shared field that another UI-thread task can null before this one
        // runs; using the captured reference avoids a NullPointerException.
        final AdView adView = mAdView;
        activitySupplier
            .get()
            .runOnUiThread(() -> {
                if (adView != mAdView) {
                    // Banner was removed or replaced before this task ran.
                    return;
                }
                final AdRequest adRequest = RequestHelper.createRequest(adOptions);
                adView.loadAd(adRequest);
            });
    }`,
    after: `    private void updateExistingAdView(AdOptions adOptions, PluginCall call) {
        // Bind to the AdView present when this call was made. \`mAdView\` is a
        // shared field that another UI-thread task can null before this one
        // runs; using the captured reference avoids a NullPointerException.
        final AdView adView = mAdView;
        try {
            activitySupplier
                .get()
                .runOnUiThread(() -> {
                    try {
                        if (adView == null || adView != mAdView) {
                            // Banner was removed or replaced before this task ran.
                            call.resolve();
                            return;
                        }
                        final AdRequest adRequest = RequestHelper.createRequest(adOptions);
                        adView.loadAd(adRequest);
                        call.resolve();
                    } catch (Exception ex) {
                        call.reject(ex.getLocalizedMessage(), ex);
                    }
                });
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage(), ex);
        }
    }`,
  },
];

function replaceReviewedSource(input) {
  let output = input;
  let changed = false;

  for (const patch of patches) {
    const beforeCount = output.split(patch.before).length - 1;
    const afterCount = output.split(patch.after).length - 1;
    if (afterCount === 1 && beforeCount === 0) continue;
    if (beforeCount !== 1 || afterCount !== 0) {
      throw new Error(
        `Cannot ${patch.label}: expected exactly one reviewed source shape (before=${beforeCount}, after=${afterCount}).`,
      );
    }
    output = output.replace(patch.before, patch.after);
    changed = true;
  }

  return { output, changed };
}

const original = readFileSync(executorPath, 'utf8').replaceAll('\r\n', '\n');
const firstPass = replaceReviewedSource(original);
const secondPass = replaceReviewedSource(firstPass.output);
if (secondPass.changed || secondPass.output !== firstPass.output) {
  throw new Error('The reviewed AdMob patch is not idempotent.');
}
if (firstPass.output.includes('getWindow().getDecorView().setOnApplyWindowInsetsListener')) {
  throw new Error('The AdMob patch left an unsafe DecorView insets listener behind.');
}

if (checkOnly && firstPass.changed) {
  throw new Error('The reviewed AdMob Android patch has not been applied. Run npm run patch:admob.');
}
if (firstPass.changed) {
  writeFileSync(executorPath, firstPass.output, 'utf8');
  console.log(`Applied QRYverse's reviewed AdMob ${supportedVersion} Android compatibility patch.`);
} else {
  console.log(`Verified QRYverse's reviewed AdMob ${supportedVersion} Android compatibility patch.`);
}
