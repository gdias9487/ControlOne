import {
  normalizeBusinessProfile,
  profileHasModule,
  usesCustomerPlans,
  type BusinessModule,
  type BusinessProfile,
} from '../../shared/business-profile';
import { getPrisma } from '../database/client';

export async function currentBusinessProfile(): Promise<BusinessProfile> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<{ businessProfile: string | null }>>(
    `SELECT "businessProfile" FROM "Settings" WHERE "id" = 'default'`,
  );
  return normalizeBusinessProfile(rows[0]?.businessProfile);
}

export async function hasBusinessModule(module: BusinessModule): Promise<boolean> {
  return profileHasModule(await currentBusinessProfile(), module);
}

export async function usesCustomerPlansEnabled(): Promise<boolean> {
  return usesCustomerPlans(await currentBusinessProfile());
}
