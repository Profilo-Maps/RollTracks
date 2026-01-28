# Mapbox Integration - Quick Start Guide

## 🎯 What's Been Implemented

✅ **Serverless Proxy Architecture** - Your Mapbox token is stored server-side in Supabase, never in the mobile app
✅ **Database Schema** - Tile caching and usage tracking tables
✅ **Edge Function** - Secure proxy with authentication and rate limiting
✅ **Mobile Service** - TypeScript service to communicate with proxy
✅ **Deployment Scripts** - Automated deployment for Windows and Linux/Mac

## 🚀 Deploy in 3 Steps

### Step 1: Apply Database Migration

```bash
supabase db push
```

This creates the `tile_cache` and `tile_usage` tables.

### Step 2: Set Mapbox Token (Server-Side)

```bash
supabase secrets set MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA
```

Your token is now stored securely in Supabase and will NEVER be in your APK.

### Step 3: Deploy Edge Function

```bash
supabase functions deploy mapbox-tiles
```

Done! Your proxy is live.

## 🧪 Test It

```bash
# Get your JWT from Supabase dashboard, then:
curl -X POST \
  'https://your-project.supabase.co/functions/v1/mapbox-tiles' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"z":10,"x":163,"y":395}'
```

## 📱 Use in Mobile App

```typescript
import { MapboxProxyService } from './services/MapboxProxyService';

// Fetch a tile (automatically authenticated)
const tile = await MapboxProxyService.fetchTile(10, 163, 395);

// Check your usage
const usage = await MapboxProxyService.getUserUsage();
console.log(`Used ${usage.count}/500 tiles today`);
```

## 🔒 Security Features

- ✅ Mapbox token stored server-side (never in APK)
- ✅ User authentication required
- ✅ Rate limiting: 500 tiles per user per day
- ✅ Automatic caching (24 hours)
- ✅ Usage tracking and analytics

## 💰 Free Tier Optimized

**Supabase**: 500k function calls/month (plenty of headroom)
**Mapbox**: 50k tile requests/month
**With caching**: Supports 100+ active users

## 📊 Monitor Usage

```sql
-- View cache statistics
SELECT * FROM get_cache_stats();

-- View your tile requests
SELECT * FROM tile_usage 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

## 🔧 Configuration

Edit `supabase/functions/mapbox-tiles/index.ts` to adjust:

```typescript
const CONFIG = {
  RATE_LIMIT_PER_DAY: 500,        // Tiles per user per day
  CACHE_EXPIRATION_HOURS: 24,     // How long to cache tiles
  MAX_CACHE_SIZE_MB: 50,          // Max cache size
  ENABLE_CACHING: true,           // Enable/disable caching
};
```

## 📚 Full Documentation

- **Deployment Guide**: `supabase/MAPBOX_DEPLOYMENT.md`
- **Implementation Status**: `.kiro/specs/mapbox-vector-tiles/IMPLEMENTATION_STATUS.md`
- **Architecture Details**: `.kiro/specs/mapbox-vector-tiles/serverless-proxy-architecture.md`

## ⏭️ Next Steps

1. ✅ Deploy the proxy (you're here!)
2. ⏭️ Integrate MapView component with Mapbox GL JS
3. ⏭️ Add offline region management
4. ⏭️ Test end-to-end with real devices

## 🆘 Troubleshooting

**"Missing authorization header"**
→ User not logged in. Ensure `supabase.auth.getSession()` returns a valid session.

**"Rate limit exceeded"**
→ User exceeded 500 tiles/day. Wait 24 hours or increase limit in Edge Function.

**"Mapbox API error"**
→ Check that token is set correctly: `supabase secrets list`

## 📞 Your Credentials

**Mapbox Token**: `pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA`
**Mapbox Username**: `profilo-maps`
**Storage**: Server-side in Supabase secrets (secure ✓)

---

**Ready to deploy?** Run: `scripts/deploy-mapbox-proxy.bat` (Windows) or `./scripts/deploy-mapbox-proxy.sh` (Linux/Mac)
