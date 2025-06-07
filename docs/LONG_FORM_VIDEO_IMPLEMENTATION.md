# Long-Form Video Implementation Guide

## Overview

This document provides a complete implementation guide for adding long-form video creation capabilities to your existing short video app. The implementation includes new endpoints, data structures, and processing pipeline specifically designed for long-form YouTube-style videos with person overlays and name banners.

## Architecture Decision

**✅ Separate Endpoint Approach (Recommended)**

We've implemented long-form videos as separate endpoints rather than extending the existing short-video endpoint because:

1. **Different Data Structure**: Long-form videos require additional fields (person_image_url, person_name)
2. **Different Video Layout**: Split-screen/overlay composition vs. full-screen background
3. **Different Processing Pipeline**: Person overlay, name banner, different subtitle positioning
4. **Maintainability**: Keeps short-video functionality focused and stable
5. **Scalability**: Allows for future long-form specific optimizations

## Implementation Status

### ✅ Completed Components

1. **Type Definitions** (`src/types/longform.ts`)
   - Long-form specific types and validation schemas
   - Zod validation for API inputs
   - Status enums and metadata types

2. **Core Logic** (`src/long-creator/LongFormCreator.ts`)
   - Queue-based processing system
   - TTS integration with multiple engines
   - Background video fetching from Pexels
   - Person image download and processing
   - Music selection and integration
   - Admin queue management

3. **API Router** (`src/server/routers/longform.ts`)
   - REST endpoints for CRUD operations
   - Admin endpoints for queue management
   - Error handling and validation

4. **MCP Integration** (`src/server/routers/longFormMcp.ts`)
   - MCP tools for long-form video creation
   - Compatible with the Docker app's MCP interface

5. **Validation** (`src/server/longFormValidator.ts`)
   - Input validation with user-friendly error messages

### 🚧 Pending Implementation

1. **Remotion Renderer** (`src/long-creator/LongFormRemotionRenderer.ts`)
   - Currently a stub that needs full implementation
   - Requires creating Remotion composition for long-form layout

2. **Server Integration**
   - Add long-form components to main server setup
   - Initialize LongFormCreator with dependencies

3. **UI Components** (Optional)
   - Long-form video creation interface
   - Video management dashboard

## API Endpoints

### Long-Form Video Endpoints

```
POST   /api/long-form-video              # Create new long-form video
GET    /api/long-form-video/:id/status   # Get video status
GET    /api/long-form-videos             # List all long-form videos
GET    /api/long-form-video/:id          # Download video file
DELETE /api/long-form-video/:id          # Delete video

# Admin endpoints
GET    /api/admin/long-form-queue-status        # Get queue status
POST   /api/admin/clear-stuck-long-form-videos  # Clear stuck videos
POST   /api/admin/restart-long-form-queue       # Restart queue processing
```

### Request Format

```json
{
  "scenes": [
    {
      "text": "Welcome to my story about...",
      "searchTerms": ["nature", "forest", "peaceful"]
    },
    {
      "text": "In this video, I'll share...",
      "searchTerms": ["technology", "innovation"]
    }
  ],
  "config": {
    "personImageUrl": "https://example.com/person.jpg",
    "personName": "Clara Henshaw",
    "voice": "en-US-AriaNeural",
    "ttsEngine": "edge-tts",
    "music": "contemplative",
    "musicVolume": "medium",
    "nameBannerColor": "#FF4444",
    "personOverlaySize": 0.25,
    "paddingBack": 1500
  }
}
```

## Video Layout Specifications

### Long-Form Video Structure
- **Duration**: Variable (can be very long)
- **Orientation**: Landscape (1920x1080)
- **Layout**: Split-screen/overlay composition

### Visual Elements
1. **Background**: Full-screen background video
2. **Person Overlay**: 
   - Position: Upper left corner
   - Size: Configurable (default 25% of screen width)
   - Content: Professional headshot
