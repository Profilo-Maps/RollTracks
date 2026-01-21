// Utility functions will be exported from here
export { supabase } from './supabase';
export {
  createAppError,
  getUserFriendlyMessage,
  logError,
  handleError,
  ErrorCode,
} from './errors';
export type { AppError } from './errors';
export {
  processRatings,
  calculateMapRegion,
  getMarkerColor,
} from './homeScreenUtils';
export type { ProcessedRatedFeature, MapRegion } from './homeScreenUtils';
