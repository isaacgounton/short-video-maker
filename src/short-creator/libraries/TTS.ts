import fs from "fs";
import path from "path";
import { logger } from "../../config";
import { TTSProvider, TTSVoice } from "../../types/shorts";

export class TTS {
  private baseUrl: string;

  constructor(baseUrl: string = "https://tts.dahopevi.com") {
    // Ensure the baseUrl ends properly - remove trailing /api if present, we'll add endpoints as needed
    this.baseUrl = baseUrl.replace(/\/api\/?$/, "");
    logger.info({ baseUrl: this.baseUrl }, "TTS service URL configured");
  }

  async generate(
    text: string,
    voice: string,
    provider: TTSProvider,
    speed: number = 1.0,
    format: string = "wav"
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
    format: string;
  }> {
    try {
      // If baseUrl already includes /api, use it directly, otherwise add /api
      const apiUrl = this.baseUrl.includes('/api') ? this.baseUrl : `${this.baseUrl}/api`;
      const response = await fetch(`${apiUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice,
          provider,
          speed,
          format,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS API error: Provider error: HTTP ${response.status} - ${errorText}`);
      }

      // Parse the response - handle both array and object responses
      const responseData = await response.json();
      
      // Check if response is an array (new format) and extract the first successful result
      const result = Array.isArray(responseData) 
        ? responseData.find(item => item.success) 
        : responseData;
      
      if (!result) {
        throw new Error(`TTS API error: No successful result returned`);
      }
      
      if (!result.success) {
        throw new Error(`TTS API error: ${result.error || 'Unknown error'}`);
      }

      // Get audio_url from the response - this is directly a full URL in the new format
      let audioUrl = result.audio_url;
      
      if (!audioUrl) {
        throw new Error('No audio URL returned from TTS service');
      }
      
      // Log the audio URL for debugging
      logger.debug({ audioUrl, provider, voice }, "Requesting audio from URL");
      
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Check if we received a valid audio buffer
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error(`Received empty audio buffer from ${audioUrl}`);
      }
      
      logger.debug({ 
        audioBufferSize: audioBuffer.byteLength,
        audioUrl
      }, "Audio buffer downloaded successfully");
      
      // Use the duration from the API response (in milliseconds) or estimate based on text length
      const audioLength = result.duration ? result.duration / 1000 : text.split(" ").length * 0.3;

      // Determine actual format from content, prioritizing header analysis
      let actualFormat = format; // Default to the requested format
      
      // First, try to detect format from the actual audio data header
      const headerBytes = new Uint8Array(audioBuffer.slice(0, 16));
      
      // Check for MP3 header (most common issue)
      if (
        (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33) || // ID3
        ((headerBytes[0] === 0xFF) && ((headerBytes[1] & 0xE0) === 0xE0)) || // MPEG frame sync
        (headerBytes[0] === 0xFF && headerBytes[1] === 0xFB) // Very common MP3 header
      ) {
        actualFormat = 'mp3';
        logger.debug("Detected MP3 format from audio header, overriding URL/content-type detection");
      }
      // Check for WAV header - "RIFF" + "WAVE"
      else if (
        headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46 &&
        headerBytes[8] === 0x57 && headerBytes[9] === 0x41 && headerBytes[10] === 0x56 && headerBytes[11] === 0x45
      ) {
        actualFormat = 'wav';
        logger.debug("Detected WAV format from audio header");
      }
      // Check for FLAC header - "fLaC"
      else if (
        headerBytes[0] === 0x66 && headerBytes[1] === 0x4C && headerBytes[2] === 0x61 && headerBytes[3] === 0x43
      ) {
        actualFormat = 'flac';
        logger.debug("Detected FLAC format from audio header");
      }
      // Check for Ogg/Opus header - "OggS"
      else if (
        headerBytes[0] === 0x4F && headerBytes[1] === 0x67 && headerBytes[2] === 0x67 && headerBytes[3] === 0x53
      ) {
        actualFormat = 'opus';
        logger.debug("Detected Opus format from audio header");
      }
      // Fallback to content type header if header detection fails
      else {
        const contentType = audioResponse.headers.get('content-type');
        if (contentType) {
          if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3')) {
            actualFormat = 'mp3';
          } else if (contentType.includes('audio/opus')) {
            actualFormat = 'opus';
          } else if (contentType.includes('audio/aac')) {
            actualFormat = 'aac';
          } else if (contentType.includes('audio/flac')) {
            actualFormat = 'flac';
          } else if (contentType.includes('audio/wav') || contentType.includes('audio/wave') || contentType.includes('audio/x-wav')) {
            actualFormat = 'wav';
          } else if (contentType.includes('audio/pcm')) {
            actualFormat = 'pcm';
          }
          logger.debug({ contentType, actualFormat }, "Format detected from content-type header");
        }
        
