import { Kokoro } from "./Kokoro";
import { EdgeTTS } from "./EdgeTTS";
import { StreamlabsPolly } from "./StreamlabsPolly";
import { TTSEngineEnum, Voices } from "../../types/shorts";
import { logger } from "../../config";

declare const process: {
  env: {
    DAHOPEVI_BASE_URL?: string;
    DAHOPEVI_URL?: string;
    DAHOPEVI_API_KEY?: string;
    [key: string]: string | undefined;
  };
};

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
      
      case TTSEngineEnum.edgetts:
        const dahopevi_url = process.env.DAHOPEVI_BASE_URL || process.env.DAHOPEVI_URL || 'https://api.dahopevi.com';
        const api_key = process.env.DAHOPEVI_API_KEY || '';
        service = await EdgeTTS.init(api_key, dahopevi_url);
        // Force an initial voices fetch to ensure we have the most up-to-date list
        await (service as EdgeTTS).getAvailableVoicesFromAPI().catch(err => {
          logger.warn("Could not fetch initial voices list, will retry later:", err);
        });
        break;
      
      case TTSEngineEnum.streamlabspolly:
        service = await StreamlabsPolly.init();
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
