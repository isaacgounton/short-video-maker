import { logger } from "../../config";
import { TTSProvider, TTSVoice } from "../../types/shorts";

export class TTS {
  private baseUrl: string;

  constructor(baseUrl: string = "https://tts.dahopevi.com") {
    // Remove /api if it's already included in the base URL
    this.baseUrl = baseUrl.replace(/\/api\/?$/, "");
  }

  async generate(
    text: string,
    voice: TTSVoice,
    provider: TTSProvider,
    speed: number = 1.0,
    format: string = "wav"
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/tts`, {
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

      const result = await response.json();
      
      if (!result.success && !result.id) {
        throw new Error(`TTS API error: ${result.error || 'Unknown error'}`);
      }

      // Download the audio file using the correct endpoint structure
      const audioId = result.id || result.audio_id;
      if (!audioId) {
        throw new Error('No audio ID returned from TTS service');
      }
      
      const audioResponse = await fetch(`${this.baseUrl}/audio/${audioId}`);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Use the duration from the API response or estimate
      const audioLength = result.duration_ms ? result.duration_ms / 1000 :
                         result.duration ? result.duration :
                         text.split(" ").length * 0.3;

      logger.debug({ text, voice, provider, audioLength }, "Audio generated with Awesome-TTS API");

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

  async getAvailableVoices(provider: TTSProvider): Promise<TTSVoice[]> {
    try {
      // Use the correct endpoint structure: /voices/{provider}
      const response = await fetch(`${this.baseUrl}/voices/${provider}`);
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

  listAvailableVoices(): TTSVoice[] {
    return Object.values(TTSVoice);
  }

  private getDefaultVoices(provider: TTSProvider): TTSVoice[] {
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
