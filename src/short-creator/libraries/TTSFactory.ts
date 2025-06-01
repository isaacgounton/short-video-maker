
import { OpenAIEdgeTTS } from "./OpenAIEdgeTTS";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";


export interface TTSService {
  generate(text: string, voice: Voices): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }>;
  listAvailableVoices(): string[];
}

export class TTSFactory {
  private static instance: TTSService | null = null;

  static async getTTSService(engine: string): Promise<TTSService> {
    // Return cached instance if available
    if (this.instance) {
      return this.instance;
    }

    logger.debug("Initializing OpenAI Edge TTS service");

    // Only supporting OpenAI Edge TTS now
    this.instance = await OpenAIEdgeTTS.init();
    
    logger.info("OpenAI Edge TTS service initialized successfully");
    return this.instance;
  }

  static async getAllAvailableVoices(): Promise<Record<string, string[]>> {
    try {
      // Only one engine now, so simply get its voices
      const service = await this.getTTSService('openai-edge-tts');
      return {
        'openai-edge-tts': await service.listAvailableVoices()
      };
    } catch (error) {
      logger.warn({ error }, "Failed to get voices for OpenAI Edge TTS");
      return { 'openai-edge-tts': [] };
    }
  }

  static clearCache(): void {
    this.instance = null;
  }
}
