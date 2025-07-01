# MCP (Model Context Protocol) Interface Documentation

## Overview

The MCP interface allows AI agents to interact with the Short Video Maker through a structured protocol. This interface is designed for programmatic access by AI systems and provides comprehensive tools for video creation, voice management, and system configuration.

## Connection Details

- **Base URL**: `http://localhost:3123/mcp`
- **Transport**: Server-Sent Events (SSE)
- **Authentication**: Bearer token (API_KEY) or session-based authentication
- **Endpoints**:
  - `GET /mcp/sse` - Establish SSE connection
  - `POST /mcp/messages` - Send MCP messages

## Available MCP Tools

### 1. `create-short-video`
Creates a short video from a list of scenes.

**Parameters**:
```typescript
{
  scenes: Array<{
    text: string;           // Narration text
    searchTerms: string[];  // Keywords for background video
  }>;
  config: {
    paddingBack?: number;              // End screen padding (ms)
    music?: string;                    // Music mood
    captionPosition?: "top" | "center" | "bottom";
    captionBackgroundColor?: string;   // CSS color
    voice?: string;                    // Voice name
    provider?: "kokoro" | "chatterbox" | "openai-edge-tts";
    orientation?: "portrait" | "landscape";
    musicVolume?: "muted" | "low" | "medium" | "high";
    language?: string;                 // Language code (e.g., "en")
  };
}
```

**Returns**: `{ videoId: string }`

**Example**:
```json
{
  "scenes": [
    {
      "text": "Welcome to our amazing product demonstration!",
      "searchTerms": ["product", "demonstration", "technology"]
    },
    {
      "text": "Here's how it works in three simple steps.",
      "searchTerms": ["steps", "tutorial", "guide"]
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
}
```

### 2. `get-video-status`
Retrieves the processing status of a video.

**Parameters**:
```typescript
{
  videoId: string;  // Video ID returned from create-short-video
}
```

**Returns**: `"processing" | "ready" | "failed"`

### 3. `list-tts-providers`
Lists all available TTS (Text-to-Speech) providers.

**Parameters**: None

**Returns**: `string[]` - Array of provider names

**Example Response**: `["kokoro", "chatterbox", "openai-edge-tts"]`

### 4. `list-voices-for-provider`
Lists voices available for a specific TTS provider.

**Parameters**:
```typescript
{
  provider: "kokoro" | "chatterbox" | "openai-edge-tts";
}
```

**Returns**: `string[]` - Array of voice names for the provider

**Example Response**: `["af_heart", "af_alloy", "af_aoede"]`

### 5. `list-all-voices`
Lists all voices across all providers with provider mapping.

**Parameters**: None

**Returns**: Object mapping providers to their available voices

**Example Response**:
```json
{
  "kokoro": ["af_heart", "af_alloy", "af_aoede"],
  "openai-edge-tts": ["alloy", "echo", "fable"],
  "chatterbox": ["Emily.wav", "Michael.wav"]
}
```

### 6. `get-predefined-voices-by-language`
Gets recommended voices organized by language with quality information.

**Parameters**: None

**Returns**: Language-based voice recommendations with quality notes

**Example Response**:
```json
{
  "English": {
    "kokoro": ["af_heart", "af_alloy", "af_aoede"],
    "openai-edge-tts": ["alloy", "echo", "fable"],
    "chatterbox": ["Emily.wav", "Michael.wav"],
    "note": "Kokoro: af_heart is Grade A quality. OpenAI Edge TTS supports many more voices than shown here."
  },
  "French": {
    "openai-edge-tts": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"],
    "note": "Use openai-edge-tts for French voices."
  }
}
```

### 7. `validate-voice-provider-combination`
Validates if a voice is compatible with a TTS provider.

**Parameters**:
```typescript
{
  voice: string;     // Voice name to validate
  provider: string;  // TTS provider
}
```

**Returns**: Validation result with suggestions if incompatible

## Available MCP Resources

### 1. `voice-provider-guide`
- **URI**: `voice-provider://guide`
- **Type**: Markdown documentation
- **Content**: Complete guide for TTS voice and provider combinations including:
  - Voice-provider compatibility matrix
  - Usage examples and best practices
  - Quick reference for language-specific recommendations
  - Quality grades for Kokoro voices

## Best Practices for AI Agents

