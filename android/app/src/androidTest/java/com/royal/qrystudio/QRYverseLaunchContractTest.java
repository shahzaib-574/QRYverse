package com.royal.qrystudio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class QRYverseLaunchContractTest {

    @Test
    public void installedAppMetadataMatchesTheReleaseContract() throws Exception {
        Context context = targetContext();
        PackageManager manager = context.getPackageManager();
        ApplicationInfo application = manager.getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);
        PackageInfo packageInfo = manager.getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS);
        ActivityInfo activity = manager.getActivityInfo(new ComponentName(context, MainActivity.class), PackageManager.GET_META_DATA);

        assertEquals("com.royal.qrystudio", context.getPackageName());
        assertEquals("QRYverse", manager.getApplicationLabel(application).toString());
        assertFalse((application.flags & ApplicationInfo.FLAG_ALLOW_BACKUP) != 0);
        assertFalse((application.flags & ApplicationInfo.FLAG_USES_CLEARTEXT_TRAFFIC) != 0);
        assertTrue(activity.exported);
        assertEquals(ActivityInfo.LAUNCH_SINGLE_TOP, activity.launchMode);

        Set<String> permissions = new HashSet<>(Arrays.asList(packageInfo.requestedPermissions));
        assertTrue(permissions.contains(Manifest.permission.CAMERA));
        assertTrue(permissions.contains(Manifest.permission.INTERNET));
        assertFalse(permissions.contains("com.android.vending.BILLING"));
        assertFalse(permissions.contains(Manifest.permission.READ_CONTACTS));
        assertFalse(permissions.contains(Manifest.permission.ACCESS_FINE_LOCATION));

        String admobAppId = application.metaData.getString("com.google.android.gms.ads.APPLICATION_ID");
        assertNotNull(admobAppId);
        assertTrue(admobAppId.matches("ca-app-pub-\\d{16}~\\d{10}"));
    }

    @Test
    public void supportedDeepLinksResolveToTheSingleMainActivity() {
        assertDeepLinkResolves("qry://track/8e5e1b80-95e9-4ecf-a333-7a122b7981e6/6c37ec54-cd7e-4ec8-9a84-dd768c36fe46");
        assertDeepLinkResolves("qry://go/8e5e1b80-95e9-4ecf-a333-7a122b7981e6");
    }

    @Test
    public void packagedWebAppContainsBuildMetadataAndLegalPages() throws Exception {
        Context context = targetContext();
        String profile = readAsset(context, "public/qry-build-profile.json");

        assertTrue(profile.matches("(?s).*\\\"mode\\\"\\s*:\\s*\\\"production\\\".*"));
        assertTrue(profile.matches("(?s).*\\\"cloudEnabled\\\"\\s*:\\s*false.*"));
        assertTrue(readAsset(context, "public/index.html").contains("QRYverse"));
        assertTrue(readAsset(context, "public/privacy.html").contains("Privacy"));
        assertTrue(readAsset(context, "public/terms.html").contains("Terms"));
        assertTrue(readAsset(context, "public/account-deletion.html").contains("Delete"));
    }

    private static Context targetContext() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    private static void assertDeepLinkResolves(String value) {
        Context context = targetContext();
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(value));
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.setPackage(context.getPackageName());
        ResolveInfo resolved = context.getPackageManager().resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);

        assertNotNull("Deep link did not resolve: " + value, resolved);
        assertEquals(MainActivity.class.getName(), resolved.activityInfo.name);
    }

    private static String readAsset(Context context, String path) throws Exception {
        try (InputStream input = context.getAssets().open(path);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
