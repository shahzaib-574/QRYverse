import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function exportQrImage(dataUrl: string): Promise<'shared' | 'downloaded'> {
  if (!Capacitor.isNativePlatform()) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qry-${Date.now()}.png`;
    link.click();
    return 'downloaded';
  }

  const base64 = dataUrl.split(',')[1];
  const filename = `qry-${Date.now()}.png`;
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({
    title: 'Share QR code',
    text: 'Created privately with QRY',
    files: [written.uri],
    dialogTitle: 'Share or save your QR code',
  });
  return 'shared';
}

export async function exportTextFile(filename: string, text: string, mimeType: string): Promise<'shared' | 'downloaded'> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  const written = await Filesystem.writeFile({
    path: filename,
    data: btoa(unescape(encodeURIComponent(text))),
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, files: [written.uri], dialogTitle: 'Export QRY Track data' });
  return 'shared';
}

export async function exportBinaryFile(filename: string, bytes: Uint8Array, mimeType: string): Promise<'shared' | 'downloaded'> {
  if (!Capacitor.isNativePlatform()) {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const written = await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache });
  await Share.share({ title: filename, files: [written.uri], dialogTitle: 'Print or share QRY labels' });
  return 'shared';
}
