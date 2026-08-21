import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export type ScannerOutcome =
  | { status: 'success'; values: string[] }
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string };

export async function scanWithDevice(): Promise<ScannerOutcome> {
  if (!Capacitor.isNativePlatform()) {
    return {
      status: 'unavailable',
      message: 'Camera scanning is available in the Android build. Paste a QR value to test in the browser.',
    };
  }

  try {
    const supported = await BarcodeScanner.isSupported();
    if (!supported.supported) {
      return { status: 'unavailable', message: 'QR scanning is not supported on this device.' };
    }

    const permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted' && permission.camera !== 'limited') {
      return { status: 'unavailable', message: 'Camera access is required to scan a QR code.' };
    }

    if (Capacitor.getPlatform() === 'android') {
      const module = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!module.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return { status: 'unavailable', message: 'The secure scanner is being prepared. Try scanning again in a moment.' };
      }
    }

    const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode], autoZoom: true });
    const value = result.barcodes[0]?.rawValue;
    return value ? { status: 'success', values: [value] } : { status: 'cancelled' };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'The scanner could not start.',
    };
  }
}

export async function scanImageFromGallery(): Promise<ScannerOutcome> {
  try {
    const picked = await Camera.pickImages({ limit: 1, quality: 96 });
    const photo = picked.photos[0];
    if (!photo) return { status: 'cancelled' };

    const result = Capacitor.isNativePlatform()
      ? await BarcodeScanner.readBarcodesFromImage({ path: photo.path ?? photo.webPath, formats: [BarcodeFormat.QrCode] })
      : await BarcodeScanner.readBarcodesFromImage({ blob: await (await fetch(photo.webPath)).blob(), formats: [BarcodeFormat.QrCode] });

    const values = result.barcodes
      .map((barcode) => barcode.rawValue?.trim())
      .filter((value): value is string => Boolean(value));

    return values.length
      ? { status: 'success', values: [...new Set(values)] }
      : { status: 'unavailable', message: 'No readable QR code was found in that image.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The image could not be read.';
    if (/cancel|select.*photo/i.test(message)) return { status: 'cancelled' };
    return { status: 'unavailable', message };
  }
}

export async function confirmSuccessfulScan(enabled: boolean): Promise<void> {
  if (!enabled || !Capacitor.isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
}
