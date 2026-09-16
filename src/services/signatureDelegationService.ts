import { User } from '../types';
import { mockUsers } from '../mock/data';
import { loadLocalCollection, loadLocalValue, saveLocalValue } from './localStore';
import { compareJalali, todayJalali } from '../utils/jalaliDate';

/**
 * «جانشین امضا» — هر کاربری که مسئول یک Signature Stage است می‌تواند برای
 * خودش یک جانشین تعیین کند تا در صورت نیاز به‌جای او امضا کند.
 *
 * جانشینی هیچ Permission دیگری را منتقل نمی‌کند: جانشین فقط می‌تواند همان
 * امضاهایی را انجام دهد که Signature Request آنها به شخص اصلی تخصیص یافته
 * است، و به هیچ داده یا عملیات دیگری از شخص اصلی دسترسی پیدا نمی‌کند.
 */
export interface SignatureDelegation {
  /** شخص اصلی (Assigned Signer) که جانشین را تعیین کرده است. */
  ownerUserId: string;
  ownerName: string;
  /** کاربری که به جانشینی امضا می‌کند. */
  delegateUserId: string;
  delegateName: string;
  isActive: boolean;
  /** بازه اختیاری جانشینی (شمسی). خالی یعنی بدون محدودیت زمانی. */
  fromDateJalali?: string;
  toDateJalali?: string;
  updatedAt: string;
}

const DELEGATIONS_KEY = 'signatureDelegations';

const readAll = (): SignatureDelegation[] => loadLocalValue<SignatureDelegation[]>(DELEGATIONS_KEY, []);
const writeAll = (items: SignatureDelegation[]) => saveLocalValue(DELEGATIONS_KEY, items);

/** آیا امروز داخل بازه جانشینی است؟ بازه خالی یعنی همیشه. */
const isWithinWindow = (delegation: SignatureDelegation): boolean => {
  const today = todayJalali();
  if (delegation.fromDateJalali && compareJalali(today, delegation.fromDateJalali) < 0) return false;
  if (delegation.toDateJalali && compareJalali(today, delegation.toDateJalali) > 0) return false;
  return true;
};

export const getDelegationFor = (ownerUserId: string): SignatureDelegation | undefined =>
  readAll().find((item) => item.ownerUserId === ownerUserId);

/** جانشینِ فعالِ امروزِ یک شخص — مبنای تصمیم‌گیری همه بررسی‌های امضا. */
export const getActiveDelegationFor = (ownerUserId: string): SignatureDelegation | undefined => {
  const delegation = getDelegationFor(ownerUserId);
  if (!delegation || !delegation.isActive) return undefined;
  return isWithinWindow(delegation) ? delegation : undefined;
};

/** آیا این کاربر همین حالا جانشین فعال آن شخص است؟ */
export const isActiveDelegateOf = (actorUserId: string, ownerUserId: string): boolean =>
  getActiveDelegationFor(ownerUserId)?.delegateUserId === actorUserId;

/** فهرست کسانی که این کاربر هم‌اکنون جانشین فعال آنهاست. */
export const getOwnersDelegatedTo = (actorUserId: string): SignatureDelegation[] =>
  readAll().filter((item) => item.delegateUserId === actorUserId && item.isActive && isWithinWindow(item));

/**
 * تعیین/به‌روزرسانی جانشین. کاربر فقط برای خودش مجاز است؛ مدیر سیستم
 * می‌تواند برای دیگران هم تنظیم کند. این بررسی در همین Service Layer
 * انجام می‌شود، نه فقط در UI.
 */
export const setDelegation = (
  input: {
    ownerUserId: string;
    delegateUserId: string;
    isActive: boolean;
    fromDateJalali?: string;
    toDateJalali?: string;
  },
  actor: User
): SignatureDelegation => {
  const isSelf = actor.id === input.ownerUserId;
  const isAdmin = actor.role === 'ADMIN';
  if (!isSelf && !isAdmin) {
    throw new Error('شما فقط می‌توانید جانشین امضای خودتان را تعیین کنید.');
  }
  if (!input.delegateUserId) throw new Error('انتخاب جانشین الزامی است.');
  if (input.delegateUserId === input.ownerUserId) {
    throw new Error('جانشین نمی‌تواند خود شخص امضاکننده باشد.');
  }
  if (input.fromDateJalali && input.toDateJalali && compareJalali(input.fromDateJalali, input.toDateJalali) > 0) {
    throw new Error('تاریخ پایان جانشینی نمی‌تواند پیش از تاریخ شروع باشد.');
  }

  const users = loadLocalCollection('users', mockUsers);
  const owner = users.find((user) => user.id === input.ownerUserId);
  const delegate = users.find((user) => user.id === input.delegateUserId);
  if (!owner) throw new Error('کاربر امضاکننده یافت نشد.');
  if (!delegate) throw new Error('کاربر جانشین یافت نشد.');

  const record: SignatureDelegation = {
    ownerUserId: owner.id,
    ownerName: owner.fullName,
    delegateUserId: delegate.id,
    delegateName: delegate.fullName,
    isActive: input.isActive,
    fromDateJalali: input.fromDateJalali || undefined,
    toDateJalali: input.toDateJalali || undefined,
    updatedAt: new Date().toISOString(),
  };

  const items = readAll().filter((item) => item.ownerUserId !== owner.id);
  writeAll([record, ...items]);
  return record;
};

/** حذف کامل جانشینی. همان قواعد دسترسی setDelegation. */
export const clearDelegation = (ownerUserId: string, actor: User): void => {
  if (actor.id !== ownerUserId && actor.role !== 'ADMIN') {
    throw new Error('شما فقط می‌توانید جانشین امضای خودتان را حذف کنید.');
  }
  writeAll(readAll().filter((item) => item.ownerUserId !== ownerUserId));
};

/**
 * جانشینیِ فعالی که مالک آن، دارنده مجوز موردنظر است.
 *
 * بعضی مراحل امضا/تأیید به‌جای یک کاربر مشخص، به «هر کسی که فلان مجوز را
 * دارد» تخصیص می‌یابند (مثل تأیید نهایی تایید جلسه که با
 * APPROVE_MEETING_CONFIRMATION گیت شده است). در این حالت مرجع تصمیم‌گیری
 * این است که آیا کاربر جاری جانشین فعالِ یکی از دارندگان همان مجوز هست
 * یا نه. جانشینی هیچ مجوز دیگری را منتقل نمی‌کند.
 */
export const getDelegationGrantingPermission = (
  actorUserId: string,
  permission: string
): SignatureDelegation | undefined => {
  const users = loadLocalCollection('users', mockUsers);
  return getOwnersDelegatedTo(actorUserId).find((delegation) => {
    const owner = users.find((user) => user.id === delegation.ownerUserId);
    if (!owner) return false;
    return owner.role === 'ADMIN' || (owner.permissions || []).includes(permission);
  });
};

/**
 * آیا این کاربر مجاز به امضای درخواستی است که به assignedSignerUserId
 * تخصیص یافته؟ نتیجه می‌گوید امضا مستقیم است یا به جانشینی.
 * تنها مرجع تصمیم‌گیری برای همه Signature Stageها.
 */
export const resolveSigningAuthority = (
  assignedSignerUserId: string,
  actorUserId: string
): { allowed: boolean; asDelegate: boolean } => {
  if (assignedSignerUserId === actorUserId) return { allowed: true, asDelegate: false };
  if (isActiveDelegateOf(actorUserId, assignedSignerUserId)) return { allowed: true, asDelegate: true };
  return { allowed: false, asDelegate: false };
};
