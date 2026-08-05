/**
 * Public barrel for emerging sports (Golf + Formula 1) scaffolding.
 * Keep Football/Rugby imports out of this tree.
 */

export { isSportAccessible, isEmergingSport, normalizeRole, roleFromIsAdmin } from './featureFlags';
export type {
  EmergingSportKey,
  SportKey,
  UserRole,
  F1Constructor,
  F1Driver,
  F1Prediction,
  GolfPlayer,
  GolfPrediction,
  F1GridMode,
  EmergingProfileSlice,
} from './types';
export { SportIcon, SPORT_ICON_SRC, SPORT_ICON_SRC_MUTED } from './sportIcons';
export {
  HELMET_MAP,
  F1_CONSTRUCTOR_DISPLAY_NAME,
  helmetSrcForConstructor,
  displayConstructorName,
  normalizeConstructorId,
} from './f1HelmetAssets';

export {
  useEmergingProfile,
  useUserRole,
  useF1ConstructorsQuery,
  useF1DriversQuery,
  useGolfPlayersQuery,
  useGolfMulliganWallet,
  emergingQueryKeys,
} from './hooks/useEmergingSports';

export { default as EmergingSearchCombobox } from './components/EmergingSearchCombobox';
export { default as EmergingSportWorkspace } from './components/EmergingSportWorkspace';
export { default as F1GridPredictor } from './components/f1/F1GridPredictor';
export { default as F1DriverCard } from './components/f1/F1DriverCard';
export { default as F1HelmetIcon } from './components/f1/F1HelmetIcon';
export { default as GolfMulliganPanel } from './components/golf/GolfMulliganPanel';
export { default as GolfTierPredictor } from './components/golf/GolfTierPredictor';
