import { t } from '@extension/i18n';

/** Relative time e.g. "2 hours ago", "a few seconds ago" */
export const formatRelativeTime = (ms: number): string => {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 10) return t('chatTimeFewSecondsAgo');
  if (sec < 60) return t('chatTimeSecondsAgo', String(sec));
  const min = Math.floor(sec / 60);
  if (min === 1) return t('chatTimeOneMinuteAgo');
  if (min < 60) return t('chatTimeMinutesAgo', String(min));
  const hr = Math.floor(min / 60);
  if (hr === 1) return t('chatTimeOneHourAgo');
  if (hr < 24) return t('chatTimeHoursAgo', String(hr));
  const d = Math.floor(hr / 24);
  if (d === 1) return t('chatTimeOneDayAgo');
  return t('chatTimeDaysAgo', String(d));
};
