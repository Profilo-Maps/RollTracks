# Repository Cleanup Plan - App Release Preparation

**Generated:** 2025-01-XX  
**Purpose:** Comprehensive analysis and plan for preparing the React Native application for public testing release

---

## Executive Summary

This document provides a complete analysis of the repository structure and a detailed plan for cleanup operations. The repository contains:
- **19 test files** across 8 __tests__ directories
- **11 root-level documentation files** (scattered)
- **14 documentation files** in docs/ folder
- **4 backend documentation files** in supabase/ folder

The cleanup will consolidate documentation, remove backend-specific files, and ensure all tests are relevant and functional.

---

## 1. Test Files Catalog

### 1.1 Root-Level Tests (`__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `__tests__/App.test.tsx` | Main app component test | **KEEP** - Core functionality |
| `__tests__/Navigation.test.tsx` | Navigation structure test | **KEEP** - Core functionality |
| `__tests__/scripts/copy-geojson-to-assets.test.js` | Build script test | **KEEP** - Script used in prebuild ✅ |

### 1.2 Component Tests (`src/components/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `HighlightCutout.test.tsx` | Tour highlight component | **KEEP** - Active feature |
| `TourOverlay.test.tsx` | Tour overlay component | **KEEP** - Active feature |

### 1.3 Context Tests (`src/contexts/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `TourContext.test.tsx` | Tour context state management | **KEEP** - Core functionality |
| `TourNavigationGuard.test.tsx` | Tour navigation protection | **KEEP** - Core functionality |

### 1.4 Hook Tests (`src/hooks/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `useViewportObstacles.test.ts` | Viewport obstacle hook | **KEEP** - Active feature |

### 1.5 Screen Tests (`src/screens/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `HomeScreen.test.tsx` | Home screen unit test | **KEEP** - Core screen |
| `HomeScreen.integration.test.tsx` | Home screen integration test | **KEEP** - Core screen |
| `TripHistoryScreen.test.tsx` | Trip history screen test | **KEEP** - Core screen |

### 1.6 Service Tests (`src/services/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `TourService.test.ts` | Tour service unit test | **KEEP** - Core service |
| `TripService.property.test.ts` | Trip service property-based test | **KEEP** - Core service |

### 1.7 Storage Tests (`src/storage/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `LocalStorageAdapter.test.ts` | Local storage unit test | **KEEP** - Core functionality |
| `LocalStorageAdapter.property.test.ts` | Local storage property-based test | **KEEP** - Core functionality |
| `TourStorage.test.ts` | Tour storage test | **KEEP** - Core functionality |

### 1.8 Utility Tests (`src/utils/__tests__/`)
| File | Purpose | Status |
|------|---------|--------|
| `errors.test.ts` | Error handling utilities | **KEEP** - Core functionality |
| `homeScreenUtils.test.ts` | Home screen utilities | **KEEP** - Core functionality |
| `timeValidation.test.ts` | Time validation utilities | **KEEP** - Core functionality |

### Test Summary
- **Total Test Files:** 19
- **Keep:** 19 (all tests are for active features)
- **Remove:** 0

**Analysis Notes:**
- `copy-geojson-to-assets.test.js` is actively used - the script is called in the `prebuild` npm script
- All other tests correspond to active features and components in the application

---

## 2. Root-Level Documentation Files

### 2.1 Mapbox Documentation (6 files)
| File | Target Location | Action |
|------|----------------|--------|
| `MAPBOX_FIXES_APPLIED.md` | `docs/features/mapbox/fixes-applied.md` | **MOVE** |
| `MAPBOX_IMPLEMENTATION_SUMMARY.md` | `docs/features/mapbox/implementation-summary.md` | **MOVE** |
| `MAPBOX_QUICK_REFERENCE.md` | `docs/features/mapbox/quick-reference.md` | **MOVE** |
| `MAPBOX_QUICK_START.md` | `docs/features/mapbox/quick-start.md` | **MOVE** |
| `MAPBOX_TILE_DEBUG.md` | `docs/features/mapbox/tile-debug.md` | **MOVE** |

