import type { WizardState, CommercialCleaningType, CleaningWizardChecklistState, ScopeKey, ServiceType } from '../types';
import { fmtAUD } from '../utils/formatting';
import { isRec, FALLBACK_INCLUSIONS } from './service-data';
import { deriveCleaningState, buildCleaningChecklistFromWizard } from './service-helpers';
import { hourlyRate } from './pricing/engine';
import { computeMins, cleaningAddonsForScope } from './estimation';

export interface ScopeCardState {
  showSheet: boolean;
  minutes: number;
  recommended: boolean;
  hourlyRateDisplay: string | null;
  hourlyHours: number | null;
  isHourlyCard: boolean;
  isCleaningWizardCard: boolean;
  isCommercialNicheCard: boolean;
  labelId: string;
  hookId: string;
  isCarCleaning: boolean;
  isCleaning: boolean;
  isDumpRunsCard: boolean;
  isDeliveryCard: boolean;
  isTransportCard: boolean;
  isLaundryCard: boolean;
  isSneakerCareCard: boolean;
  isBinCleans: boolean;
  isConfigOpen: boolean;
  visibleInclusions: string[];
  hiddenInclusions: string[];
  moreCount: number;
  shouldShowHidden: boolean;
  inclusionMinClass: string;
}

export function computeScopeCardState(
  S: WizardState,
  sc: any,
  activeServiceId: string | null,
  conditionMult: number,
  openChecklists: Record<string, boolean>
): ScopeCardState {
  const showSheet = !!openChecklists[sc.key];
  const minutes = computeMins(S, S.service as ServiceType, sc.key as ScopeKey, conditionMult);
  const recommended = isRec(S.service as string, sc.key as string);

  const hourlyRateDisplay =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? `${fmtAUD(hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}/hr`
      : null;
  const hourlyHours =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? Math.max(3, Math.round(S.paramsByService.cleaning?.hours ?? 3))
      : null;

  const isHomeCleaning = S.service === 'cleaning' && S.context !== 'commercial';
  const isCommercialCleaning = S.service === 'cleaning' && S.context === 'commercial';
  const commercialNicheKeys: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
  const isCommercialNicheCard = isCommercialCleaning && commercialNicheKeys.includes(sc.key as CommercialCleaningType);
  const isHourlyCard = isHomeCleaning && sc.key === 'hourly';
  const isCleaningWizardCard = isHomeCleaning && !isHourlyCard;
  const addonsState = cleaningAddonsForScope(sc.key, S.cleaningAddons);
  const labelId = `sc-${sc.key}-label`;
  const hookId = `sc-${sc.key}-desc`;
  const isCarCleaning = S.service === 'auto';
  const isCleaning = S.service === 'cleaning';
  const isDumpRunsCard = S.service === 'dump' && sc.key === 'dump_runs';
  const isDeliveryCard = S.service === 'dump' && sc.key === 'dump_delivery';
  const isTransportCard = S.service === 'dump' && sc.key === 'dump_transport';
  const isLaundryCard = S.service === 'laundry_sneakers' && sc.key === 'laundry';
  const isSneakerCareCard = S.service === 'laundry_sneakers' && sc.key === 'sneaker_care';
  const { cleaningSizeKey, bathroomsChoice, cupboardsSelected, wallsSelected, messLevel } = deriveCleaningState(S, sc.key);
  const isBinCleans = S.service === 'dump' && sc.key === 'bin_cleans';
  const isConfigOpen = activeServiceId === sc.key;

  let inclusions: string[] = Array.isArray(sc.inclusions) ? [...sc.inclusions] : [];
  if (isCleaningWizardCard) {
    const propertySize: CleaningWizardChecklistState['propertySize'] =
      cleaningSizeKey === 'studio' ? 'studio'
      : cleaningSizeKey === 'small' ? '1-2'
      : cleaningSizeKey === 'medium' ? '3-4'
      : '5+';
    const messLevelLabel: CleaningWizardChecklistState['messLevel'] =
      messLevel === 'light' ? 'tidy' : messLevel === 'heavy' ? 'reset' : 'lived-in';
    const addOns: CleaningWizardChecklistState['addOns'] = {
      oven: Boolean((addonsState as any).addon_oven),
      fridge: Boolean((addonsState as any).addon_fridge),
      windows: Boolean((addonsState as any).addon_windows),
      cupboards: cupboardsSelected,
      walls: wallsSelected,
    };
    inclusions = buildCleaningChecklistFromWizard({
      propertySize,
      bathrooms: bathroomsChoice as 1 | 2 | 3,
      messLevel: messLevelLabel,
      addOns,
      scope: sc.key,
    });
  }
  if (!isCleaning && !isCarCleaning && inclusions.length < 4) {
    inclusions = inclusions.concat(FALLBACK_INCLUSIONS.slice(0, 4 - inclusions.length));
  }

  const visibleInclusions = isHourlyCard ? [] : inclusions.slice(0, 4);
  const hiddenInclusions = isHourlyCard ? [] : inclusions.slice(4);
  const moreCount = isHourlyCard ? 0 : Math.max(0, inclusions.length - visibleInclusions.length);
  const shouldShowHidden = hiddenInclusions.length > 0 && showSheet;
  const inclusionMinClass = ['windows', 'yard', 'dump', 'laundry_sneakers'].includes(S.service as any)
    ? 'min-h-[52px]'
    : 'min-h-[72px]';

  return {
    showSheet, minutes, recommended, hourlyRateDisplay, hourlyHours,
    isHourlyCard, isCleaningWizardCard, isCommercialNicheCard,
    labelId, hookId, isCarCleaning, isCleaning,
    isDumpRunsCard, isDeliveryCard, isTransportCard, isLaundryCard, isSneakerCareCard,
    isBinCleans, isConfigOpen,
    visibleInclusions, hiddenInclusions, moreCount, shouldShowHidden, inclusionMinClass,
  };
}
