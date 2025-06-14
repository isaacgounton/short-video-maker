# Short Video Maker - Debugging Guide

## Error Analysis

### 1. JavaScript Error: "b.map is not a function"
**Cause**: Frontend expecting arrays but receiving objects from API endpoints.
**Status**: ✅ FIXED

### 2. TTS API Error: "Not Found"
**Cause**: External TTS service at `https://tts.dahopevi.com` is unavailable.
**Status**: ⚠️ REQUIRES ACTION

## Fixes Applied

### 1. API Endpoint Compatibility
- Added missing endpoints that frontend expects:
  - `GET /api/tts/providers` (returns array directly)
  - `GET /api/tts/{provider}/voices` (returns array directly)
- Maintained backward compatibility with existing endpoints

### 2. Frontend Error Handling
- Added defensive programming to handle both array and object responses
- Improved error messages for failed API calls

### 3. TTS Service Error Handling
- Enhanced error messages to identify service unavailability
- Better logging for debugging TTS issues

## TTS Service Configuration

The app is configured to use TTS service at: `https://tts.dahopevi.com/api`

### Environment Variables for TTS Configuration:
```bash
TTS_API_URL=https://your-tts-service.com/api
```

### Coolify Deployment Considerations:

1. **Internal Service Communication**: If you have a TTS service running in the same Coolify instance, use internal networking:
   ```bash
   TTS_API_URL=http://tts-service-name:port/api
   ```

2. **External TTS Service**: Ensure the service is accessible from your Coolify instance:
   ```bash
   TTS_API_URL=https://external-tts-service.com/api
   ```

3. **Local Development**: For testing, you can use a mock TTS service or implement a fallback.

## Diagnostic Steps

### 1. Check TTS Service Availability
```bash
curl https://tts.dahopevi.com/api/health
```

### 2. Test API Endpoints
```bash
# Test providers endpoint
curl http://your-app-url/api/tts/providers

# Test voices endpoint
curl http://your-app-url/api/tts/kokoro/voices
```

### 3. Check Application Logs
Look for these log patterns:
- `"Failed to generate audio with TTS API"`
- `"TTS service is unavailable"`
- `"Failed to fetch voices for provider"`

## Recommended Actions

### Immediate (to fix current errors):
1. ✅ API endpoints fixed
2. ✅ Frontend error handling improved
3. ⚠️ **Need to fix TTS service connectivity**

### TTS Service Options:

#### Option 1: Deploy TTS Service on Coolify
1. Deploy the TTS service as a separate application
2. Set `TTS_API_URL` to internal service URL
3. Configure internal networking between services

#### Option 2: Use Alternative TTS Service
1. Set up OpenAI TTS, ElevenLabs, or another provider
2. Modify TTS.ts to support multiple providers
3. Update configuration accordingly

#### Option 3: Mock TTS for Testing
1. Create a mock TTS endpoint that returns dummy audio
2. Use for development/testing until real service is available

## Files Modified
- `src/server/routers/rest.ts` - Added missing API endpoints
- `src/ui/pages/VideoCreator.tsx` - Improved error handling
- `src/short-creator/libraries/TTS.ts` - Better error messages

## Next Steps
1. Verify the TTS service configuration in your Coolify environment
2. Test the fixed API endpoints
3. Configure proper TTS service URL for your deployment