### 2.2 Lazy Loading Documentation (2 files)
| File | Target Location | Action |
|------|----------------|--------|
| `LAZY_LOADING_QUICK_START.md` | `docs/architecture/lazy-loading/quick-start.md` | **MOVE** |
| `LAZY_LOADING_SUMMARY.md` | `docs/architecture/lazy-loading/summary.md` | **MOVE** |

### 2.3 Feature Fix Documentation (4 files)
| File | Target Location | Action |
|------|----------------|--------|
| `DELETE_ACCOUNT_FIX.md` | `docs/fixes/delete-account-fix.md` | **MOVE** |
| `HOME_SCREEN_FIX_SUMMARY.md` | `docs/fixes/home-screen-fix.md` | **MOVE** |
| `RATED_FEATURES_FIX.md` | `docs/fixes/rated-features-fix.md` | **MOVE** |
| `USER_FILTERING_FIX.md` | `docs/fixes/user-filtering-fix.md` | **MOVE** |

### 2.4 Phase Documentation (1 file)
| File | Target Location | Action |
|------|----------------|--------|
| `PHASE_2_IMPLEMENTATION_GUIDE.md` | N/A - Feature already implemented | **REMOVE** ✅ |

**Analysis:** MapViewMapbox component exists in `src/components/MapViewMapbox.tsx`, indicating the Phase 2 implementation is complete. This guide is now obsolete.

### Root Documentation Summary
- **Total Files:** 11
- **Move to docs/features/mapbox/:** 5
- **Move to docs/architecture/lazy-loading/:** 2
- **Move to docs/fixes/:** 4
- **Remove (obsolete):** 1 (PHASE_2_IMPLEMENTATION_GUIDE.md)

---

## 3. Existing docs/ Folder Documentation

### 3.1 Mapbox Documentation (3 files)
| File | Target Location | Action |
|------|----------------|--------|
| `docs/MapboxIntegration.md` | `docs/features/mapbox/integration.md` | **MOVE** |
| `docs/MapboxTesting.md` | `docs/features/mapbox/testing.md` | **MOVE** |
| `docs/TileSetup.md` | `docs/features/mapbox/tile-setup.md` | **MOVE** |
| `docs/MapView.md` | `docs/features/mapbox/map-view.md` | **MOVE** |

### 3.2 Lazy Loading Documentation (3 files)
| File | Target Location | Action |
|------|----------------|--------|
| `docs/LazyLoadingArchitecture.md` | `docs/architecture/lazy-loading/architecture.md` | **MOVE** |
| `docs/LazyLoadingMigrationGuide.md` | `docs/architecture/lazy-loading/migration-guide.md` | **MOVE** |
| `docs/LazyLoadingOptimization.md` | `docs/architecture/lazy-loading/optimization.md` | **MOVE** |

### 3.3 Feature Documentation (3 files)
| File | Target Location | Action |
|------|----------------|--------|
| `docs/24HourGradingLimit.md` | `docs/features/24-hour-grading-limit.md` | **MOVE** |
| `docs/FeaturePopupEnhancements.md` | `docs/features/feature-popup-enhancements.md` | **MOVE** |
| `docs/ObstacleVisualization.md` | `docs/features/obstacle-visualization.md` | **MOVE** |

### 3.4 Backend/Supabase Documentation (4 files) - TO REMOVE
| File | Reason | Action |
|------|--------|--------|
| `docs/SupabaseImplementationSummary.md` | Backend implementation details | **REMOVE** |
| `docs/SupabaseSetup.md` | Backend setup instructions | **REMOVE** |
| `docs/SupabaseTroubleshooting.md` | Backend troubleshooting | **REMOVE** |
| `docs/SyncErrorFixes.md` | Backend sync debugging | **REMOVE** |

### docs/ Folder Summary
- **Total Files:** 14
- **Move to docs/features/:** 7
- **Move to docs/architecture/:** 3
- **Remove (backend-specific):** 4

