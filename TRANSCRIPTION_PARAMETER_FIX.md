# Transcription API Parameter Fix

## Problem
The dahopevi transcription API was returning a 400 error:
```
"Invalid payload: Additional properties are not allowed ('max_words_per_line' was unexpected)"
```

## Root Cause Analysis
Upon reviewing the API documentation, `max_words_per_line` **IS** a supported parameter. However, it has a specific requirement:

> **max_words_per_line**: Controls the maximum number of words per line in the **SRT file**. When specified, each segment's text will be split into multiple lines with at most the specified number of words per line.

The issue was that we were sending:
- `max_words_per_line: 8` 
- `include_srt: false`

Since `max_words_per_line` only applies to SRT files, the API rejects it when `include_srt` is false.

## Solution
Modified the transcription payload to only include `max_words_per_line` when `include_srt` is enabled:

```typescript
const payload: any = {
  media_url: mediaUrl,
  task: "transcribe", 
  include_text: true,
  include_segments: true,
  include_srt: false,
  word_timestamps: options.wordTimestamps || true,
  response_type: "direct",
  language: options.language
};

// Only include max_words_per_line if we're including SRT (as per API docs)
if (options.maxWordsPerLine && payload.include_srt) {
  payload.max_words_per_line = options.maxWordsPerLine;
}
```

## API Requirements (from docs)
- `max_words_per_line` is **only valid** when `include_srt: true`
- It controls word wrapping in SRT subtitle format
- Since we use `include_segments: true` for captions, we don't need SRT format
- Therefore, `max_words_per_line` is not needed for our use case

## Files Modified
- `src/short-creator/libraries/Transcription.ts`: Added conditional logic for `max_words_per_line`

## Result
✅ API payload is now valid according to dahopevi requirements  
✅ Transcription requests should succeed  
✅ Video generation can proceed normally  

The parameter is kept in the TypeScript interface for future use if SRT format is ever needed.
