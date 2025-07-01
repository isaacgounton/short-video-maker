# REST API Documentation

## Overview

The Short Video Maker provides a comprehensive REST API for programmatic video creation. This API allows developers to integrate video generation capabilities into their applications, automate content creation workflows, and build custom interfaces.

## Base Configuration

- **Base URL**: `http://localhost:3123/api`
- **Authentication**: Bearer token or session-based
- **Content-Type**: `application/json`
- **Response Format**: JSON

## Authentication

### Bearer Token Authentication
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     http://localhost:3123/api/endpoint
```

### Session Authentication
Login through the web interface first, then use session cookies for subsequent requests.

## Core Video Creation Endpoints

### 1. `POST /api/short-video`
Creates a new short video with specified scenes and configuration.

**Request Body**:
```json
{
  "scenes": [
    {
      "text": "Welcome to our amazing product!",
      "searchTerms": ["product", "technology", "innovation"]
    },
    {
      "text": "Here's how it transforms your workflow.",
      "searchTerms": ["workflow", "transformation", "efficiency"]
    }
  ],
  "config": {
    "paddingBack": 1500,
    "music": "hopeful",
    "captionPosition": "bottom",
    "captionBackgroundColor": "blue",
    "voice": "af_heart",
    "provider": "kokoro",
    "orientation": "portrait",
    "musicVolume": "medium",
    "language": "en"
  }
}
```

**Response**:
```json
{
  "videoId": "cmcksnz9q004r01qgdgj3gilh"
}
```

**Configuration Options**:
- `paddingBack` (number, optional): End screen padding in milliseconds (default: 1500)
- `music` (string, optional): Music mood - "sad", "melancholic", "happy", "euphoric", "excited", "chill", "uneasy", "angry", "dark", "hopeful", "contemplative", "funny"
- `captionPosition` (string, optional): "top", "center", "bottom" (default: "bottom")
- `captionBackgroundColor` (string, optional): Any valid CSS color (default: "blue")
- `voice` (string, optional): Voice name from available TTS voices
- `provider` (string, optional): "kokoro", "chatterbox", "openai-edge-tts" (default: "kokoro")
- `orientation` (string, optional): "portrait", "landscape" (default: "portrait")
- `musicVolume` (string, optional): "muted", "low", "medium", "high" (default: "high")
- `language` (string, optional): Language code for transcription override (e.g., "en", "es", "fr")

### 2. `GET /api/short-video/{videoId}/status`
Retrieves the processing status of a video.

**Response**:
```json
{
  "status": "processing"
}
```

**Status Values**:
- `processing`: Video is being created
- `ready`: Video is complete and available for download
- `failed`: Video creation failed

### 3. `GET /api/short-video/{videoId}`
Downloads the completed video file.

**Response**: 
- **Content-Type**: `video/mp4`
- **Body**: Video file binary data

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost:3123/api/short-video/cmcksnz9q004r01qgdgj3gilh \
     -o my-video.mp4
```

### 4. `GET /api/short-videos`
Lists all videos with their metadata and status.

**Response**:
```json
{
  "videos": [
    {
      "id": "cmcksnz9q004r01qgdgj3gilh",
      "status": "ready",
      "createdAt": "2025-01-01T12:00:00Z",
      "config": {
        "orientation": "portrait",
        "music": "hopeful",
        "provider": "kokoro"
      }
    }
  ]
}
```

### 5. `DELETE /api/short-video/{videoId}`
Deletes a video and its associated files.

**Response**:
```json
{
  "success": true,
  "message": "Video deleted successfully"
}
```

## TTS (Text-to-Speech) Configuration Endpoints

### 6. `GET /api/tts/providers`
Lists all available TTS providers.

**Response**:
```json
["kokoro", "chatterbox", "openai-edge-tts"]
```

### 7. `GET /api/tts/{provider}/voices`
Lists voices available for a specific TTS provider.

**Parameters**:
- `provider`: One of "kokoro", "chatterbox", "openai-edge-tts"

**Response** (for Kokoro):
```json
["af_heart", "af_alloy", "af_aoede", "af_bella", "af_sky"]
```

**Response** (for OpenAI Edge TTS):
```json
["alloy", "echo", "fable", "onyx", "nova", "shimmer", "en-US-JennyNeural", "fr-FR-DeniseNeural"]
```

