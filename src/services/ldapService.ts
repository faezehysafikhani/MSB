import { ApiResponse } from '../types';
import { apiClient } from './api/apiClient';
import { loadLocalValue, saveLocalValue } from './localStore';

/**
 * تنظیمات اتصال به سرویس دایرکتوری سازمانی (LDAP / Active Directory).
 *
 * در این مرحله فقط Configuration و ساختار آماده اتصال است؛ هیچ اتصال
 * واقعی، Fake یا Hard-coded ای وجود ندارد و Login فعلی سامانه به هیچ
 * وجه به LDAP وابسته نیست.
 *
 * رمز عبور Bind هرگز ذخیره یا برگردانده نمی‌شود — دقیقاً مثل الگوی
 * hasApiKey در smsService، فقط پرچم hasBindPassword نگهداری می‌شود.
 */
export interface LdapSettings {
  isEnabled: boolean;
  host: string;
  port: number;
  useSsl: boolean;
  useStartTls: boolean;
  baseDn: string;
  bindDn: string;
  hasBindPassword: boolean;
  userSearchBase: string;
  userSearchFilter: string;
}

export const DEFAULT_LDAP_SETTINGS: LdapSettings = {
  isEnabled: false,
  host: '',
  port: 389,
  useSsl: false,
  useStartTls: false,
  baseDn: '',
  bindDn: '',
  hasBindPassword: false,
  userSearchBase: '',
  userSearchFilter: '(sAMAccountName={username})',
};

export type LdapConnectionTestState = 'NOT_CONFIGURED' | 'BACKEND_REQUIRED';

export interface LdapConnectionTestResult {
  state: LdapConnectionTestState;
  message: string;
}

class MockLdapService {
  public getSettings(): LdapSettings {
    const saved = loadLocalValue<Partial<LdapSettings>>('ldapSettings', {});
    return { ...DEFAULT_LDAP_SETTINGS, ...saved };
  }

  /**
   * رمز عبور عمداً در Storage نوشته نمی‌شود؛ فقط این‌که رمزی تنظیم شده
   * یا نه نگهداری می‌شود. با آمدن Backend واقعی، رمز مستقیماً به همان
   * Endpoint ارسال خواهد شد.
   */
  public async updateSettings(settings: LdapSettings, newBindPassword?: string): Promise<ApiResponse<LdapSettings>> {
    const { hasBindPassword, ...rest } = settings;
    const safeSettings: LdapSettings = {
      ...rest,
      port: Number(settings.port) || DEFAULT_LDAP_SETTINGS.port,
      hasBindPassword: hasBindPassword || Boolean(newBindPassword && newBindPassword.trim()),
    };
    saveLocalValue('ldapSettings', safeSettings);
    return apiClient.simulateNetwork(safeSettings, 90);
  }

  public async clearBindPassword(): Promise<ApiResponse<LdapSettings>> {
    const settings = { ...this.getSettings(), hasBindPassword: false };
    saveLocalValue('ldapSettings', settings);
    return apiClient.simulateNetwork(settings, 60);
  }

  /**
   * تست اتصال. تا زمانی که Backend واقعی متصل نشده، این متد عمداً هیچ
   * نتیجه موفقیت جعلی برنمی‌گرداند و فقط وضعیت آمادگی پیکربندی را
   * گزارش می‌کند.
   */
  public async testConnection(): Promise<ApiResponse<LdapConnectionTestResult>> {
    const settings = this.getSettings();
    const missing: string[] = [];
    if (!settings.host.trim()) missing.push('آدرس سرور');
    if (!settings.baseDn.trim()) missing.push('Base DN');
    if (!settings.bindDn.trim()) missing.push('Bind DN');
    if (!settings.hasBindPassword) missing.push('رمز عبور Bind');

    if (missing.length > 0) {
      return apiClient.simulateNetwork(
        {
          state: 'NOT_CONFIGURED' as const,
          message: `پیکربندی کامل نیست — موارد زیر تنظیم نشده‌اند: ${missing.join('، ')}`,
        },
        80
      );
    }

    return apiClient.simulateNetwork(
      {
        state: 'BACKEND_REQUIRED' as const,
        message: 'پیکربندی کامل است و آماده اتصال. تست واقعی اتصال پس از راه‌اندازی سرویس سمت سرور انجام خواهد شد؛ در این نسخه اتصالی برقرار نمی‌شود.',
      },
      120
    );
  }
}

export const ldapService = new MockLdapService();
