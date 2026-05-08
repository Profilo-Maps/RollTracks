# RollCoin Implementation Summary

## What You Have Now

Two comprehensive documents for implementing a token system for OSM data corrections:

### 1. `RollCoin Outline.md`
- Complete feasibility analysis
- General architecture for any blockchain token system
- 5-phase implementation plan
- Cost analysis ($180k total, $50-100/month operational)
- Token economics and validation workflows

### 2. `RollCoin_ParkXimity_Integration.md` ⭐ **USE THIS ONE**
- Specifically aligned with your OSM network schema
- 8 contribution types mapped to your database fields
- Detailed token rewards for each OSM correction type
- Integration with `osm_network_segments` table structure

### 3. `rollcoin_mvp_setup.sql`
- Ready-to-deploy Supabase migration
- Creates 3 core tables (contributions, token_ledger, token_rewards_config)
- Automated validation trigger
- Peer consensus function (for Phase 2)

---

## Minimal Setup (What You Asked For)

Yes, you're right! For a basic token system without monetization, you just need:

### Step 1: Run the Migration
```bash
supabase db push
```

This creates:
- `contributions` table - tracks OSM corrections
- `token_ledger` table - immutable transaction log
- `token_rewards_config` table - adjustable reward values
- `user_profiles.token_balance` column - user's current balance

### Step 2: Update Your App (Minimal Changes)

**When user validates a curb ramp:**
```typescript
await supabase.from('contributions').insert({
  user_id: userId,
  contribution_type: 'curb_ramp_validation',
  street_osmid: 123456789,
  field_name: 'sidewalk_left_curbramp_start_1_condition_score',
  old_value: '7',
  new_value: '5',
  contribution_geometry: `POINT(${lon} ${lat})`,
  gps_accuracy_meters: 3.2,
  photo_url: photoUrl,
  photo_size_bytes: photoSize
});
// Tokens auto-awarded by database trigger!
```

**Show token balance:**
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('token_balance')
  .eq('id', userId)
  .single();

// Display: "🪙 {data.token_balance} RollCoins"
```

That's it! No blockchain, no marketplace, no complex validation yet.

---

## Token Rewards (Configured in Database)

| Contribution Type | Base Tokens | GPS <5m Bonus | Photo Bonus | Total Possible |
|-------------------|-------------|---------------|-------------|----------------|
| Curb ramp validation | 1.0 | +0.3 | +0.5 | ~2.5 |
| Sidewalk surface | 1.5 | +0.45 | +0.5 | ~3.5 |
| Sidewalk width | 2.0 | +0.6 | +1.0 | ~5.0 |
| Crosswalk features | 1.0 each | +0.3 | +0.5 | ~2.5 each |
| Bikeway correction | 1.5 | +0.45 | +0.5 | ~3.5 |
| Street feature report | 0.5 | +0.1 | +0.5 | ~1.5 |
| Geometry correction | 3.0 | +0.9 | - | ~5.0 |
| OSM note submission | 3.0 | - | - | 3.0 (+6.0 if accepted) |

**Quality Multipliers:**
- GPS accuracy <5m: 1.3x
- GPS accuracy 5-10m: 1.0x
- GPS accuracy >10m: 0.8x
- Photo >2MB: 1.2x
- Validates existing data: 1.2x
- Corrects wrong data: 1.3x
- Adds missing data: 1.5x

---

## How Validation Works

### Tier 1: Automated (Immediate)
- GPS accuracy check
- Photo quality check
- Duplicate detection
- **Result**: 50% tokens awarded immediately if quality is good

### Tier 2: Peer Consensus (24-72 hours) - Phase 2
- 3+ users validate same field on same segment
- 60% agreement required
- **Result**: Remaining 50% tokens awarded when consensus reached
- OSM data automatically updated

### Tier 3: OSM Acceptance (Weeks-Months) - Phase 3
- User submits correction as OSM note
- OSM moderator reviews and accepts
- **Result**: 2x bonus tokens (6.0 additional for note submission)

---

## What Gets Updated in Your Database

When peer consensus is reached (3+ users agree):

```sql
-- Example: 3 users report sidewalk surface as "asphalt" instead of "concrete"
UPDATE osm_network_segments
SET 
  sidewalk_left_surface = 'asphalt',
  validation_count = validation_count + 1,
  data_quality_score = data_quality_score + 0.1
