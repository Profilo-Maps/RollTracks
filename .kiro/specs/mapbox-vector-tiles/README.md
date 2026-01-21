# Mapbox Vector Tiles Integration - Specification Overview

## ✅ Phase 1 Complete: Serverless Proxy Infrastructure

**Status**: Backend infrastructure deployed and ready for mobile app integration

The Mapbox integration uses a secure serverless proxy architecture where your Mapbox API token is stored server-side in Supabase Edge Functions, never exposed in the mobile app APK.

**What's Implemented**:
- ✅ Supabase Edge Function for secure Mapbox API proxy
- ✅ Database schema for tile caching and usage tracking  
- ✅ Mobile app service (`MapboxProxyService`) for proxy communication
- ✅ Rate limiting (500 tiles per user per day - free tier optimized)
- ✅ Automatic caching (24-hour expiration)
- ✅ Usage analytics and monitoring
- ✅ Deployment automation scripts

**Quick Deploy**:
```bash
# Windows: scripts\deploy-mapbox-proxy.bat
# Linux/Mac: ./scripts/deploy-mapbox-proxy.sh
```

**See**: `MAPBOX_QUICK_START.md` for deployment instructions and `IMPLEMENTATION_STATUS.md` for details.

---

## Quick Summary

This specification defines the integration of Mapbox vector tiles to replace the current Leaflet + raster tile system in RollTracks. The migration will reduce storage by 70-80%, improve visual quality, enable dynamic styling, and add accessibility features while maintaining full offline functionality.

## Key Benefits

- **70-80% storage reduction**: 750 MB → 160-260 MB for San Francisco area
- **Crisp graphics**: Vector rendering looks sharp at all zoom levels
- **Dynamic styling**: Switch themes (light/dark/accessibility) without reloading
- **Better performance**: Hardware-accelerated WebGL rendering
- **Accessibility**: High-contrast modes, larger text, customizable colors
- **Smaller downloads**: Users download less data for offline regions

## Documentation Structure

### 1. [requirements.md](./requirements.md)
Defines 8 user stories with 40 acceptance criteria covering:
- Visual quality and performance requirements
- Dynamic styling and accessibility features
- Offline functionality and caching
- Integration with existing React Native architecture
- Flexible tile source configuration
- Data compatibility and migration
- Error handling and fallback mechanisms
- Performance and battery optimizations

### 2. [design.md](./design.md)
Technical design including:
- High-level architecture diagrams
- Component interfaces and message protocols
- Data models for offline regions and styling
- 37 correctness properties for property-based testing
- Comprehensive error handling strategies
- Testing approach (unit + property-based tests)

### 3. [tasks.md](./tasks.md)
Implementation plan with 11 major tasks and 43 subtasks:
- Infrastructure setup and configuration
- Enhanced MapView component with Mapbox GL JS
- Vector tile rendering and styling system
- Offline caching and region management
- Migration of existing functionality
- Error handling and fallback mechanisms
- Performance optimizations
- Data compatibility verification
- Comprehensive testing
- Production deployment

### 4. [offline-implementation-guide.md](./offline-implementation-guide.md)
Detailed technical guide for offline functionality:
- Comparison of current vs. vector tile offline architecture
- Two implementation approaches (IndexedDB vs. File System)
- Recommended hybrid approach combining both methods
- Complete code examples for caching, downloading, and managing tiles
- Storage size estimates and optimization strategies
- Implementation checklist with 5 phases

### 5. [migration-strategy.md](./migration-strategy.md)
Practical migration roadmap:
- Current system analysis (strengths and weaknesses)
- 5-phase migration plan over 10 weeks
- Storage migration strategies
- Risk mitigation for technical and UX concerns
- Success metrics and monitoring
- Gradual rollout plan (5% → 100% of users)
- Rollback procedures

## Quick Start

### For Developers

