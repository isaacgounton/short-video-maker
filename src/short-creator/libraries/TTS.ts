import { logger } from "../../config";
import { TTSProvider, TTSVoice } from "../../types/shorts";

export class TTS {
  private baseUrl: string;

  constructor(baseUrl: string = "https://tts.dahopevi.com") {
    this.baseUrl = baseUrl;
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
      const response = await fetch(`${this.baseUrl}/api/tts`, {
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
        throw new Error(`TTS API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`TTS API error: ${result.error}`);
      }

      // Download the audio file
      const audioResponse = await fetch(`${this.baseUrl}${result.audio_url}`);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Use the duration from the API response
      const audioLength = result.duration_ms ? result.duration_ms / 1000 : text.split(" ").length * 0.3;

      logger.debug({ text, voice, provider, audioLength }, "Audio generated with Awesome-TTS API");

      return {
        audio: audioBuffer,
        audioLength: audioLength,
      };
    } catch (error) {
      logger.error({ error, text, voice, provider }, "Failed to generate audio with TTS API");
      throw error;
    }
  }

  async getAvailableVoices(provider: TTSProvider): Promise<TTSVoice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/voices/${provider}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }
      
      const voices = await response.json();
      return voices;
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
