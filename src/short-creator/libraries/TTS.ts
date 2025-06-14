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
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
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

      // Determine actual format from URL or content type
      let actualFormat = format; // Default to the requested format
      
      // Try to detect format from URL
      const supportedFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
      
      for (const fmt of supportedFormats) {
        if (audioUrl.toLowerCase().endsWith(`.${fmt}`)) {
          actualFormat = fmt;
          break;
        }
      }
      
      // Check content type header from response if available
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
      }
      
      logger.debug({ 
        text, 
        voice, 
        provider, 
        audioLength, 
        audioUrl, 
        format: actualFormat,
        contentType 
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
    switch (provider) {
      case TTSProvider.Kokoro:
        return [
          TTSVoice.af_heart,
          TTSVoice.af_alloy,
          TTSVoice.af_bella,
          TTSVoice.am_adam,
          TTSVoice.am_echo,
        ];
      case TTSProvider.Chatterbox:
        return [
          TTSVoice.Rachel,  // These are example voices
          TTSVoice.Bella,
          TTSVoice.Josh,
        ];
      case TTSProvider.OpenAIEdge:
        return [
          TTSVoice.enUSJenny,
          TTSVoice.enUSGuy,
          TTSVoice.enGBSonia,
        ];
      default:
        return Object.values(TTSVoice);
    }
  }
}
