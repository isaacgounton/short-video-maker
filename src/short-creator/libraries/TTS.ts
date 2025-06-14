import { logger } from "../../config";
import { TTSProvider, TTSVoice } from "../../types/shorts";

export class TTS {
  private baseUrl: string;

  constructor(baseUrl: string = "https://tts.dahopevi.com") {
    // Ensure the baseUrl ends properly - remove trailing /api if present, we'll add endpoints as needed
    this.baseUrl = baseUrl.replace(/\/api\/?$/, "");
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

      // Check for audio_url in the new format
      let audioUrl = result.audio_url;
      
      // For backward compatibility
      if (!audioUrl) {
        const audioId = result.id || result.audio_id;
        if (!audioId) {
          throw new Error('No audio URL or ID returned from TTS service');
        }
        audioUrl = `/audio/${audioId}`;
      }
      
      // Make sure audioUrl is an absolute URL
      const audioFullUrl = audioUrl.startsWith('http') 
        ? audioUrl 
        : `${this.baseUrl}${audioUrl}`;
      
      logger.debug({ audioUrl, audioFullUrl }, "Requesting audio from URL");
      
      const audioResponse = await fetch(audioFullUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Use the duration from the API response or estimate
      const audioLength = result.duration_ms ? result.duration_ms / 1000 :
                         result.duration ? result.duration / 1000 : // Convert ms to seconds if needed
                         text.split(" ").length * 0.3;

      logger.debug({ text, voice, provider, audioLength, audioUrl }, "Audio generated with TTS API");

      return {
        audio: audioBuffer,
        audioLength: audioLength,
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