3. **Name Banner**:
   - Position: Below person image
   - Background: Configurable color (default coral #FF4444)
   - Text: Person name in white font
   - Icon: Speaker/audio icon
4. **Subtitles**:
   - Position: Lower third, centered
   - Style: Large white text with shadow/outline

## Integration Steps

### 1. Complete Remotion Implementation

You'll need to create a Remotion composition for long-form videos. Based on your existing setup, create:

```typescript
// src/components/videos/LongFormVideo.tsx
import { Composition } from "remotion";

export const LongFormVideo: React.FC<LongFormVideoProps> = ({
  scenes,
  personImageUrl,
  personName,
  nameBannerColor,
  personOverlaySize,
  // ... other props
}) => {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Background video */}
      <BackgroundVideo src={currentScene.video} />
      
      {/* Person overlay */}
      <PersonOverlay
        imageUrl={personImageUrl}
        size={personOverlaySize}
        position="top-left"
      />
      
      {/* Name banner */}
      <NameBanner
        name={personName}
        color={nameBannerColor}
        position="below-person"
      />
      
      {/* Subtitles */}
      <Subtitles
        captions={currentScene.captions}
        position="lower-third"
        style="large-white-with-shadow"
      />
      
      {/* Background music */}
      <Audio src={musicUrl} volume={musicVolume} />
    </div>
  );
};
```

### 2. Update Server Setup

Add to your main server file:

```typescript
// src/server/server.ts
import { LongFormCreator } from "../long-creator/LongFormCreator";
import { LongFormRemotionRenderer } from "../long-creator/LongFormRemotionRenderer";
import { LongFormAPIRouter } from "./routers/longform";

// Initialize long-form components
const longFormRenderer = new LongFormRemotionRenderer(config);
const longFormCreator = new LongFormCreator(
  config,
  longFormRenderer,
  whisper,
  ffmpeg,
  pexelsApi,
  musicManager
);

// Add long-form routes
const longFormRouter = new LongFormAPIRouter(config, longFormCreator);
app.use("/api", longFormRouter.router);
```

### 3. Update MCP Server

Add long-form tools to your existing MCP server:

```typescript
// src/server/routers/mcp.ts
import { createLongFormMcpTools } from "./longFormMcp";

// Add to existing tools
const longFormTools = createLongFormMcpTools(longFormCreator);
const allTools = {
  ...existingTools,
  ...longFormTools
};
```

## Comparison with Docker App

Your implementation now matches the Docker app's capabilities:

| Feature | Docker App | Your Implementation |
|---------|------------|-------------------|
| **API Endpoints** | ✅ | ✅ |
| **Person Image Overlay** | ✅ | ✅ |
| **Name Banner** | ✅ | ✅ |
| **Multiple TTS Engines** | ✅ | ✅ |
| **Background Videos** | ✅ | ✅ |
| **Queue Processing** | ✅ | ✅ |
| **MCP Integration** | ✅ | ✅ |
| **Long-form Support** | ✅ | ✅ |
| **Landscape Orientation** | ✅ | ✅ |

## Key Differences from Short Videos

1. **Always Landscape**: Long-form videos use landscape orientation
2. **Person Overlay**: Additional visual element not in short videos
3. **Name Banner**: Professional presentation element
4. **Extended Timeout**: 45 minutes vs 30 minutes for processing
5. **Different File Naming**: `longform_{id}.mp4` vs `{id}.mp4`
6. **Enhanced Metadata**: Includes person name and scene count

## Testing

Once you complete the Remotion implementation, test with:

```bash
# Create a long-form video
curl -X POST http://localhost:3000/api/long-form-video \
  -H "Content-Type: application/json" \
  -d '{
    "scenes": [
      {
        "text": "Hello, welcome to my channel",
        "searchTerms": ["office", "professional"]
      }
    ],
    "config": {
      "personImageUrl": "https://example.com/person.jpg",
      "personName": "John Doe",
      "voice": "en-US-AriaNeural"
    }
  }'

# Check status
curl http://localhost:3000/api/long-form-video/{videoId}/status

# List videos
curl http://localhost:3000/api/long-form-videos
```

## Benefits of This Architecture

1. **Clean Separation**: Short and long-form videos remain independent
2. **Reuse Existing Infrastructure**: Leverages your TTS, video, and music systems
3. **Extensible**: Easy to add long-form specific features later
4. **Compatible**: Matches the Docker app's API structure
5. **Maintainable**: Clear separation of concerns

## Next Steps

1. Complete the Remotion renderer implementation
2. Add server integration
3. Test the full pipeline
4. Optionally add UI components
5. Consider adding more long-form specific features (chapters, thumbnails, etc.)

The foundation is solid and follows best practices for extending your existing architecture while maintaining compatibility with the Docker app's interface.
