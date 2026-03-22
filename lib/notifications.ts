export const NOTIFICATION_CATEGORIES = [
    'passport_updates',
    'compliance_alerts',
    'hazard_alerts',
    'team_activity',
    'system_announcements',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = {
    enabled: boolean;
} & Record<NotificationCategory, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    enabled: false,
    passport_updates: true,
    compliance_alerts: true,
    hazard_alerts: true,
    team_activity: false,
    system_announcements: true,
};

export const NOTIFICATION_CATEGORY_META: Record<
    NotificationCategory,
    { title: string; description: string; testTitle: string; testBody: string; testPath: string }
> = {
    passport_updates: {
        title: 'Passport updates',
        description: 'New DPP generated, scan completed, or lifecycle records updated.',
        testTitle: 'Passport Update',
        testBody: 'A Digital Product Passport was updated and is ready to review.',
        testPath: '/history',
    },
    compliance_alerts: {
        title: 'Compliance alerts',
        description: 'Standards changes, missing compliance evidence, or routing exceptions.',
        testTitle: 'Compliance Alert',
        testBody: 'A compliance item needs review before this part moves forward.',
        testPath: '/passport',
    },
    hazard_alerts: {
        title: 'Hazard alerts',
        description: 'Hazardous material, disposal requirement, or elevated sensor risk.',
        testTitle: 'Hazard Alert',
        testBody: 'A hazardous-material event was flagged and requires operator attention.',
        testPath: '/iot-monitor',
    },
    team_activity: {
        title: 'Team activity',
        description: 'Worker actions, org updates, or shared progress inside your team.',
        testTitle: 'Team Activity',
        testBody: 'A teammate completed a new action in your organization workspace.',
        testPath: '/org/dashboard',
    },
    system_announcements: {
        title: 'System announcements',
        description: 'App-level maintenance, feature rollouts, or critical platform notices.',
        testTitle: 'System Announcement',
        testBody: 'AI-EcoTrack notifications are configured correctly on this device.',
        testPath: '/settings',
    },
};

export function mergeNotificationPreferences(
    prefs?: Partial<NotificationPreferences> | null,
): NotificationPreferences {
    return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...prefs,
    };
}

export function notificationTokenDocId(token: string): string {
    return encodeURIComponent(token);
}