### 1. **Provider Selection**
- **For English content**: Prefer Kokoro provider with `af_heart` voice (Grade A quality)
- **For other languages**: Use `openai-edge-tts` provider exclusively
- **Always validate** voice-provider combinations before creating videos

### 2. **Music Selection**
Available music moods:
- `sad`, `melancholic` - For somber content
- `happy`, `euphoric`, `excited` - For upbeat content  
- `chill` - For relaxed content
- `uneasy`, `angry`, `dark` - For dramatic content
- `hopeful`, `contemplative` - For inspirational content
- `funny` - For comedic content

### 3. **Scene Creation**
- **Text**: Keep narration concise and engaging (30-60 seconds per scene)
- **Search Terms**: Use 2-4 relevant keywords that describe visual content
- **Avoid**: Generic terms like "video", "content" - be specific

### 4. **Error Handling**
- Always check video status before assuming completion
- Handle `failed` status by checking logs or retrying with different parameters
- Validate voice-provider combinations before video creation

## Example MCP Client Implementation

```javascript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';

class ShortVideoMCPClient {
  constructor(baseUrl = 'http://localhost:3123') {
    this.client = new McpClient();
    this.baseUrl = baseUrl;
  }

  async connect() {
    await this.client.connect(`${this.baseUrl}/mcp/sse`);
  }

  async createVideo(scenes, config) {
    // Validate voice-provider combination
    if (config.voice && config.provider) {
      const isValid = await this.client.callTool('validate-voice-provider-combination', {
        voice: config.voice,
        provider: config.provider
      });
      
      if (!isValid.valid) {
        console.warn('Invalid voice-provider combination:', isValid.suggestion);
        // Use suggested voice or default
        config.voice = isValid.suggestedVoice;
      }
    }

    // Create video
    const result = await this.client.callTool('create-short-video', {
      scenes,
      config
    });

    return result.videoId;
  }

  async waitForCompletion(videoId, maxWaitTime = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.client.callTool('get-video-status', { videoId });
      
      if (status === 'ready') {
        return 'completed';
      } else if (status === 'failed') {
        throw new Error(`Video creation failed for ID: ${videoId}`);
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Video creation timed out for ID: ${videoId}`);
  }

  async getRecommendedVoices(language = 'English') {
    const voices = await this.client.callTool('get-predefined-voices-by-language');
    return voices[language] || voices['English'];
  }
}

// Usage example
async function createVideoWithMCP() {
  const client = new ShortVideoMCPClient();
  await client.connect();

  const scenes = [
    {
      text: "Artificial intelligence is transforming our world.",
      searchTerms: ["artificial", "intelligence", "technology", "future"]
    },
    {
      text: "From healthcare to transportation, AI is everywhere.",
      searchTerms: ["healthcare", "transportation", "innovation"]
    }
  ];

  const config = {
    voice: "af_heart",
    provider: "kokoro", 
    music: "hopeful",
    orientation: "portrait",
    captionPosition: "bottom",
    musicVolume: "medium"
  };

  try {
    const videoId = await client.createVideo(scenes, config);
    console.log(`Video creation started: ${videoId}`);
    
    await client.waitForCompletion(videoId);
    console.log(`Video completed: ${videoId}`);
    
    // Video is ready for download at: /api/short-video/${videoId}
  } catch (error) {
    console.error('Video creation failed:', error);
  }
}
```

## Authentication

The MCP interface supports two authentication methods:

### 1. **Bearer Token Authentication**
```javascript
const headers = {
  'Authorization': `Bearer ${process.env.API_KEY}`
};
```

### 2. **Session-Based Authentication**
- Login through the web interface first
- Session cookies will be automatically included in MCP requests

## Error Handling

Common error scenarios and how to handle them:

- **Invalid voice-provider combination**: Use `validate-voice-provider-combination` tool
- **Missing API keys**: Ensure PEXELS_API_KEY is configured
- **Video creation timeout**: Videos typically take 1-3 minutes to process
- **Failed video status**: Check server logs for specific error details

## Troubleshooting

1. **Connection Issues**: Verify the server is running on the correct port
2. **Authentication Errors**: Check API key or session validity
3. **Voice Not Found**: Use `list-voices-for-provider` to get current voice list
4. **Video Creation Fails**: Validate all required fields and API keys

For more detailed information about the underlying API, see [api.md](./api.md).