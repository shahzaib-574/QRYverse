import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'ur';
type Variables = Record<string, string | number>;

const ur: Record<string, string> = {
  'Free plan': 'مفت پلان',
  'Home': 'ہوم',
  'Create': 'بنائیں',
  'Library': 'لائبریری',
  'Track': 'ٹریک',
  'Private by design': 'رازداری ہماری بنیاد',
  'Point. Scan.': 'نشانہ لگائیں۔ اسکین کریں۔',
  'Know first.': 'پہلے جانیں۔',
  'See where a code leads before you follow it. Your scans stay on this device.': 'کوڈ کھولنے سے پہلے جانیں کہ وہ کہاں لے جاتا ہے۔ آپ کے اسکین اسی ڈیوائس پر رہتے ہیں۔',
  'Scan a QR code': 'QR کوڈ اسکین کریں',
  'Camera opens only when you ask': 'کیمرہ صرف آپ کے کہنے پر کھلتا ہے',
  'Scan from photo': 'تصویر سے اسکین',
  'Paste a value': 'ویلیو پیسٹ کریں',
  'Quick create': 'فوری تخلیق',
  'Make something useful': 'کچھ مفید بنائیں',
  'Website': 'ویب سائٹ',
  'Open any link': 'کوئی بھی لنک کھولیں',
  'Wi-Fi': 'وائی فائی',
  'Join in one scan': 'ایک اسکین میں منسلک ہوں',
  'Contact': 'رابطہ',
  'Share your details': 'اپنی تفصیلات شیئر کریں',
  'More': 'مزید',
  'Text, email & more': 'متن، ای میل اور مزید',
  'Your space': 'آپ کی جگہ',
  'Recent activity': 'حالیہ سرگرمی',
  'See all': 'سب دیکھیں',
  'Your scans will live here': 'آپ کے اسکین یہاں محفوظ ہوں گے',
  'Try a safe preview with our sample code.': 'نمونہ کوڈ کے ساتھ محفوظ پیش نظارہ آزمائیں۔',
  'Turn scans into actions': 'اسکین کو عمل میں بدلیں',
  'Assets, attendance and inventory—offline.': 'اثاثے، حاضری اور اسٹاک—آف لائن۔',
  'Make your code': 'اپنا کوڈ بنائیں',
  'Simple, sharp, and yours to keep.': 'سادہ، خوبصورت اور ہمیشہ آپ کا۔',
  'Text': 'متن',
  'Website address': 'ویب سائٹ کا پتہ',
  'Text message': 'متنی پیغام',
  'Network name': 'نیٹ ورک کا نام',
  'Password': 'پاس ورڈ',
  'Security': 'سیکیورٹی',
  'Full name': 'پورا نام',
  'Phone': 'فون',
  'Email': 'ای میل',
  'Your QR preview': 'آپ کے QR کا پیش نظارہ',
  'Export': 'برآمد کریں',
  'Save code': 'کوڈ محفوظ کریں',
  'Static codes are generated entirely on your device.': 'جامد کوڈ مکمل طور پر آپ کی ڈیوائس پر بنتے ہیں۔',
  'Everything, organized': 'سب کچھ منظم',
  'Your scans and creations stay close.': 'آپ کے اسکین اور بنائے گئے کوڈ قریب رہتے ہیں۔',
  'Search your library': 'لائبریری میں تلاش کریں',
  'All': 'سب',
  'Scanned': 'اسکین شدہ',
  'Created': 'بنائے گئے',
  'Starred': 'پسندیدہ',
  'A calm, empty library': 'ایک خالی لائبریری',
  'Scanned and created codes will appear here.': 'اسکین اور بنائے گئے کوڈ یہاں ظاہر ہوں گے۔',
  'Stored locally on this device · Up to 100 items': 'اسی ڈیوائس پر محفوظ · زیادہ سے زیادہ 100 آئٹمز',
  'Your codes.': 'آپ کے کوڈ۔',
  'Working harder.': 'زیادہ کارآمد۔',
  'Local preferences': 'مقامی ترجیحات',
  'Controls that work in this build': 'اس ورژن میں کام کرنے والے کنٹرولز',
  'Save scans automatically': 'اسکین خودکار طور پر محفوظ کریں',
  'Keep successful scans in your library': 'کامیاب اسکین لائبریری میں رکھیں',
  'Haptic feedback': 'ہلکی وائبریشن',
  'Confirm successful scans on supported devices': 'معاون ڈیوائسز پر کامیاب اسکین کی تصدیق',
  'Language': 'زبان',
  'Private diagnostics': 'نجی تشخیصی معلومات',
  'No errors recorded': 'کوئی خرابی ریکارڈ نہیں ہوئی',
  'Upgrade QRY Track': 'QRY Track اپ گریڈ کریں',
  'More workspaces, records, and workflow packs': 'مزید ورک اسپیس، ریکارڈز اور ورک فلو پیک',
  'Store connection not configured': 'اسٹور کنکشن ترتیب نہیں دیا گیا',
  'Restore purchases': 'خریداری بحال کریں',
  'Scan. Update. Done.': 'اسکین۔ اپ ڈیٹ۔ مکمل۔',
  'Lightweight operations without a heavyweight system.': 'بھاری سسٹم کے بغیر آسان آپریشنز۔',
  'Turn every label into an action.': 'ہر لیبل کو ایک عمل میں بدلیں۔',
  'Track assets, attendance, and stock from the same scanner.': 'ایک ہی اسکینر سے اثاثے، حاضری اور اسٹاک ٹریک کریں۔',
  'Workspaces': 'ورک اسپیس',
  'Records': 'ریکارڈز',
  'Storage': 'اسٹوریج',
  'This device': 'یہ ڈیوائس',
  'New': 'نیا',
  'Start with a workflow': 'ورک فلو سے شروع کریں',
  'Create records, print their codes, then scan to update status or quantity.': 'ریکارڈ بنائیں، کوڈ پرنٹ کریں، پھر حیثیت یا مقدار اپ ڈیٹ کرنے کے لیے اسکین کریں۔',
  'Create workspace': 'ورک اسپیس بنائیں',
  'Free workspace allowance': 'مفت ورک اسپیس کی حد',
  'All workspaces': 'تمام ورک اسپیس',
  'Total': 'کل',
  'Ready': 'تیار',
  'Attention': 'توجہ',
  'Items': 'آئٹمز',
  'Add': 'شامل کریں',
  'Add your first record': 'اپنا پہلا ریکارڈ شامل کریں',
  'Latest updates': 'تازہ ترین اپ ڈیٹس',
  'Choose a workflow': 'ورک فلو منتخب کریں',
  'Workspace name': 'ورک اسپیس کا نام',
  'Add a record': 'ریکارڈ شامل کریں',
  'Name': 'نام',
  'Location': 'مقام',
  'Notes': 'نوٹس',
  'Create record and code': 'ریکارڈ اور کوڈ بنائیں',
  'Status': 'حیثیت',
  'Quantity': 'مقدار',
  'Check out': 'جاری کریں',
  'Return': 'واپس کریں',
  'Needs service': 'مرمت درکار',
  'Present': 'حاضر',
  'Late': 'دیر سے',
  'Add one': 'ایک شامل کریں',
  'Remove one': 'ایک کم کریں',
  'View printable label': 'پرنٹ لیبل دیکھیں',
  'Restore': 'بحال کریں',
  'Import': 'درآمد کریں',
  'Labels': 'لیبلز',
  'Backup': 'بیک اپ',
  'Bulk operations': 'بلک آپریشنز',
  'Import a CSV': 'CSV درآمد کریں',
  'Map your columns, review the result, then import locally.': 'کالم منتخب کریں، نتیجہ دیکھیں، پھر مقامی طور پر درآمد کریں۔',
  'Choose a CSV file': 'CSV فائل منتخب کریں',
  'Header row required · Up to 5,000 rows': 'ہیڈر قطار ضروری · زیادہ سے زیادہ 5,000 قطاریں',
  'Download CSV template': 'CSV ٹیمپلیٹ ڈاؤن لوڈ کریں',
  'rows found': 'قطاریں ملیں',
  'columns': 'کالم',
  'record spaces available': 'ریکارڈ جگہیں دستیاب',
  'Change': 'تبدیل کریں',
  'Code': 'کوڈ',
  'Not imported': 'درآمد نہ کریں',
  'When a code already exists': 'اگر کوڈ پہلے سے موجود ہو',
  'Skip row': 'قطار چھوڑ دیں',
  'Update record': 'ریکارڈ اپ ڈیٹ کریں',
  'ready': 'تیار',
  'skipped': 'چھوڑے گئے',
  'over plan limit': 'پلان کی حد سے زیادہ',
  'Import records': 'ریکارڈ درآمد کریں',
  'Device recovery': 'ڈیوائس ریکوری',
  'Restore a backup': 'بیک اپ بحال کریں',
  'Nothing changes until you confirm how to restore it.': 'بحالی کا طریقہ منتخب کرنے تک کچھ تبدیل نہیں ہوگا۔',
  'Choose a QRY JSON backup': 'QRY JSON بیک اپ منتخب کریں',
  'The file is validated before restore': 'بحالی سے پہلے فائل کی جانچ ہوتی ہے',
  'workspaces': 'ورک اسپیس',
  'records': 'ریکارڈز',
  'warnings': 'تنبیہات',
  'Validation passed': 'جانچ کامیاب',
  'Merge safely': 'محفوظ طریقے سے ضم کریں',
  'Keep local data and update matching IDs': 'مقامی ڈیٹا رکھیں اور ملتی IDs اپ ڈیٹ کریں',
  'Replace this device': 'اس ڈیوائس کا ڈیٹا بدلیں',
  'Use only the workspaces in this backup': 'صرف اس بیک اپ کی ورک اسپیس استعمال کریں',
  'Merge backup': 'بیک اپ ضم کریں',
  'Replace local data': 'مقامی ڈیٹا بدلیں',
  'Label Studio': 'لیبل اسٹوڈیو',
  'Print your workspace': 'اپنی ورک اسپیس پرنٹ کریں',
  'Every label includes a QR code, name, human-readable ID, and optional location.': 'ہر لیبل میں QR کوڈ، نام، آسان ID اور اختیاری مقام شامل ہے۔',
  'Print at 100% or Actual size for accurate label spacing.': 'درست لیبل فاصلے کے لیے 100% یا Actual size پر پرنٹ کریں۔',
  'Paper': 'کاغذ',
  'Label size': 'لیبل سائز',
  'Compact': 'کمپیکٹ',
  'Standard': 'معیاری',
  'Large': 'بڑا',
  'per page': 'فی صفحہ',
  'labels selected': 'لیبل منتخب',
  'PDF pages': 'PDF صفحات',
  'Clear': 'صاف کریں',
  'Create label PDF': 'لیبل PDF بنائیں',
  'Building PDF…': 'PDF بن رہی ہے…',
  'Browse files': 'فائلیں دیکھیں',
  'Close': 'بند کریں',
  'Save': 'محفوظ کریں',
  'Copy raw value': 'اصل ویلیو کاپی کریں',
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string, variables?: Variables) => string;
};

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', setLocale: () => undefined, t: (value) => value });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = localStorage.getItem('qry.locale.v1');
    if (stored === 'en' || stored === 'ur') return stored;
    return navigator.language.toLowerCase().startsWith('ur') ? 'ur' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('qry.locale.v1', locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ur' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (english, variables) => {
      let translated = locale === 'ur' ? (ur[english] ?? english) : english;
      for (const [key, replacement] of Object.entries(variables ?? {})) translated = translated.replaceAll(`{${key}}`, String(replacement));
      return translated;
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