1. **Review the requirements**: Start with [requirements.md](./requirements.md) to understand what we're building
2. **Study the design**: Read [design.md](./design.md) for technical architecture
3. **Understand offline**: Review [offline-implementation-guide.md](./offline-implementation-guide.md) for the most complex part
4. **Follow the plan**: Use [tasks.md](./tasks.md) to implement incrementally
5. **Execute migration**: Follow [migration-strategy.md](./migration-strategy.md) for safe rollout

### For Project Managers

1. **Timeline**: 10-12 weeks for full migration (see migration-strategy.md)
2. **Resources**: 1-2 developers, testing support
3. **Risks**: Low-medium, with comprehensive mitigation strategies
4. **ROI**: 70-80% storage savings, improved UX, accessibility features

### For Stakeholders

1. **User Impact**: Better maps, faster loading, accessibility features
2. **Storage Savings**: Significant reduction in app size and data usage
3. **Offline Support**: Maintained and improved with intelligent caching
4. **Accessibility**: High-contrast modes, larger text, customizable styling

## Implementation Approach

### Recommended Strategy: Hybrid Offline Storage

```
Storage Architecture:
├── Bundled Tiles (File System)
│   └── Essential San Francisco area included with app
├── User Downloads (File System)
│   └── Additional regions downloaded by user
└── Dynamic Cache (IndexedDB)
    └── Recently viewed areas cached automatically

Fallback Chain:
1. Try bundled tiles (file://)
2. Try cached tiles (IndexedDB)
3. Fetch from network (https://)
```

### Migration Phases

```
Phase 1 (Weeks 1-2): Parallel Implementation
- Add Mapbox GL JS alongside Leaflet
- Feature flag to toggle between implementations
- Test with online tiles only

Phase 2 (Weeks 3-4): Offline Foundation
- Implement IndexedDB caching
- Automatic caching during online use
- Basic cache management

Phase 3 (Weeks 5-6): Bundled Tiles
- Generate vector tiles for San Francisco
- Bundle with Android app
- Hybrid fallback system

Phase 4 (Weeks 7-8): Advanced Features
- Region download UI
- Dynamic styling and themes
- Accessibility enhancements

Phase 5 (Weeks 9-10): Production Rollout
- Gradual rollout (5% → 100%)
- Monitoring and analytics
- Automatic fallback to raster tiles
```

## Technical Highlights

### Vector Tile Format

```
Vector Tile (.pbf):
- Protocol Buffer format
- Contains geometric data (points, lines, polygons)
- Includes attributes for styling
- 3-5 KB per tile (vs 15-20 KB for raster)

Additional Assets:
- Fonts: Glyph data for text rendering (~5 MB)
- Sprites: Icon atlas for markers (~2 MB)
- Styles: JSON specification (~100 KB)
```

### Storage Comparison

```
Current Raster Tiles:
- Format: PNG images
- Size: 750 MB - 1 GB (San Francisco, zoom 10-18)
- Access: Simple file:// protocol
- Styling: Fixed, pre-rendered

Proposed Vector Tiles:
- Format: Protocol Buffer (.pbf)
- Size: 160-260 MB (same coverage)
- Access: Custom protocol + IndexedDB
- Styling: Dynamic, customizable
- Reduction: 70-80% smaller
```

### Performance Characteristics

```
Initialization:
- Raster: ~1-2 seconds
- Vector: ~1.5-2.5 seconds (slightly slower, but acceptable)

Rendering:
- Raster: 30-45 fps (image blitting)
- Vector: 60 fps (WebGL acceleration)

Zoom Transitions:
- Raster: Pixelation during zoom
- Vector: Smooth, crisp at all levels

Memory Usage:
- Raster: Higher (full images in memory)
- Vector: Lower (only visible geometry)
```

## Key Design Decisions

### 1. WebView Architecture (Maintained)

**Decision**: Keep existing WebView architecture, replace Leaflet with Mapbox GL JS

