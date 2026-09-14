const STORAGE_PREFIX = 'postbank-mosavabat-v1:';

export type LocalCollectionKey =
  | 'users'
  | 'meetings'
  | 'resolutions'
  | 'tasks'
  | 'approvals'
  | 'activityLogs'
  | 'notifications'
  | 'boardMinutes'
  | 'resolutionNotices'
  | 'resolutionFollowUps'
  | 'governanceAudit'
  | 'outcomeLetters';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const loadLocalCollection = <T,>(key: LocalCollectionKey, fallback: T): T => {
  if (typeof window === 'undefined') return clone(fallback);
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return saved ? (JSON.parse(saved) as T) : clone(fallback);
  } catch {
    return clone(fallback);
  }
};

export const saveLocalCollection = <T,>(key: LocalCollectionKey, value: T): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
};

export const loadLocalValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return saved === null ? fallback : (JSON.parse(saved) as T);
  } catch {
    return fallback;
  }
};

export const saveLocalValue = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
};
