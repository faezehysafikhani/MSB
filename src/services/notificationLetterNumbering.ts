import { ResolutionNotice } from '../types';
import { loadLocalCollection, loadLocalValue, saveLocalValue } from './localStore';

/**
 * Issues the «شماره نامه ابلاغیه» — the letter number of the ابلاغ document.
 *
 * Deliberately isolated from every other numbering scheme in the system:
 * it is NOT the resolution number, NOT the proposal's letter number, and
 * NOT the internal notice id. Keeping it in one module means changing the
 * sequence format later (a year prefix, a per-year reset, a padded serial)
 * is a one-file edit and never reaches a React component.
 *
 * When this mock store is replaced by the .NET backend, `issue...` becomes a
 * single call to a DB sequence / identity column inside the same transaction
 * that writes the notice — the seam is already in the right place.
 */

const SEQUENCE_KEY = 'notificationLetterSequence';

/**
 * Renders a sequence value as the stored letter number. Today that is the
 * bare serial starting at "1"; change only this function to adopt a
 * different format.
 */
export const formatNotificationLetterNumber = (sequence: number): string => String(sequence);

/**
 * Highest sequence already present in the issued notices. Used as a floor so
 * the counter can never hand out a number that is already on a notice — for
 * example after the counter is cleared, restored, or two tabs raced each
 * other on the shared store.
 */
const highestIssuedSequence = (): number => {
  const notices = loadLocalCollection<ResolutionNotice[]>('resolutionNotices', []);
  return notices.reduce((max, notice) => {
    const parsed = parseInt(String(notice.notificationLetterNumber ?? ''), 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);
};

/**
 * Reserves and returns the next letter number. Call this only once the ابلاغ
 * is certain to be written: opening or cancelling the form must never consume
 * a number, so nothing here runs until every validation has passed.
 */
export const issueNotificationLetterNumber = (): string => {
  const counter = loadLocalValue<number>(SEQUENCE_KEY, 0);
  const next = Math.max(counter, highestIssuedSequence()) + 1;
  saveLocalValue(SEQUENCE_KEY, next);
  return formatNotificationLetterNumber(next);
};