### 8. `GET /api/music-tags`
Lists available music mood tags for video background music.

**Response**:
```json
["sad", "melancholic", "happy", "euphoric", "excited", "chill", "uneasy", "angry", "dark", "hopeful", "contemplative", "funny"]
```

### 9. `GET /api/voices` (Legacy)
Lists all available voices across providers.

**Response**:
```json
[
  {
    "name": "af_heart",
    "provider": "kokoro",
    "language": "en",
    "gender": "female"
  }
]
```

## AI Research Endpoints

### 10. `POST /api/research-topic`
Uses AI to research a topic and generate comprehensive content.

**Request Body**:
```json
{
  "searchTerm": "artificial intelligence in healthcare",
  "targetLanguage": "en"
}
```

**Response**:
```json
{
  "title": "AI in Healthcare: Transforming Patient Care",
  "content": "Artificial intelligence is revolutionizing healthcare...",
  "sources": [
    "https://example.com/ai-healthcare-study",
    "https://example.com/medical-ai-trends"
  ],
  "language": "en"
}
```

### 11. `POST /api/generate-scenes`
Generates video scenes from research content using AI.

**Request Body**:
```json
{
  "content": "Artificial intelligence is revolutionizing healthcare by improving diagnostic accuracy, streamlining workflows, and enabling personalized treatment plans.",
  "title": "AI in Healthcare",
  "targetLanguage": "en"
}
```

**Response**:
```json
{
  "scenes": [
    {
      "text": "Artificial intelligence is transforming healthcare as we know it.",
      "searchTerms": ["artificial intelligence", "healthcare", "technology"]
    },
    {
      "text": "From diagnosis to treatment, AI is improving patient outcomes.",
      "searchTerms": ["diagnosis", "treatment", "patient care"]
    }
  ],
  "config": {
    "voice": "af_heart",
    "provider": "kokoro",
    "music": "hopeful",
    "orientation": "portrait",
    "language": "en"
  }
}
```

## File Serving Endpoints

### 12. `GET /api/tmp/{tmpFile}`
Serves temporary files including audio and video assets.

**Parameters**:
- `tmpFile`: Filename of the temporary file

**Response**: File binary data with appropriate Content-Type

### 13. `GET /api/music/{fileName}`
Serves background music files for video creation.

**Parameters**:
- `fileName`: Name of the music file

**Response**: 
- **Content-Type**: `audio/mpeg`
- **Body**: MP3 audio file

## Video Creation Workflow

### Complete Video Creation Example

```bash
#!/bin/bash

API_KEY="your-api-key-here"
BASE_URL="http://localhost:3123/api"

# 1. Create a video
VIDEO_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" \
                     -H "Content-Type: application/json" \
                     -X POST "$BASE_URL/short-video" \
                     -d '{
                       "scenes": [
                         {
                           "text": "Welcome to the future of AI technology!",
                           "searchTerms": ["AI", "technology", "future", "innovation"]
                         },
                         {
                           "text": "Discover how artificial intelligence is changing everything.",
                           "searchTerms": ["artificial intelligence", "change", "transformation"]
                         }
                       ],
                       "config": {
                         "voice": "af_heart",
                         "provider": "kokoro",
                         "music": "hopeful",
                         "orientation": "portrait",
                         "captionPosition": "bottom",
                         "musicVolume": "medium"
                       }
                     }')

VIDEO_ID=$(echo $VIDEO_RESPONSE | jq -r '.videoId')
echo "Video ID: $VIDEO_ID"

# 2. Poll for completion
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" \
               "$BASE_URL/short-video/$VIDEO_ID/status" | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "ready" ]; then
    echo "Video is ready!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Video creation failed!"
    exit 1
  fi
  
  sleep 10
done

# 3. Download the video
curl -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/short-video/$VIDEO_ID" \
     -o "generated-video-$VIDEO_ID.mp4"

echo "Video downloaded: generated-video-$VIDEO_ID.mp4"
```

### Python Example

