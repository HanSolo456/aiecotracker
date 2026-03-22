'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, Moon, Sun, Palette, Globe, Bell, ShieldAlert, ClipboardList, Users, Megaphone, Cpu, Wrench } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { useTheme } from '@/components/ThemeProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/lib/authContext';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notifications';
import {
  disablePushForUser,
  enablePushForUser,
  getStoredNotificationPreferences,
  isPushSupported,
  saveNotificationPreferences,
  syncPushTokenForUser,
} from '@/lib/pushNotifications';

const categoryIcons: Record<NotificationCategory, typeof ClipboardList> = {
  passport_updates: ClipboardList,
  compliance_alerts: ShieldAlert,
  hazard_alerts: Bell,
  team_activity: Users,
  system_announcements: Megaphone,
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { user, profile } = useAuth();
  const isOrgAdmin = profile?.role === 'org_admin' && !!profile.orgId;
  const isSuperadmin = profile?.role === 'superadmin';
  const [pushSupported, setPushSupported] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [busyCategory, setBusyCategory] = useState<NotificationCategory | 'master' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showAllNotificationCategories, setShowAllNotificationCategories] = useState(false);
  const notificationPermission =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  const visibleCategories = showAllNotificationCategories
    ? NOTIFICATION_CATEGORIES
    : NOTIFICATION_CATEGORIES.slice(0, 2);
  const hiddenCategoryCount = Math.max(NOTIFICATION_CATEGORIES.length - 2, 0);

  useEffect(() => {
    isPushSupported().then(setPushSupported).catch(() => setPushSupported(false));
  }, []);

  useEffect(() => {
    let active = true;

    if (!user || user.isAnonymous) {
      setPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
      setPrefsLoading(false);
      return;
    }

    setPrefsLoading(true);
    getStoredNotificationPreferences(user.uid)
      .then((stored) => {
        if (!active) return;
        setPrefs(stored);
      })
      .finally(() => {
        if (active) setPrefsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function updatePrefs(nextPrefs: NotificationPreferences) {
    setPrefs(nextPrefs);

    if (!user || user.isAnonymous) return;

    await saveNotificationPreferences(user.uid, nextPrefs);
  }

  async function handleMasterToggle() {
    if (!user || user.isAnonymous) {
      setStatus('Sign in with a registered account to enable push notifications.');
      return;
    }

    setBusyCategory('master');
    setStatus(null);

    try {
      if (!prefs.enabled) {
        await enablePushForUser(user.uid);
        const nextPrefs = { ...prefs, enabled: true };
        await updatePrefs(nextPrefs);
        await syncPushTokenForUser(user.uid);
        setStatus('Push notifications are enabled on this browser.');
      } else {
        await disablePushForUser(user.uid);
        const nextPrefs = { ...prefs, enabled: false };
        await updatePrefs(nextPrefs);
        setStatus('Push notifications are disabled on this browser.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update notification permission.');
    } finally {
      setBusyCategory(null);
    }
  }

  async function handleCategoryToggle(category: NotificationCategory) {
    const nextPrefs = { ...prefs, [category]: !prefs[category] };
    setBusyCategory(category);
    setStatus(null);

    try {
      await updatePrefs(nextPrefs);
      setStatus(`${NOTIFICATION_CATEGORY_META[category].title} preference updated.`);
    } catch (error) {
      setPrefs(prefs);
      setStatus(error instanceof Error ? error.message : 'Failed to update notification preference.');
    } finally {
      setBusyCategory(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>
      <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)' }}
          >
            <Palette size={16} style={{ color: 'var(--lime)' }} />
          </div>
          <div>
            <h1 className="page-title text-3xl lg:text-4xl text-white">{t('settings.title')}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t('settings.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-10 mt-4 flex flex-col gap-4">

        {/* ── Theme Card ── */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-white mb-1">{t('settings.theme')}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.theme_desc')}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('light')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{
                border: `1px solid ${theme === 'light' ? 'var(--lime-border)' : 'var(--border)'}`,
                background: theme === 'light' ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                color: theme === 'light' ? 'var(--lime)' : 'var(--text-secondary)',
              }}
            >
              <Sun size={15} /> {t('settings.theme_light')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{
                border: `1px solid ${theme === 'dark' ? 'var(--lime-border)' : 'var(--border)'}`,
                background: theme === 'dark' ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                color: theme === 'dark' ? 'var(--lime)' : 'var(--text-secondary)',
              }}
            >
              <Moon size={15} /> {t('settings.theme_dark')}
            </button>
          </div>
        </div>

        {/* ── Language Card ── */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} style={{ color: 'var(--lime)' }} />
            <p className="text-sm font-semibold text-white">{t('settings.language')}</p>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.language_desc')}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLang('en')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{
                border: `1px solid ${lang === 'en' ? 'var(--lime-border)' : 'var(--border)'}`,
                background: lang === 'en' ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                color: lang === 'en' ? 'var(--lime)' : 'var(--text-secondary)',
              }}
            >
              🇬🇧 {t('settings.lang_en')}
            </button>
            <button
              onClick={() => setLang('hi')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{
                border: `1px solid ${lang === 'hi' ? 'var(--lime-border)' : 'var(--border)'}`,
                background: lang === 'hi' ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                color: lang === 'hi' ? 'var(--lime)' : 'var(--text-secondary)',
              }}
            >
              🇮🇳 {t('settings.lang_hi')}
            </button>
          </div>
        </div>

        {/* ── Factory Provisioning Card (Superadmin) ── */}
        {isSuperadmin && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wrench size={14} style={{ color: 'var(--lime)' }} />
              <p className="text-sm font-semibold text-white">Factory Provisioning</p>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Create factory inventory devices and generate bootstrap tokens without curl.
            </p>

            <button
              type="button"
              onClick={() => router.push('/superadmin/factory-devices')}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
            >
              Open Factory Device Tool
            </button>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} style={{ color: 'var(--lime)' }} />
                <p className="text-sm font-semibold text-white">Push Notifications</p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Enable browser push alerts for passport updates, compliance issues, hazards, team activity, and system notices.
              </p>
            </div>
            <button
              onClick={handleMasterToggle}
              disabled={!pushSupported || prefsLoading || busyCategory === 'master'}
              className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                border: `1px solid ${prefs.enabled ? 'var(--lime-border)' : 'var(--border)'}`,
                background: prefs.enabled ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                color: prefs.enabled ? 'var(--lime)' : 'var(--text-secondary)',
              }}
            >
              {busyCategory === 'master' ? 'Updating…' : prefs.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          <div
            className="rounded-2xl p-3 mb-3"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold text-white mb-1">What we can notify you about</p>
            <div className="grid gap-2">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <div key={category} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--lime)' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-semibold text-white">{NOTIFICATION_CATEGORY_META[category].title}: </span>
                    {NOTIFICATION_CATEGORY_META[category].description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!pushSupported && (
            <p className="text-xs mb-3" style={{ color: '#FCA5A5' }}>
              This browser does not support Firebase web push notifications.
            </p>
          )}

          {notificationPermission === 'denied' && (
            <p className="text-xs mb-3" style={{ color: '#FCA5A5' }}>
              Browser notification permission is blocked. Re-enable it in browser site settings first.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {visibleCategories.map((category) => {
              const Icon = categoryIcons[category];
              const meta = NOTIFICATION_CATEGORY_META[category];

              return (
                <div
                  key={category}
                  className="rounded-2xl p-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)' }}
                    >
                      <Icon size={15} style={{ color: 'var(--lime)' }} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{meta.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {meta.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCategoryToggle(category)}
                          disabled={!prefs.enabled || prefsLoading || busyCategory === category}
                          className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                          style={{
                            border: `1px solid ${prefs[category] ? 'var(--lime-border)' : 'var(--border)'}`,
                            background: prefs[category] ? 'var(--lime-glow)' : 'var(--bg-primary)',
                            color: prefs[category] ? 'var(--lime)' : 'var(--text-secondary)',
                          }}
                        >
                          {prefs[category] ? 'On' : 'Off'}
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hiddenCategoryCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllNotificationCategories((value) => !value)}
              className="mt-3 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              {showAllNotificationCategories ? (
                <>
                  Hide extra notification settings
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Show {hiddenCategoryCount} more notification setting{hiddenCategoryCount === 1 ? '' : 's'}
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          )}

          {status && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              {status}
            </p>
          )}
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
