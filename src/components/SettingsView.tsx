import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { cn, TRANSPARENCY_STEPS } from '../utils';
import { Sun, Moon, Monitor, Download, Upload, Keyboard, Info, Bell, Palette, Check, Trash2, Save, X, Loader2, RefreshCw, Wifi, Copy } from 'lucide-react';
import {
  syncNow as lanSyncNow,
  setConfig as setLanConfig,
  clearConfig as clearLanConfig,
  getStatus as getLanStatus,
  onStatus as onLanStatus,
  getConfig as getLanConfig,
} from '../platform/lanSync';

const ACCENT_COLORS = [
  { name: 'بنفش', value: 'purple', color: '#8b5cf6' },
  { name: 'آبی', value: 'blue', color: '#3b82f6' },
  { name: 'سبز', value: 'teal', color: '#14b8a6' },
  { name: 'صورتی', value: 'pink', color: '#ec4899' },
  { name: 'نارنجی', value: 'orange', color: '#f97316' },
];

const SHORTCUTS = [
  { keys: 'Ctrl + N', action: 'ایجاد تسک جدید' },
  { keys: 'Ctrl + K', action: 'Command Palette' },
  { keys: 'Ctrl + T', action: 'امروز' },
  { keys: 'Ctrl + C', action: 'تقویم' },
  { keys: 'Ctrl + L', action: 'همه تسک‌ها' },
  { keys: 'Ctrl + A', action: 'بدون تاریخ' },
  { keys: 'Ctrl + O', action: 'عقب‌افتاده' },
  { keys: 'Ctrl + /', action: 'نمایش میانبرها' },
  { keys: 'Esc', action: 'بستن پنجره' },
];

type ThemeValue = 'dark' | 'light' | 'system';

const FA_PCT: Record<number, string> = { 0: '۰٪', 20: '۲۰٪', 40: '۴۰٪', 60: '۶۰٪', 80: '۸۰٪' };