---

## 4. Supabase Folder Documentation

### 4.1 Backend Documentation Files (4 files) - TO REMOVE
| File | Reason | Action |
|------|--------|--------|
| `supabase/IMPLEMENTATION_SUMMARY.md` | Backend implementation | **REMOVE** |
| `supabase/MAPBOX_DEPLOYMENT.md` | Backend deployment | **REMOVE** |
| `supabase/README.md` | Backend setup guide | **REMOVE** |
| `supabase/SETUP_CHECKLIST.md` | Backend setup checklist | **REMOVE** |

### 4.2 Backend Configuration/Code (KEEP)
- `supabase/config.toml` - **KEEP** (configuration file)
- `supabase/setup.sh` - **KEEP** (setup script)
- `supabase/verify_schema.sql` - **KEEP** (schema verification)
- `supabase/migrations/` - **KEEP** (database migrations)
- `supabase/functions/` - **KEEP** (edge functions)

### Supabase Folder Summary
- **Remove Documentation:** 4 files
- **Keep Configuration/Code:** All other files

---

## 5. Target Documentation Structure

```
docs/
├── README.md                                    # Documentation index (CREATE)
├── PrivacyPolicy.md                            # Privacy policy (CREATE)
│
├── features/                                    # Feature documentation (CREATE)
│   ├── 24-hour-grading-limit.md               # MOVE from docs/
│   ├── feature-popup-enhancements.md          # MOVE from docs/
│   ├── obstacle-visualization.md              # MOVE from docs/
│   │
│   └── mapbox/                                 # Mapbox feature docs (CREATE)
│       ├── README.md                           # Mapbox index (CREATE)
│       ├── integration.md                      # MOVE from docs/MapboxIntegration.md
│       ├── testing.md                          # MOVE from docs/MapboxTesting.md
│       ├── tile-setup.md                       # MOVE from docs/TileSetup.md
│       ├── map-view.md                         # MOVE from docs/MapView.md
│       ├── fixes-applied.md                    # MOVE from root/MAPBOX_FIXES_APPLIED.md
│       ├── implementation-summary.md           # MOVE from root/MAPBOX_IMPLEMENTATION_SUMMARY.md
│       ├── quick-reference.md                  # MOVE from root/MAPBOX_QUICK_REFERENCE.md
│       ├── quick-start.md                      # MOVE from root/MAPBOX_QUICK_START.md
│       └── tile-debug.md                       # MOVE from root/MAPBOX_TILE_DEBUG.md
│
├── architecture/                               # Architecture documentation (CREATE)
│   └── lazy-loading/                           # Lazy loading architecture (CREATE)
│       ├── README.md                           # Lazy loading index (CREATE)
│       ├── architecture.md                     # MOVE from docs/LazyLoadingArchitecture.md
│       ├── migration-guide.md                  # MOVE from docs/LazyLoadingMigrationGuide.md
│       ├── optimization.md                     # MOVE from docs/LazyLoadingOptimization.md
│       ├── quick-start.md                      # MOVE from root/LAZY_LOADING_QUICK_START.md
│       └── summary.md                          # MOVE from root/LAZY_LOADING_SUMMARY.md
│
└── fixes/                                      # Bug fix documentation (CREATE)
    ├── delete-account-fix.md                   # MOVE from root/DELETE_ACCOUNT_FIX.md
    ├── home-screen-fix.md                      # MOVE from root/HOME_SCREEN_FIX_SUMMARY.md
    ├── rated-features-fix.md                   # MOVE from root/RATED_FEATURES_FIX.md
    └── user-filtering-fix.md                   # MOVE from root/USER_FILTERING_FIX.md
```

---

## 6. File Classification Summary

### 6.1 Files to KEEP (No Action)
- **Test Files:** 18 confirmed active test files
- **Root README.md:** Keep as main repository documentation
- **Supabase code/config:** Keep all non-documentation files

