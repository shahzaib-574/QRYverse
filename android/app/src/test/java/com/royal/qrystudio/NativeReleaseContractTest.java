package com.royal.qrystudio;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

public class NativeReleaseContractTest {

    @Test
    public void manifestKeepsTheLocalFirstSecurityBoundary() throws Exception {
        String manifest = read("src/main/AndroidManifest.xml");

        assertTrue(manifest.contains("android:allowBackup=\"false\""));
        assertTrue(manifest.contains("android:usesCleartextTraffic=\"false\""));
        assertTrue(manifest.contains("android:name=\"android.permission.CAMERA\""));
        assertTrue(manifest.contains("android:name=\"android.permission.INTERNET\""));
        assertTrue(manifest.contains("android:name=\"android.hardware.camera.any\" android:required=\"false\""));
        assertFalse(manifest.contains("com.android.vending.BILLING"));
        assertFalse(manifest.contains("READ_CONTACTS"));
        assertFalse(manifest.contains("ACCESS_FINE_LOCATION"));
    }

    @Test
    public void manifestRegistersOnlyTheSupportedQRYRoutes() throws Exception {
        String manifest = read("src/main/AndroidManifest.xml");

        assertTrue(manifest.contains("android:scheme=\"qry\""));
        assertTrue(manifest.contains("android:host=\"track\""));
        assertTrue(manifest.contains("android:host=\"go\""));
        assertTrue(manifest.contains("android:launchMode=\"singleTop\""));
        assertTrue(manifest.contains("android:exported=\"true\""));
    }

    @Test
    public void synchronizedWebProfileStaysProductionAndCloudOff() throws Exception {
        String profile = read("src/main/assets/public/qry-build-profile.json");

        assertTrue(profile.matches("(?s).*\\\"schemaVersion\\\"\\s*:\\s*1.*"));
        assertTrue(profile.matches("(?s).*\\\"mode\\\"\\s*:\\s*\\\"production\\\".*"));
        assertTrue(profile.matches("(?s).*\\\"cloudEnabled\\\"\\s*:\\s*false.*"));
        assertTrue(profile.matches("(?s).*\\\"admobTestMode\\\"\\s*:\\s*(true|false).*"));
    }

    private static String read(String relativePath) throws Exception {
        Path path = Paths.get(relativePath);
        assertTrue("Missing synchronized release contract: " + path, Files.isRegularFile(path));
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }
}
