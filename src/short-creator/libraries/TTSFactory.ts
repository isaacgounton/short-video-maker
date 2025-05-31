import { Kokoro } from "./Kokoro";
import { OpenAIEdgeTTS } from "./OpenAIEdgeTTS";
import { TTSEngineEnum, Voices } from "../../types/shorts";
import { logger } from "../../config";


export interface TTSService {
  generate(text: string, voice: Voices): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }>;
  listAvailableVoices(): string[];
}

export class TTSFactory {
  private static instances: Map<TTSEngineEnum, TTSService> = new Map();

  static async getTTSService(engine: TTSEngineEnum): Promise<TTSService> {
    // Return cached instance if available
    if (this.instances.has(engine)) {
      return this.instances.get(engine)!;
    }

    logger.debug({ engine }, "Initializing TTS service");

    let service: TTSService;

    switch (engine) {
      case TTSEngineEnum.kokoro:
        service = await Kokoro.init("fp32");
        break;
      
      case TTSEngineEnum.openaiEdgeTTS:
        service = await OpenAIEdgeTTS.init();
        break;
      
      default:
        throw new Error(`Unsupported TTS engine: ${engine}`);
    }

    // Cache the instance
    this.instances.set(engine, service);
    
    logger.info({ engine }, "TTS service initialized successfully");
    return service;
  }

  static async getAllAvailableVoices(): Promise<Record<TTSEngineEnum, string[]>> {
    const voices: Record<string, string[]> = {};
    
    for (const engine of Object.values(TTSEngineEnum)) {
      try {
        const service = await this.getTTSService(engine);
        voices[engine] = service.listAvailableVoices();
      } catch (error) {
        logger.warn({ engine, error }, "Failed to get voices for TTS engine");
        voices[engine] = [];
      }
    }
    
    return voices as Record<TTSEngineEnum, string[]>;
  }

  static clearCache(): void {
    this.instances.clear();
  }
}
