# Web Interface Documentation

## Overview

The Short Video Maker provides a modern, responsive web interface built with React and Material-UI. The interface offers both manual video creation and AI-assisted workflows, making it easy for users to create professional short videos without technical knowledge.

## Access Information

- **URL**: `http://localhost:3123`
- **Authentication**: Username/password login
- **Default Credentials**: 
  - Username: `etugrand`
  - Password: `O0UgSbS4cbOmFa` (configurable via environment variables)
- **Browser Support**: Modern browsers with ES6+ support
- **Responsive Design**: Optimized for desktop and mobile devices

## Getting Started

### 1. Login
1. Navigate to `http://localhost:3123`
2. Enter your username and password
3. Click "Sign In" to access the application

### 2. Main Dashboard
After login, you'll see the main dashboard with navigation options:
- **Video List**: View all created videos
- **Create Video**: Manual video creation
- **Research & Create**: AI-assisted video creation
- **Account**: User settings and logout

## Available Pages and Features

### 1. Video List Page (`/`)

The main dashboard displays all your created videos with:

**Features**:
- **Video Grid**: Thumbnail view of all videos
- **Status Indicators**: 
  - =â Green: Video ready for download
  - =á Yellow: Video processing
  - =4 Red: Video creation failed
- **Action Buttons**:
  - **Play**: Preview video (for completed videos)
  - **Download**: Download MP4 file
  - **Delete**: Remove video and files
- **Metadata Display**: Creation date, duration, status
- **Real-time Updates**: Status updates without page refresh

**Usage**:
1. View all your videos in a grid layout
2. Click on a video to see details
3. Use action buttons to download or delete videos
4. Failed videos show error information

### 2. Manual Video Creator (`/create`)

Create videos by manually defining scenes and configuration.

**Workflow**:
1. **Add Scenes**: Create multiple video scenes
2. **Configure Settings**: Set voice, music, and visual options
3. **Create Video**: Generate the final video

#### Scene Management

**Scene Fields**:
- **Scene Text**: The narration text (what will be spoken)
  - Example: "Welcome to our amazing product demonstration!"
  - Keep scenes 15-60 seconds when spoken
- **Search Terms**: Keywords for background video (comma-separated)
  - Example: "product, demonstration, technology, innovation"
  - Use 2-4 specific, relevant keywords
  - Avoid generic terms like "video" or "content"

**Scene Actions**:
- **Add Scene**: Click "+ Add Scene" to create new scenes
- **Remove Scene**: Click "Remove" to delete a scene
- **Reorder**: Drag and drop to change scene order (if implemented)

#### Video Configuration

**Basic Settings**:
- **End Screen Padding**: Duration to keep playing after narration ends
  - Range: 0-5000 milliseconds
  - Default: 1500ms (1.5 seconds)
  - Recommended: 1000-2000ms for smooth transitions

**Audio Settings**:
- **TTS Provider**: Text-to-speech engine
  - **Kokoro**: High-quality voices, best for English (recommended)
  - **Chatterbox**: Alternative voice options
  - **OpenAI Edge TTS**: Wide language support, good for non-English
- **Voice**: Specific voice for narration
  - Updates dynamically based on selected provider
  - **Recommended**: `af_heart` for English (Grade A quality)
- **Music Volume**: Background music level
  - **High**: 70% volume (default)
  - **Medium**: 45% volume
  - **Low**: 20% volume
  - **Muted**: No background music

**Visual Settings**:
- **Music Mood**: Background music style
  - **Hopeful**: Uplifting, inspirational content
  - **Chill**: Relaxed, casual content
  - **Happy**: Upbeat, positive content
  - **Contemplative**: Thoughtful, serious content
  - **Excited**: High-energy content
  - **Dark**: Dramatic, serious content
- **Caption Position**: Where text appears on screen
  - **Bottom**: Below the video (recommended)
  - **Center**: Middle of the screen
  - **Top**: Above the main content