**Rationale**:
- Minimal changes to React Native code
- Proven message protocol
- Easier migration path
- Maintains existing functionality

### 2. Hybrid Offline Storage

**Decision**: Use both IndexedDB (WebView) and File System (React Native)

**Rationale**:
- IndexedDB: Native to Mapbox GL JS, automatic caching
- File System: Larger capacity, bundled tiles, user control
- Best of both worlds

### 3. Gradual Rollout

**Decision**: Start with 5% of users, gradually increase to 100%

**Rationale**:
- Minimize risk of widespread issues
- Monitor performance and errors
- Easy rollback if problems occur
- Build confidence incrementally

### 4. Fallback to Raster Tiles

**Decision**: Keep raster tiles during transition, automatic fallback

**Rationale**:
- Safety net for unsupported devices
- Handles WebGL unavailability
- Reduces migration risk
- Can remove after stable period

## Success Criteria

### Must Have (MVP)
- [ ] Vector tiles display correctly online and offline
- [ ] All existing features work (location, routes, obstacles)
- [ ] Offline functionality matches current capability
- [ ] Performance is comparable or better
- [ ] Automatic fallback to raster tiles works

### Should Have (Full Release)
- [ ] 70-80% storage reduction achieved
- [ ] Dynamic theme switching implemented
- [ ] Region download functionality
- [ ] Accessibility enhancements
- [ ] Cache management UI

### Nice to Have (Future)
- [ ] Multiple map styles (satellite, terrain)
- [ ] Custom style editor
- [ ] Advanced offline region management
- [ ] Heatmap visualizations
- [ ] 3D building rendering

## Risk Assessment

### Low Risk
- ✓ Storage savings (proven technology)
- ✓ Visual quality improvement (inherent to vectors)
- ✓ Dynamic styling (core Mapbox feature)

### Medium Risk
- ⚠ Implementation complexity (mitigated by incremental approach)
- ⚠ Offline caching (mitigated by hybrid storage)
- ⚠ Performance on older devices (mitigated by fallback)

### Mitigated Risk
- ✓ WebGL unavailability (automatic fallback to raster)
- ✓ Data migration (backward compatible)
- ✓ User experience disruption (gradual rollout)

## Next Steps

1. **Review and approve** this specification
2. **Set up development environment** with Mapbox GL JS
3. **Start Phase 1** (Parallel Implementation)
4. **Create test plan** based on correctness properties
5. **Begin implementation** following tasks.md

## Questions and Answers

### Q: Will this break existing functionality?
**A**: No. We maintain parallel implementations during transition with automatic fallback.

### Q: How long will migration take?
**A**: 10-12 weeks for full migration with gradual rollout.

### Q: What if vector tiles don't work on a device?
**A**: Automatic fallback to existing raster tile system.

### Q: Will offline functionality still work?
**A**: Yes, improved with hybrid storage approach (bundled + cached + downloaded).

### Q: How much storage will be saved?
**A**: 70-80% reduction (750 MB → 160-260 MB for San Francisco).

### Q: Do we need to change the React Native code much?
**A**: Minimal changes. Most work is in WebView HTML/JavaScript.

### Q: Can users still use the app during migration?
**A**: Yes. Gradual rollout means most users keep existing system until proven stable.

### Q: What about accessibility features?
**A**: Significantly improved with dynamic styling, high-contrast modes, and larger text.

## Resources

### External Documentation
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Vector Tile Specification](https://github.com/mapbox/vector-tile-spec)
- [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

### Internal Documentation
- Current MapView implementation: `src/components/MapView.tsx`
- Tile setup guide: `docs/TileSetup.md`
- MapView documentation: `docs/MapView.md`

## Contact

For questions about this specification:
- Technical questions: Review design.md and offline-implementation-guide.md
- Implementation questions: Follow tasks.md step-by-step
- Migration questions: Consult migration-strategy.md

---

**Specification Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Ready for Implementation