# OpenAI Edge TTS Integration

This document explains how to use the OpenAI Edge TTS service with the short video maker application.

## Overview

The OpenAI Edge TTS integration allows you to use OpenAI's text-to-speech capabilities for generating high-quality audio for your short videos. This service is deployed alongside your Dahopevi application in Coolify.

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# OpenAI Edge TTS Configuration
OPENAI_EDGE_TTS_URL=https://tts.dahopevi.com:5050
OPENAI_EDGE_TTS_API_KEY=your_openai_api_key_here
# OR alternatively:
OPENAI_API_KEY=your_openai_api_key_here
```

### Service Details

- **Service URL**: `https://tts.dahopevi.com:5050`
- **Container Name**: `openai-edge-tts` (or `app-i48okoo08os4c0w0oo4o0s4o-010500500567`)
- **Coolify Project**: `apis`
- **Coolify Service Name**: `openai-edge-tts`

## Usage

### Using the OpenAI Edge TTS Engine

To use OpenAI Edge TTS in your video generation, specify the TTS engine in your render configuration:

```javascript
const config = {
  ttsEngine: "openai-edge-tts",
  voice: "alloy", // or any other supported OpenAI voice
  // ... other configuration options
};
```

### Supported Voices

The OpenAI Edge TTS service supports the following voices:

#### OpenAI TTS-1 Voices
- `alloy` - Neutral, balanced voice
- `echo` - Clear, expressive voice  
- `fable` - Warm, storytelling voice
- `onyx` - Deep, authoritative voice
- `nova` - Bright, energetic voice
- `shimmer` - Soft, gentle voice

#### Fallback Edge TTS Voices
If your service also supports Microsoft Edge TTS voices, the following are available as fallbacks:

- English: `en-US-AriaNeural`, `en-US-JennyNeural`, `en-US-GuyNeural`, etc.
- French: `fr-FR-DeniseNeural`, `fr-FR-HenriNeural`, etc.
- Spanish: `es-ES-ElviraNeural`, `es-MX-DaliaNeural`, etc.
- German: `de-DE-KatjaNeural`, `de-DE-ConradNeural`, etc.
- And many more languages...

## API Endpoints

### Generate Speech

**POST** `/v1/audio/speech`

```json
{
  "text": "Hello, this is a test message.",
  "voice": "alloy",
  "model": "tts-1",
  "response_format": "mp3"
}
```

**Response:**
```json
{
  "audio_url": "https://example.com/path/to/audio.mp3",
  "duration": 3.5
}
```

### List Available Voices

**GET** `/v1/audio/speech/voices`

Returns a list of available voices for the service.

## Error Handling

The integration includes robust error handling:

- **Timeout Protection**: 30-second timeout for TTS generation, 15-second timeout for audio download
- **Fallback Voices**: If the API is unavailable, fallback to a predefined list of voices
- **Retry Logic**: Automatic retry with exponential backoff
- **Detailed Logging**: Comprehensive logging for debugging

## Troubleshooting

### Common Issues

1. **Service Unavailable**
   - Check that the OpenAI Edge TTS container is running in Coolify
   - Verify the service URL is correct: `https://tts.dahopevi.com:5050`
   - Check network connectivity between containers

2. **Invalid API Key**
   - Ensure `OPENAI_EDGE_TTS_API_KEY` or `OPENAI_API_KEY` is set correctly
   - Verify the API key has sufficient permissions

3. **Voice Not Found**
   - Check that the specified voice is supported
   - Use `/v1/audio/speech/voices` endpoint to list available voices

4. **Audio Generation Timeout**
   - Check if the text is too long (try shorter text)
   - Verify the TTS service is responding normally
   - Check service logs for any errors

### Debugging

Enable debug logging by setting:

```env
LOG_LEVEL=debug
```

This will provide detailed logs of the TTS generation process.

## Performance Considerations

- **Caching**: Voice lists are cached during initialization to improve performance
- **Timeouts**: Reasonable timeouts prevent hanging requests
- **Error Recovery**: Fallback mechanisms ensure service availability
- **Concurrent Requests**: The service supports multiple concurrent TTS generations

## Migration from Other TTS Services

If you're migrating from another TTS service, update your render configuration:

```javascript
// Old configuration
const config = {
  ttsEngine: "edge-tts", // or "kokoro"
  voice: "en-US-AriaNeural",
};

// New configuration with OpenAI Edge TTS
const config = {
  ttsEngine: "openai-edge-tts",
  voice: "alloy", // Use OpenAI voice names
};
```

## Integration with Coolify

Since both services run in the same Coolify project, they can communicate efficiently:

- **Network**: Both containers are on the same Docker network
- **Service Discovery**: Use service names for internal communication
- **Load Balancing**: Coolify handles load balancing and health checks
- **Monitoring**: Monitor both services through the Coolify dashboard

## Security

- **API Keys**: Store API keys securely in environment variables
- **Network**: Services communicate over internal Docker network when possible
- **HTTPS**: External communication uses HTTPS
- **Authentication**: Bearer token authentication for API requests

## Support

For issues related to:
- **Integration**: Check this documentation and application logs
- **OpenAI TTS Service**: Check the OpenAI Edge TTS container logs in Coolify
- **Coolify Deployment**: Check Coolify documentation and service status

## Example Usage

Here's a complete example of creating a short video with OpenAI Edge TTS:

```javascript
const videoConfig = {
  scenes: [
    {
      text: "Welcome to our amazing product demo!",
      searchTerms: ["technology", "innovation", "product"]
    },
    {
      text: "Let's explore the features that make us unique.",
      searchTerms: ["features", "unique", "software"]
    }
  ],
  config: {
    ttsEngine: "openai-edge-tts",
    voice: "nova",
    orientation: "portrait",
    captionPosition: "bottom",
    musicVolume: "medium"
  }
};
```

This will generate a video using OpenAI's high-quality TTS with the "nova" voice.
