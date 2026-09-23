import { useEffect, useState } from 'react';
import { loadLocalValue, saveLocalValue } from './localStore';

export interface OrganizationProfile {
  name: string;
  systemTitle: string;
  logoUrl: string;
  phone: string;
  email: string;
  website: string;
  nationalId: string;
  economicCode: string;
  address: string;
}

export const DEFAULT_ORGANIZATION_PROFILE: OrganizationProfile = {
  name: '',
  systemTitle: 'سامانه مدیریت جلسات و مصوبات',
  logoUrl: '/pars-project.png',
  phone: '',
  email: '',
  website: '',
  nationalId: '',
  economicCode: '',
  address: '',
};

export const getOrganizationProfile = (): OrganizationProfile => ({
  ...DEFAULT_ORGANIZATION_PROFILE,
  ...loadLocalValue<Partial<OrganizationProfile>>('organizationProfile', {}),
});

export const saveOrganizationProfile = (profile: OrganizationProfile): void => {
  saveLocalValue('organizationProfile', profile);
  window.dispatchEvent(new Event('organization-profile-changed'));
};

export const useOrganizationProfile = (): OrganizationProfile => {
  const [profile, setProfile] = useState<OrganizationProfile>(getOrganizationProfile);
  useEffect(() => {
    const refresh = () => setProfile(getOrganizationProfile());
    window.addEventListener('organization-profile-changed', refresh);
    return () => window.removeEventListener('organization-profile-changed', refresh);
  }, []);
  return profile;
};
