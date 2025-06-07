# OpenAI Edge TTS Integration Setup

## Summary

OpenAI Edge TTS has been successfully integrated into your short video maker application. This integration allows you to use OpenAI's high-quality text-to-speech capabilities for generating audio in your videos.

## What Was Added

### 1. New TTS Library
- **File**: `src/short-creator/libraries/OpenAIEdgeTTS.ts`
- **Purpose**: Handles communication with your OpenAI Edge TTS service
- **Features**: Robust error handling, voice caching, timeout protection

### 2. Updated Types
- **File**: `src/types/shorts.ts`
- **Changes**: 
  - Added OpenAI TTS voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`)
  - Added new TTS engine: `openai-edge-tts`

### 3. Updated TTS Factory
- **File**: `src/short-creator/libraries/TTSFactory.ts`
- **Changes**: Added support for the new OpenAI Edge TTS engine

### 4. Environment Configuration
- **File**: `.env.example`
- **Added Variables**:
  ```env
  OPENAI_EDGE_TTS_URL=https://tts.dahopevi.com:5050
  OPENAI_EDGE_TTS_API_KEY=your_api_key_here
  OPENAI_API_KEY=your_api_key_here
  ```

### 5. Docker Configuration
- **File**: `docker-compose.yml`
- **Changes**: Added `OPENAI_EDGE_TTS_URL` environment variable

### 6. Documentation
- **File**: `docs/OPENAI_EDGE_TTS_INTEGRATION.md`
- **Purpose**: Comprehensive guide for using the OpenAI Edge TTS integration

## Quick Setup

### 1. Environment Variables
Add to your `.env` file:
```env
OPENAI_EDGE_TTS_URL=http://tts.dahopevi.com:5050
OPENAI_EDGE_TTS_API_KEY=your_openai_api_key
```

### 2. Using in Video Generation
```javascript
const config = {
  ttsEngine: "openai-edge-tts",
  voice: "alloy", // or nova, echo, fable, onyx, shimmer
  // ... other config
};
```

## Service Information

- **URL**: `http://tts.dahopevi.com:5050` (HTTP, not HTTPS)
- **Container**: `openai-edge-tts`
- **Coolify Project**: `apis`
- **Available Voices**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

## Testing the Integration

### 1. Check Service Availability
```bash
curl -X GET http://tts.dahopevi.com:5050/v1/audio/speech/voices
```

### 2. Test Audio Generation
```bash
curl -X POST http://tts.dahopevi.com:5050/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "text": "Hello, this is a test",
    "voice": "alloy",
    "model": "tts-1"
  }'
```

## Integration Benefits

1. **High Quality**: OpenAI's TTS provides natural-sounding voices
2. **Multiple Voices**: 6 different voice options with distinct characteristics
3. **Reliable**: Robust error handling and fallback mechanisms
4. **Integrated**: Seamlessly works with existing video generation workflow
5. **Configurable**: Easy to switch between TTS engines
6. **Scalable**: Supports concurrent audio generation

## Fallback Strategy

The integration includes fallback mechanisms:
1. If OpenAI Edge TTS is unavailable, it falls back to predefined voice lists
2. Timeout protection prevents hanging requests
3. Detailed logging helps with troubleshooting

## Next Steps

1. **Deploy**: Rebuild and deploy your short video maker application
2. **Configure**: Set the required environment variables
3. **Test**: Create a test video using the new TTS engine
4. **Monitor**: Check logs to ensure everything is working correctly

## Recent Fixes Applied ✅

**Issue 1**: The docker-compose.yml was missing the port `:5050` in the OpenAI Edge TTS URL, causing 404 errors.

**Issue 2**: SSL Protocol Error - The service at port 5050 only supports HTTP, not HTTPS, causing `ERR_SSL_PROTOCOL_ERROR`.

**Fixed**: Updated the URL configuration:
- ❌ `OPENAI_EDGE_TTS_URL=https://tts.dahopevi.com` (missing port)
- ❌ `OPENAI_EDGE_TTS_URL=https://tts.dahopevi.com:5050` (wrong protocol)
- ✅ `OPENAI_EDGE_TTS_URL=http://tts.dahopevi.com:5050` (correct)

The integration should now work correctly after rebuilding the container.

## Troubleshooting

If you encounter issues:
1. Check that the OpenAI Edge TTS service is running in Coolify
2. Verify environment variables are set correctly
3. Check network connectivity between services
4. Review logs with `LOG_LEVEL=debug`

For detailed troubleshooting, see `docs/OPENAI_EDGE_TTS_INTEGRATION.md`.

## MCP and Frontend Integration

### MCP Integration ✅
- **Updated**: `src/server/routers/mcp.ts`
- **Added**: Support for `openai-edge-tts` engine in voice listing tools
- **Updated**: Voice examples to include OpenAI TTS voices
- **Updated**: Engine fallback lists

### Frontend Integration ✅
- **Updated**: `src/ui/pages/VideoCreator.tsx` 
- **Added**: "OpenAI Edge TTS (High Quality)" option in TTS Engine dropdown
- **Compatible**: Automatically loads OpenAI voices when engine is selected

### ShortCreator Integration ✅
- **Updated**: `src/short-creator/ShortCreator.ts`
- **Added**: OpenAI voices to fast fallback methods
- **Compatible**: Works with existing voice loading system

## Integration Status: COMPLETE ✅

All components have been updated:
- ✅ Backend TTS integration
- ✅ MCP tools and voice examples
- ✅ Frontend UI dropdown
- ✅ Fast fallback voice lists
- ✅ Environment configuration
- ✅ Docker setup
- ✅ Documentation

## Migration Note

This integration is additive - your existing TTS engines (`kokoro`, `edge-tts`, `streamlabs-polly`) will continue to work. You can switch between engines by changing the `ttsEngine` parameter in your video configuration.