        // Last resort: try to detect from URL extension
        if (actualFormat === format) {
          const supportedFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
          for (const fmt of supportedFormats) {
            if (audioUrl.toLowerCase().endsWith(`.${fmt}`)) {
              actualFormat = fmt;
              logger.debug({ actualFormat }, "Format detected from URL extension");
              break;
            }
          }
        }
      }
      
      logger.debug({ 
        text, 
        voice, 
        provider, 
        audioLength, 
        audioUrl, 
        format: actualFormat,
        contentType: audioResponse.headers.get('content-type')
      }, "Audio generated with TTS API");

      return {
        audio: audioBuffer,
        audioLength: audioLength,
        format: actualFormat
      };
    } catch (error) {
      logger.error({ error, text, voice, provider }, "Failed to generate audio with TTS API");
      
      // Check if this is a network error or service unavailable
      if (error instanceof Error &&
          (error.message.includes('Not Found') ||
           error.message.includes('fetch failed') ||
           error.message.includes('404'))) {
        throw new Error(`TTS service is unavailable. Please check if the TTS service at ${this.baseUrl} is running and accessible. Original error: ${error.message}`);
      }
      
      throw error;
    }
  }

  async getAvailableVoices(provider: TTSProvider): Promise<string[]> {
    try {
      // Use the correct endpoint structure: /voices/{provider}
      const voicesApiUrl = this.baseUrl.includes('/api') ? this.baseUrl : `${this.baseUrl}/api`;
      const response = await fetch(`${voicesApiUrl}/voices/${provider}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }
      
      const voices = await response.json();
      
      // If voices is an array of objects with 'name' property, extract just the names
      if (Array.isArray(voices) && voices.length > 0 && typeof voices[0] === 'object' && voices[0].name) {
        return voices.map(voice => voice.name as TTSVoice);
      }
      
      // If it's already an array of strings, return as is
      if (Array.isArray(voices)) {
        return voices;
      }
      
      // Fallback to default voices
      logger.warn({ provider, voices }, "Unexpected voice format, using default voices");
      return this.getDefaultVoices(provider);
    } catch (error) {
      logger.error({ error, provider }, "Failed to fetch available voices");
      // Return default voices as fallback
      return this.getDefaultVoices(provider);
    }
  }

  listAvailableVoices(): string[] {
    return Object.values(TTSVoice);
  }

  private getDefaultVoices(provider: TTSProvider): string[] {
    // Use hardcoded fallbacks based on the actual voice config files
    // The real voices will be fetched from the TTS API via getAvailableVoices()
    switch (provider) {
      case TTSProvider.Kokoro:
        // From kokoro_voices.json
        return ["af_heart", "af_alloy", "af_aoede"];
      case TTSProvider.Chatterbox:
        // From chatterbox-predefined-voices.json
        return [
          "Abigail.wav", "Adrian.wav", "Alexander.wav", "Alice.wav", "Austin.wav",
          "Axel.wav", "Connor.wav", "Cora.wav", "Elena.wav", "Eli.wav",
          "Emily.wav", "Everett.wav", "Gabriel.wav", "Gianna.wav", "Henry.wav",
          "Ian.wav", "Jade.wav", "Jeremiah.wav", "Jordan.wav", "Julian.wav",
          "Layla.wav", "Leonardo.wav", "Michael.wav", "Miles.wav", "Olivia.wav",
          "Ryan.wav", "Taylor.wav", "Thomas.wav"
        ];
      case TTSProvider.OpenAIEdge:
        // From openai_edge_tts_voices.json - but this should be expanded via the TTS API
        return ["alloy", "echo", "fable"];
      default:
        return ["af_heart"];
    }
  }
}