### 6.2 Files to MOVE
- **From Root → docs/features/mapbox/:** 5 files
- **From Root → docs/architecture/lazy-loading/:** 2 files
- **From Root → docs/fixes/:** 4 files
- **From docs/ → docs/features/:** 3 files
- **From docs/ → docs/features/mapbox/:** 4 files
- **From docs/ → docs/architecture/lazy-loading/:** 3 files
- **Total to Move:** 21 files

### 6.3 Files to REMOVE
- **Backend Documentation in docs/:** 4 files
- **Backend Documentation in supabase/:** 4 files
- **Obsolete Implementation Guide:** 1 file (PHASE_2_IMPLEMENTATION_GUIDE.md)
- **Total to Remove:** 9 files

### 6.4 Files to REVIEW
- ~~`PHASE_2_IMPLEMENTATION_GUIDE.md`~~ ✅ **RESOLVED** - Obsolete, will be removed
- ~~`__tests__/scripts/copy-geojson-to-assets.test.js`~~ ✅ **RESOLVED** - Active script, will be kept

### 6.5 Files to CREATE
- `docs/README.md` - Documentation index with navigation
- `docs/PrivacyPolicy.md` - Privacy policy for public release
- `docs/features/mapbox/README.md` - Mapbox documentation index
- `docs/architecture/lazy-loading/README.md` - Lazy loading documentation index

---

## 7. Implementation Phases

### Phase 1: Analysis (CURRENT)
✅ Scan all __tests__ directories  
✅ Catalog test files  
✅ Identify root-level documentation  
✅ Catalog docs/ and supabase/ folders  
✅ Create file classification list  
✅ Document target structure  

### Phase 2: Test Cleanup
- Review `copy-geojson-to-assets.test.js` for relevance
- Remove any obsolete tests identified
- Verify no broken imports after removal

### Phase 3: Documentation Consolidation
- Create target folder structure
- Move Mapbox documentation
- Move lazy loading documentation
- Move fix documentation
- Update all internal links

### Phase 4: Backend Documentation Removal
- Remove backend docs from docs/ folder
- Remove backend docs from supabase/ folder
- Verify no broken references

### Phase 5: Privacy Policy Creation
- Create PrivacyPolicy.md with all required sections
- Review for completeness and accuracy

### Phase 6: Final Verification
- Run import validation
- Run link validation
- Verify application builds
- Create validation scripts

---

## 8. Risk Assessment

### Low Risk
- Moving documentation files (easily reversible)
- Creating new documentation structure
- Adding privacy policy

### Medium Risk
- Removing backend documentation (verify no frontend dependencies)
- Updating documentation links (must be thorough)

### High Risk
- Removing test files (must verify obsolescence first)
- Any changes that could break imports

### Mitigation Strategies
- Use version control for all changes
- Test application build after each phase
- Validate imports and links after each phase
- Keep backup of removed files until verification complete

---

## 9. Success Criteria

✅ All root-level documentation moved to docs/ folder  
✅ Documentation organized in logical structure  
✅ Backend-specific documentation removed  
✅ Privacy policy created and complete  
✅ No broken imports in codebase  
✅ No broken links in documentation  
✅ Application builds successfully  
✅ All active tests pass  

---

## 10. Next Steps

1. ~~**Review this plan** with stakeholders~~ ✅ **COMPLETE**
2. ~~**Verify** `PHASE_2_IMPLEMENTATION_GUIDE.md` relevance~~ ✅ **COMPLETE** - Obsolete, will be removed
3. ~~**Verify** `copy-geojson-to-assets.test.js` script usage~~ ✅ **COMPLETE** - Active, will be kept
4. **Proceed** with Task 2: Test Cleanup (remove obsolete tests if any found)
5. **Execute** Task 4: Documentation Consolidation
6. **Execute** Task 5: Backend Documentation Removal
7. **Execute** Task 6: Privacy Policy Creation
8. **Execute** Task 7: Final Verification

---

**End of Cleanup Plan**