```python
import requests
import time
import json

class ShortVideoAPI:
    def __init__(self, base_url="http://localhost:3123", api_key=None):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}' if api_key else None
        }
    
    def create_video(self, scenes, config):
        """Create a new video"""
        response = requests.post(
            f"{self.base_url}/api/short-video",
            headers=self.headers,
            json={"scenes": scenes, "config": config}
        )
        response.raise_for_status()
        return response.json()['videoId']
    
    def get_status(self, video_id):
        """Get video processing status"""
        response = requests.get(
            f"{self.base_url}/api/short-video/{video_id}/status",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()['status']
    
    def download_video(self, video_id, filename):
        """Download completed video"""
        response = requests.get(
            f"{self.base_url}/api/short-video/{video_id}",
            headers=self.headers
        )
        response.raise_for_status()
        
        with open(filename, 'wb') as f:
            f.write(response.content)
    
    def wait_for_completion(self, video_id, max_wait=300):
        """Wait for video to complete processing"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status = self.get_status(video_id)
            
            if status == 'ready':
                return True
            elif status == 'failed':
                raise Exception(f"Video creation failed for ID: {video_id}")
            
            time.sleep(10)
        
        raise Exception(f"Video creation timed out for ID: {video_id}")

# Usage example
api = ShortVideoAPI(api_key="your-api-key-here")

scenes = [
    {
        "text": "Artificial intelligence is reshaping our world.",
        "searchTerms": ["AI", "technology", "future"]
    },
    {
        "text": "From healthcare to transportation, AI is everywhere.",
        "searchTerms": ["healthcare", "transportation", "innovation"]
    }
]

config = {
    "voice": "af_heart",
    "provider": "kokoro",
    "music": "hopeful",
    "orientation": "portrait",
    "musicVolume": "medium"
}

# Create video
video_id = api.create_video(scenes, config)
print(f"Video creation started: {video_id}")

# Wait for completion
api.wait_for_completion(video_id)
print("Video completed!")

# Download video
api.download_video(video_id, f"video_{video_id}.mp4")
print("Video downloaded!")
```

## Error Handling

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Authentication required or invalid
- **404**: Not Found - Resource not found
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - Server processing error

### Error Response Format
```json
{
  "error": "Error description",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Common Error Scenarios

1. **Invalid Voice-Provider Combination**
```json
{
  "error": "Voice 'en-US-JennyNeural' is not compatible with provider 'kokoro'",
  "suggestion": "Use 'af_heart' voice with kokoro provider"
}
```

2. **Missing API Keys**
```json
{
  "error": "PEXELS_API_KEY environment variable is missing",
  "details": "Background video search requires Pexels API access"
}
```

3. **Video Not Found**
```json
{
  "error": "Video not found",
  "videoId": "invalid-video-id"
}
```

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Video Creation**: Limited to 10 concurrent video creations
- **Headers**: Rate limit information included in response headers
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Reset timestamp

## Environment Variables

Required environment variables for full functionality:

```bash
# Required
PEXELS_API_KEY=your-pexels-api-key        # For background video search
API_KEY=your-api-authentication-key       # For API authentication

# Optional (for AI features)
PERPLEXITY_API_KEY=your-perplexity-key    # For AI research
DEEPSEEK_API_KEY=your-deepseek-key        # For scene generation
GOOGLE_SEARCH_API_KEY=your-google-key     # For research fallback
GOOGLE_SEARCH_ENGINE_ID=your-engine-id    # For research fallback

# TTS Configuration
TTS_API_KEY=your-tts-api-key              # For external TTS service
TTS_API_URL=https://tts.your-domain.com   # Custom TTS endpoint

# Server Configuration
PORT=3123                                 # Server port
NODE_ENV=production                       # Environment
LOG_LEVEL=info                           # Logging level
```

## OpenAPI/Swagger Documentation

For interactive API documentation, the server provides OpenAPI specification at:
- **URL**: `http://localhost:3123/api/docs` (if implemented)
- **Format**: OpenAPI 3.0

## WebSocket Support

For real-time video processing updates:
- **Endpoint**: `ws://localhost:3123/api/video-updates`
- **Authentication**: Include `Authorization` header in WebSocket upgrade request
- **Events**: `processing`, `completed`, `failed`, `progress`

## SDK and Client Libraries

Official client libraries available for:
- **Node.js**: `npm install short-video-maker-client`
- **Python**: `pip install short-video-maker`
- **REST Client**: Use any HTTP client library

For advanced usage and integration patterns, see the [MCP documentation](./mcp.md) and [Web interface guide](./web.md).