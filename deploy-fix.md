# Deploy Voice Validation Fix

## Issue Fixed
- TTS voice validation now accepts any string voice from any provider
- Removed restrictive enum validation that was rejecting valid voices like "en-PH-JamesNeural"

## Changes Made
✅ Updated `src/types/shorts.ts` - voice field now uses `z.string().optional()` instead of enum
✅ Updated TTS library methods to return `string[]` instead of `TTSVoice[]`
✅ Updated frontend to work with string voices instead of enum values

## To Deploy on Coolify

### Option 1: Auto-Deploy (if enabled)
```bash
git add .
git commit -m "fix: accept any voice string from TTS providers"
git push origin main
```

### Option 2: Manual Deploy
1. Go to Coolify dashboard
2. Find your short-video-maker application
3. Click "Deploy" or "Redeploy"
4. Wait for the container to rebuild

### Option 3: Force Rebuild
If the above doesn't work, in Coolify:
1. Go to your application
2. Click "Build & Deploy" 
3. Select "Force rebuild"

## Verification
After deployment, test with a voice that was previously failing:
```bash
curl -X POST https://your-app-url/api/short-video \
  -H "Content-Type: application/json" \
  -d '{
    "scenes": [{"text": "test", "searchTerms": ["test"]}],
    "config": {"voice": "en-PH-JamesNeural", "provider": "openai-edge-tts"}
  }'
```

This should now work without validation errors.