- **Caption Background**: Text background color
  - Any valid CSS color (blue, red, #FF0000, rgba(0,0,255,0.8))
  - Default: "blue"
- **Orientation**: Video dimensions
  - **Portrait**: 9:16 ratio (TikTok, Instagram Stories)
  - **Landscape**: 16:9 ratio (YouTube, general use)

**Advanced Settings**:
- **Language**: Override automatic language detection
  - Leave as "Auto-detect from voice" for best results
  - Override only if needed for specific transcription requirements
  - Supported: English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi, Dutch, Polish

### 3. AI Video Researcher (`/research`)

Create videos using AI research and automated scene generation.

#### Step 1: Topic Research

**Research Input**:
- **Search Term**: Topic to research
  - Example: "artificial intelligence in healthcare"
  - Be specific for better results
  - Can be questions or topics
- **Target Language**: Language for content generation
  - Affects both research and final video language
  - Default: English

**AI Research Process**:
1. Uses Perplexity API for comprehensive research
2. Fallback to DeepSeek AI if Perplexity unavailable
3. Generates structured content with sources
4. Takes 10-30 seconds depending on topic complexity

#### Step 2: Review Research Results

**Research Display**:
- **Title**: AI-generated title for the content
- **Content**: Comprehensive research results
- **Sources**: Attribution links for fact-checking
- **Expandable Sections**: Click to show/hide full content

**Actions**:
- **Edit Content**: Modify research results if needed
- **Regenerate**: Run research again with different parameters
- **Proceed**: Continue to scene generation

#### Step 3: Generate and Customize Scenes

**AI Scene Generation**:
- Automatically breaks research into video scenes
- Creates appropriate search terms for each scene
- Suggests optimal configuration based on content

**Scene Customization**:
- **Edit Scene Text**: Modify AI-generated narration
- **Adjust Search Terms**: Change keywords for background video
- **Add/Remove Scenes**: Customize scene count and content
- **Configuration**: Same options as manual creation

#### Step 4: Video Creation

**Final Review**:
- Preview all scenes and configuration
- Make final adjustments
- Click "Create Video" to start processing

### 4. Video Details Page (`/video/{videoId}`)

View details and manage individual videos.

**Information Displayed**:
- **Video Player**: For completed videos
- **Processing Status**: Real-time updates
- **Configuration Used**: Voice, music, orientation settings
- **Creation Timestamp**: When video was created
- **File Size**: Video file size (for completed videos)

**Available Actions**:
- **Download**: Get MP4 file
- **Delete**: Remove video
- **Retry**: Recreate failed videos (if applicable)
- **Share**: Copy shareable link (if sharing enabled)

**Status Information**:
- **Processing**: Shows progress and estimated completion
- **Ready**: Video available for download/viewing
- **Failed**: Error message and troubleshooting info

## Best Practices

### Scene Creation Tips

1. **Text Length**: Keep scenes 15-60 seconds when spoken
2. **Clear Narration**: Use conversational, engaging language
3. **Keyword Selection**: Choose specific, visual keywords
4. **Scene Flow**: Ensure logical progression between scenes
5. **Call to Action**: End with clear next steps if appropriate

### Configuration Recommendations

1. **For Educational Content**:
   - Voice: af_heart (clear, professional)
   - Music: contemplative or hopeful
   - Captions: bottom position
   - Orientation: portrait for social media

2. **For Marketing Content**:
   - Voice: af_heart or af_alloy
   - Music: excited or happy
   - Captions: bottom with brand colors
   - Orientation: depends on platform

3. **For Storytelling**:
   - Voice: af_heart for emotional content
   - Music: matches story mood
   - Captions: center or bottom
   - Orientation: landscape for cinematic feel

### Quality Optimization

1. **Voice Selection**: Use Kokoro provider with af_heart for best English quality
2. **Background Videos**: Use specific, relevant search terms
3. **Music Balance**: Medium volume for most content
4. **Caption Readability**: Use high contrast colors
5. **Preview**: Always review before final creation

## Troubleshooting

### Common Issues

**1. Video Creation Fails**
- Check internet connection
- Verify all required fields are filled
- Try different search terms if no videos found
- Check server logs for specific errors

**2. Poor Background Video Quality**
- Use more specific search terms
- Avoid generic keywords
- Try alternative keywords for the same concept
- Check Pexels API key configuration

**3. Voice Not Available**
- Refresh the page to update voice list
- Try different TTS provider
- Check TTS service status

**4. Long Processing Times**
- Videos typically take 1-3 minutes
- Complex scenes may take longer
- Check system resources
- Multiple concurrent videos may slow processing

### Browser Compatibility

**Supported Browsers**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features**:
- JavaScript enabled
- Local storage for session management
- Fetch API support
- ES6+ support

### Mobile Usage

**Optimizations**:
- Responsive design adapts to mobile screens
- Touch-friendly interface elements
- Optimized form layouts
- Mobile-specific navigation

**Limitations**:
- Video preview may be limited on small screens
- Large video downloads may be slow on mobile data
- Some advanced features better suited for desktop

## Advanced Features

### Bulk Operations

**Multiple Video Creation**:
- Create videos in batches using research workflow
- Queue management for multiple processing jobs
- Download multiple videos as ZIP archive (if implemented)

### Custom Branding

**Configuration Options**:
- Custom caption colors matching brand
- Consistent voice selection across videos
- Branded intro/outro templates (if implemented)

### Integration Features

**Export Options**:
- Direct social media sharing (if configured)
- Cloud storage integration (if available)
- API integration for automated workflows

### Analytics and Insights

**Usage Tracking**:
- Video creation history
- Popular configuration options
- Processing time analytics
- Success/failure rates

## Security and Privacy

### Data Handling
- Videos stored locally on server
- No automatic cloud uploads
- User data protected by authentication
- Session-based security

### Content Policies
- Respect copyright in search terms
- Follow platform guidelines for target social media
- Appropriate content for intended audience
- Attribution for research sources

## Configuration and Customization

### Environment Variables

Customize the web interface behavior:

```bash
# Authentication
AUTH_USERNAME=your-username           # Login username
AUTH_PASSWORD_HASH=your-password     # Login password (hashed or plain)
SESSION_SECRET=your-session-secret   # Session encryption key

# Features
PERPLEXITY_API_KEY=your-key         # Enable AI research
DEEPSEEK_API_KEY=your-key           # Enable AI scene generation
GOOGLE_SEARCH_API_KEY=your-key      # Research fallback

# Media Services
PEXELS_API_KEY=your-key             # Required for background videos
TTS_API_KEY=your-key                # External TTS service
```

### UI Customization

**Theme Options**: Modify Material-UI theme in the source code
**Branding**: Update logos and colors in the React components
**Features**: Enable/disable features based on API key availability

For developers looking to integrate with the web interface, see the [API documentation](./api.md) and [MCP interface guide](./mcp.md).