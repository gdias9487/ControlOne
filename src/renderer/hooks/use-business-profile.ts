import { catalogCopy, normalizeBusinessProfile, profileHasModule, usesCustomerPlans } from '@shared/business-profile';
import { useTheme } from '@/contexts/theme-context';

export function useBusinessProfile() {
  const { settings } = useTheme();
  const profile = normalizeBusinessProfile(settings?.businessProfile);
  const copy = catalogCopy(profile);

  function hasModule(module: Parameters<typeof profileHasModule>[1]) {
    return profileHasModule(profile, module);
  }

  return {
    profile,
    copy,
    hasModule,
    usesInventory: hasModule('inventory'),
    usesPos: hasModule('pos'),
    usesPlansLabel: copy.navLabel === 'Planos',
    usesCustomerPlans: usesCustomerPlans(profile),
  };
}