WHERE street_osmid = 123456789;
```

All 3 users get their remaining 50% tokens.

---

## Integration with Your OSM Schema

Your `osm_network_segments` table has ~200 fields. RollCoin tracks corrections to:

**Sidewalk Fields** (left/right):
- `sidewalk_*_surface` (concrete, asphalt, brick, etc.)
- `sidewalk_*_width` (meters)
- `sidewalk_*_incline` (percentage)
- `sidewalk_*_curbramp_*_condition_score` (1-10)
- `sidewalk_*_feature_types` (array of obstacles)
- `sidewalk_*_feature_geometry` (multipoint)

**Crosswalk Fields** (start/end):
- `crosswalk_*_marked` (yes/no)
- `crosswalk_*_signals` (array of signal types)
- `crosswalk_*_tactile_paving` (yes/no)
- `crosswalk_*_island` (yes/no)

**Bikeway Fields** (left/right, 1/2):
- `bikeway_*_type` (lane, track, shared, etc.)
- `bikeway_*_surface` (asphalt, concrete, etc.)
- `bikeway_*_width` (meters)

**Street Features**:
- `street_feature_types` (potholes, construction, etc.)
- `street_feature_geometry` (multipoint)

---

## Next Steps

### Immediate (This Week)
1. ✅ Run migration: `supabase db push`
2. ✅ Add token balance to Profile Screen UI
3. ✅ Update DataRanger Service to insert contributions

### Phase 1 MVP (2-3 weeks)
4. Build OSM Correction UI (show nearby segments, allow corrections)
5. Add contribution history screen
6. Add token notification toasts
7. Test with 10-20 beta users

### Phase 2 (1-2 months later)
8. Implement peer validation workflow
9. Add validator leaderboard
10. Add reputation system

### Phase 3 (2-3 months later)
11. Integrate OSM Notes API
12. Track OSM acceptance status
13. Award bonus tokens on OSM acceptance

### Phase 5 (6+ months later)
14. Build internal marketplace (premium features)
15. Partner with transit agencies for token redemption
16. Consider external token exchange (if demand exists)

---

## Cost Estimate

**Development** (if outsourced):
- Phase 1 MVP: $40,000 (8 weeks)
- Phase 2 Peer Validation: $40,000 (8 weeks)
- Phase 3 OSM Integration: $40,000 (8 weeks)

**Operational** (monthly):
- Supabase Pro: $25/month
- Additional storage/bandwidth: $10-50/month
- Total: $35-75/month

**DIY** (if you build it yourself):
- Just your time + $35-75/month Supabase costs

---

## Questions?

**Q: Do I need blockchain?**
A: No! Start with centralized ledger in Supabase. Add blockchain anchoring later if users demand transparency.

**Q: How do I prevent spam?**
A: Daily caps (50 tokens/user/day), cooldowns (5 min between same-location contributions), GPS accuracy requirements, peer validation.

**Q: What if users game the system?**
A: Reputation decay for rejected contributions, require 10+ approved contributions before validation privileges, flag suspicious patterns.

**Q: How do I set token values?**
A: Start conservative, monitor data quality vs. token issuance, adjust via `token_rewards_config` table (no code changes needed).

**Q: When should I add monetization?**
A: After Phase 1 MVP proves users value tokens. Start with internal marketplace (premium features), then service partnerships, then external exchange.

---

**Ready to deploy?** Just run `supabase db push` and start tracking contributions!