function applyThemeToDom(t: ThemeValue) {
  const apply = (v: 'dark' | 'light') => document.documentElement.classList.toggle('dark', v === 'dark');
  if (t === 'system') {
    apply(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } else {
    apply(t);
  }
}

export function SettingsView() {
  const { settings, updateSettings, theme, setTheme, accentColor, setAccentColor, showToast, refreshCurrentView, showConfirm } = useStore();
  const [activeTab, setActiveTab] = useState('general');

  // Persisted auto-launch (from OS)
  const [persistedAutoLaunch, setPersistedAutoLaunch] = useState(false);

  // Draft (unsaved) values
  const [draftTheme, setDraftTheme] = useState<ThemeValue>(theme as ThemeValue);
  const [draftAccent, setDraftAccent] = useState(accentColor);
  const [draftCalendar, setDraftCalendar] = useState(settings.calendarType || 'gregorian');
  const [draftCardT, setDraftCardT] = useState(settings.cardTransparency || '0');
  const [draftWidgetT, setDraftWidgetT] = useState(settings.widgetTransparency || '0');
  const [draftShowOnStartup, setDraftShowOnStartup] = useState(settings.showOnStartup !== 'false');
  const [draftMorning, setDraftMorning] = useState(settings.morningNotification !== 'false');
  const [draftAutoLaunch, setDraftAutoLaunch] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const [lans, setLan] = useState(() => getLanStatus());
  const [lanAddr, setLanAddr] = useState(() => getLanConfig().address);
  const [lanToken, setLanToken] = useState(() => getLanConfig().token);
  const [lanInfo, setLanInfo] = useState<{ running: boolean; port: number; addresses: string[]; token: string; error: string | null } | null>(null);

  useEffect(() => onLanStatus(setLan), []);

  useEffect(() => {
    window.electronAPI.lanInfo().then(setLanInfo).catch(() => {});
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('کپی شد', 'success'))
      .catch(() => showToast('کپی نشد — متن را دستی انتخاب کنید', 'error'));
  };

  const handleLanSync = async () => {
    setLanConfig(lanAddr, lanToken);
    const r = await lanSyncNow();
    if (r.ok) showToast('همگام‌سازی انجام شد', 'success');
    else if (r.error === 'not_configured') showToast('ابتدا آدرس و توکن را وارد کنید', 'info');
    else if (r.error === 'unreachable') showToast('به کامپیوتر وصل نشد — هر دو به یک وای‌فای متصل و برنامه ویندوز باز باشد', 'error');
    else if (r.error === 'timeout') showToast('کامپیوتر پاسخ نداد — دوباره تلاش کنید', 'error');
    else if (r.error === 'bad_token') showToast('توکن نادرست است', 'error');
    else if (r.error === 'busy') { /* in progress */ }
    else showToast('همگام‌سازی ناموفق بود', 'error');
  };

  const handleRegenToken = () => {
    showConfirm({
      title: 'تولید توکن جدید',
      message: 'توکن قبلی باطل می‌شود و باید توکن جدید را در گوشی وارد کنید. ادامه می‌دهید؟',
      confirmLabel: 'تولید توکن',
      onConfirm: async () => {
        const r = await window.electronAPI.lanRegenToken();
        if (lanInfo) setLanInfo({ ...lanInfo, token: r.token });
        showToast('توکن جدید تولید شد', 'success');
      },
    });
  };

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  useEffect(() => {
    window.electronAPI.getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  useEffect(() => {
    window.electronAPI.getAutoLaunch().then(v => {
      setPersistedAutoLaunch(v);
      if (!dirty) setDraftAutoLaunch(v);
    });
  }, []);

  // Sync draft from persisted values when store settings arrive (only if user hasn't edited)
  useEffect(() => {
    if (dirty) return;
    setDraftTheme(theme as ThemeValue);
    setDraftAccent(accentColor);
    setDraftCalendar(settings.calendarType || 'gregorian');
    setDraftCardT(settings.cardTransparency || '0');
    setDraftWidgetT(settings.widgetTransparency || '0');
    setDraftShowOnStartup(settings.showOnStartup !== 'false');
    setDraftMorning(settings.morningNotification !== 'false');
  }, [settings, theme, accentColor]);

  // Live preview of theme while editing (persisted only on save)
  useEffect(() => {
    if (!dirty) return;
    applyThemeToDom(draftTheme);
  }, [draftTheme, dirty]);

  const markDirty = () => setDirty(true);

  const hasChanges = useMemo(() => {
    return dirty && (
      draftTheme !== theme ||
      draftAccent !== accentColor ||
      draftCalendar !== (settings.calendarType || 'gregorian') ||
      draftCardT !== (settings.cardTransparency || '0') ||
      draftWidgetT !== (settings.widgetTransparency || '0') ||
      draftShowOnStartup !== (settings.showOnStartup !== 'false') ||
      draftMorning !== (settings.morningNotification !== 'false') ||
      draftAutoLaunch !== persistedAutoLaunch
    );
  }, [dirty, draftTheme, theme, draftAccent, accentColor, draftCalendar, settings, draftCardT, draftWidgetT, draftShowOnStartup, draftMorning, draftAutoLaunch, persistedAutoLaunch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (draftTheme !== theme) await setTheme(draftTheme as any);
      else applyThemeToDom(draftTheme);
      if (draftAccent !== accentColor) setAccentColor(draftAccent);
      const patch: Record<string, string> = {};
      if (draftCalendar !== (settings.calendarType || 'gregorian')) patch.calendarType = draftCalendar;
      if (draftCardT !== (settings.cardTransparency || '0')) patch.cardTransparency = draftCardT;
      if (draftWidgetT !== (settings.widgetTransparency || '0')) patch.widgetTransparency = draftWidgetT;
      if (String(draftShowOnStartup) !== String(settings.showOnStartup !== 'false')) patch.showOnStartup = String(draftShowOnStartup);
      if (String(draftMorning) !== String(settings.morningNotification !== 'false')) patch.morningNotification = String(draftMorning);
      if (Object.keys(patch).length > 0) await updateSettings(patch);
      if (draftAutoLaunch !== persistedAutoLaunch) {
        await window.electronAPI.setAutoLaunch(draftAutoLaunch);
        setPersistedAutoLaunch(draftAutoLaunch);
      }
      setDirty(false);
      showToast('تنظیمات ذخیره شد');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftTheme(theme as ThemeValue);
    setDraftAccent(accentColor);
    setDraftCalendar(settings.calendarType || 'gregorian');
    setDraftCardT(settings.cardTransparency || '0');
    setDraftWidgetT(settings.widgetTransparency || '0');
    setDraftShowOnStartup(settings.showOnStartup !== 'false');
    setDraftMorning(settings.morningNotification !== 'false');
    setDraftAutoLaunch(persistedAutoLaunch);
    applyThemeToDom(theme as ThemeValue);
    setDirty(false);
    showToast('تغییرات لغو شد', 'info');
  };

  const tabs = [
    { id: 'general', label: 'عمومی', icon: <Palette className="w-4 h-4" /> },
    { id: 'notifications', label: 'اعلان‌ها', icon: <Bell className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'میانبرها', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'data', label: 'داده‌ها', icon: <Download className="w-4 h-4" /> },
    { id: 'about', label: 'درباره', icon: <Info className="w-4 h-4" /> },
  ].filter(t => !(isNative && t.id === 'shortcuts'));

  const handleExport = async (format: string) => {
    const result = await window.electronAPI.exportData(format);
    if (result?.success) showToast('خروجی با موفقیت گرفته شد');
  };

  const handleImport = async () => {
    const result = await window.electronAPI.importData();
    if (result?.success) {
      showToast('داده‌ها با موفقیت وارد شد');
      window.location.reload();
    }
  };

  const handleDeleteAll = () => {
    showConfirm({
      title: 'حذف همه تسک‌ها',
      message: 'همه تسک‌ها حذف شوند؟ این عمل قابل بازگشت نیست.',
      confirmLabel: 'حذف همه',
      onConfirm: async () => {
        await window.electronAPI.deleteAllTasks();
        refreshCurrentView();
        showToast('همه تسک‌ها حذف شدند', 'error');
      },
    });
  };

  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button onClick={() => { onChange(!checked); markDirty(); }} className={cn('w-10 h-5 rounded-full transition-colors relative', checked ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', checked ? 'right-0.5' : 'right-5')} />
      </button>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">تنظیمات</h1>
          {hasChanges && (
            <span className="text-xs text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">تغییرات ذخیره‌نشده</span>
          )}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 animate-slide-up sticky top-0 z-10">
            <span className="text-xs text-muted-foreground flex-1">تغییراتی دادی که هنوز ذخیره نشده</span>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <X className="w-3.5 h-3.5" /> انصراف
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-3">ظاهر</h3>
              <div className="flex gap-2 mb-4">
                <button onClick={() => { setDraftTheme('dark'); markDirty(); }}
                  className={cn('flex items-center gap-2 px-4 py-3 rounded-lg border text-sm transition-all',
                    draftTheme === 'dark' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                  <Moon className="w-4 h-4" />تاریک
                </button>
                <button onClick={() => { setDraftTheme('light'); markDirty(); }}
                  className={cn('flex items-center gap-2 px-4 py-3 rounded-lg border text-sm transition-all',
                    draftTheme === 'light' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                  <Sun className="w-4 h-4" />روشن
                </button>
                <button onClick={() => { setDraftTheme('system'); markDirty(); }}
                  className={cn('flex items-center gap-2 px-4 py-3 rounded-lg border text-sm transition-all',
                    draftTheme === 'system' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                  <Monitor className="w-4 h-4" />سیستم
                </button>
              </div>

              <h4 className="text-sm font-medium mb-2">رنگ اصلی</h4>
              <div className="flex gap-2 mb-4">
                {ACCENT_COLORS.map(c => (
                  <button key={c.value} onClick={() => { setDraftAccent(c.value); markDirty(); }}
                    className={cn('w-8 h-8 rounded-full transition-all', draftAccent === c.value && 'ring-2 ring-offset-2 ring-offset-background scale-110')}
                    style={{ backgroundColor: c.color }} title={c.name} />
                ))}
              </div>

              <h4 className="text-sm font-medium mb-1">شفافیت کارت‌ها</h4>
              <p className="text-xs text-muted-foreground mb-2">۰٪ یعنی کاملاً توپر، ۸۰٪ یعنی خیلی شیشه‌ای</p>
              <p className="text-xs text-muted-foreground mb-2">داخل برنامه</p>
              <div className="flex gap-2 mb-3">
                {TRANSPARENCY_STEPS.map(v => (
                  <button key={v} onClick={() => { setDraftCardT(String(v)); markDirty(); }}
                    className={cn('flex-1 py-2 rounded-lg border text-sm transition-all',
                      draftCardT === String(v) ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                    {FA_PCT[v]}
                  </button>
                ))}
              </div>
              {!isNative && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">ویجت دسکتاپ</p>
                  <div className="flex gap-2">
                    {TRANSPARENCY_STEPS.map(v => (
                      <button key={v} onClick={() => { setDraftWidgetT(String(v)); markDirty(); }}
                        className={cn('flex-1 py-2 rounded-lg border text-sm transition-all',
                          draftWidgetT === String(v) ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                        {FA_PCT[v]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-1">تقویم</h3>
              <p className="text-xs text-muted-foreground mb-3">نحوه نمایش تاریخ‌ها در برنامه</p>
              <div className="flex gap-2">
                <button onClick={() => { setDraftCalendar('gregorian'); markDirty(); }}
                  className={cn('flex-1 px-4 py-3 rounded-lg border text-sm transition-all',
                    draftCalendar === 'gregorian' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                  میلادی
                </button>
                <button onClick={() => { setDraftCalendar('jalali'); markDirty(); }}
                  className={cn('flex-1 px-4 py-3 rounded-lg border text-sm transition-all',
                    draftCalendar === 'jalali' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
                  شمسی
                </button>
              </div>
            </div>

            {!isNative && (
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-3">راه‌اندازی</h3>
              <ToggleSwitch checked={draftAutoLaunch} onChange={setDraftAutoLaunch} label="اجرای خودکار هنگام روشن شدن ویندوز" />
              <ToggleSwitch checked={draftShowOnStartup} onChange={setDraftShowOnStartup} label="نمایش پنجره امروز هنگام شروع" />
            </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-4 rounded-xl border border-border/50 bg-card animate-fade-in">
            <h3 className="text-sm font-medium mb-3">اعلان‌ها</h3>
            <ToggleSwitch checked={draftMorning} onChange={setDraftMorning} label="یادآوری صبحگاهی" />
            <button
              onClick={() => window.electronAPI.showNotification('تست اعلان', 'اگر این پیام را دیدی، مجوز اعلان درست است')}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm text-foreground hover:bg-muted transition-colors"
            >
              تست اعلان فوری
            </button>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="p-4 rounded-xl border border-border/50 bg-card animate-fade-in">
            <h3 className="text-sm font-medium mb-4">میانبرهای صفحه‌کلید</h3>
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted-foreground">{s.action}</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono text-foreground">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-3">خروجی گرفتن</h3>
              <div className="flex gap-2">
                <button onClick={() => handleExport('json')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                  <Download className="w-4 h-4" />JSON
                </button>
                <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">
                  <Download className="w-4 h-4" />CSV
                </button>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-3">وارد کردن</h3>
              <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">
                <Upload className="w-4 h-4" />انتخاب فایل JSON
              </button>
            </div>
            {!isNative && lanInfo && (
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-1 flex items-center gap-2"><Wifi className="w-4 h-4 text-primary" />همگام‌سازی شبکه محلی (LAN)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {lanInfo.running
                  ? 'سرور فعال است — برنامه گوشی را با این آدرس و توکن به کامپیوتر وصل کنید'
                  : (lanInfo.error || 'سرور راه‌اندازی نشد')}
              </p>
              {lanInfo.running && (
                <>
                  <div className="space-y-1.5 mb-2">
                    {lanInfo.addresses.map((a, i) => (
                      <div key={a} className="flex items-center gap-2" dir="ltr">
                        <span className={cn('flex-1 font-mono text-xs px-2 py-1.5 rounded bg-muted truncate', i === 0 ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{a}</span>
                        <button onClick={() => copyToClipboard(a)} title="کپی آدرس" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {lanInfo.addresses.length === 0 && (
                      <p className="text-xs text-destructive">آدرس شبکه‌ای پیدا نشد — اتصال اینترنت/وای‌فای بررسی شود</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2" dir="ltr">
                    <span className="flex-1 font-mono text-xs px-2 py-1.5 rounded bg-muted truncate">{lanInfo.token}</span>
                    <button onClick={() => copyToClipboard(lanInfo.token)} title="کپی توکن" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={handleRegenToken} className="px-3 py-1.5 rounded-lg border border-border bg-muted text-xs text-muted-foreground hover:bg-muted/70">
                    تولید توکن جدید
                  </button>
                </>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">هر دو دستگاه باید به یک وای‌فای متصل باشند. اگر ویندوز در اولین اجرا درباره فایروال پرسید، «دسترسی» (Allow) را بزنید.</p>
            </div>
            )}
            {isNative && (
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-sm font-medium mb-1 flex items-center gap-2"><Wifi className="w-4 h-4 text-primary" />همگام‌سازی شبکه محلی (LAN)</h3>
              <p className="text-xs text-muted-foreground mb-3">آدرس و توکن را از «تنظیمات ← داده‌ها» در برنامه ویندوز بگیرید و اینجا وارد کنید</p>
              <input
                value={lanAddr}
                onChange={e => setLanAddr(e.target.value)}
                placeholder="http://192.168.1.5:8787"
                dir="ltr" inputMode="url" autoCapitalize="off" autoCorrect="off"
                className="w-full mb-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground"
              />
              <input
                value={lanToken}
                onChange={e => setLanToken(e.target.value)}
                placeholder="توکن"
                dir="ltr" autoCapitalize="off" autoCorrect="off"
                className="w-full mb-3 px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={handleLanSync} disabled={lans.syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60">
                  {lans.syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {lans.syncing ? 'در حال همگام‌سازی...' : 'ذخیره و همگام‌سازی'}
                </button>
                {lans.configured && (
                  <button onClick={() => { clearLanConfig(); setLanAddr(''); setLanToken(''); showToast('اتصال قطع شد', 'info'); }}
                    className="px-4 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:bg-muted/70">
                    قطع اتصال
                  </button>
                )}
              </div>
              {lans.lastError && !lans.syncing ? (
                <p className="text-xs text-destructive mb-1">
                  {lans.lastError === 'unreachable'
                    ? 'به کامپیوتر وصل نشد — هر دو به یک وای‌فای متصل و برنامه ویندوز باز باشد'
                    : lans.lastError === 'bad_token'
                      ? 'توکن نادرست است'
                      : `خطا: ${lans.lastError}`}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {lans.lastSyncAt
                  ? `آخرین همگام‌سازی: ${new Date(lans.lastSyncAt).toLocaleString('fa-IR')}`
                  : 'هنوز همگام‌سازی نشده'}
              </p>
            </div>
            )}
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5">
              <h3 className="text-sm font-medium mb-2 text-destructive">خطرناک</h3>
              <p className="text-xs text-muted-foreground mb-3">حذف همه تسک‌ها. این عمل قابل بازگشت نیست.</p>
              <button onClick={handleDeleteAll} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">
                <Trash2 className="w-4 h-4" />حذف همه تسک‌ها
              </button>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="p-4 rounded-xl border border-border/50 bg-card text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-1">Nick Task Reminder</h2>
            <p className="text-muted-foreground text-sm mb-2">نسخه {appVersion}</p>
            <p className="text-muted-foreground text-xs">برنامه مدیریت وظایف و یادآوری</p>
            <p className="text-muted-foreground text-xs mt-2">سازنده: احمد نیکان</p>
            <a href="mailto:ahmad.nkn86@gmail.com" dir="ltr" className="text-primary text-xs hover:underline">ahmad.nkn86@gmail.com</a>
            <p className="text-muted-foreground text-[11px] mt-2">© ۲۰۲۶ — استفاده رایگان؛ انتشار به نام خود ممنوع</p>
          </div>
        )}
      </div>
    </div>
  );
}
