import { Kokoro } from "./Kokoro";
import { ChatterboxTTS } from "./ChatterboxTTS";
import { OpenAIEdgeTTS } from "./OpenAIEdgeTTS";
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
    const dahopevi_url = process.env.DAHOPEVI_BASE_URL || process.env.DAHOPEVI_URL || 'https://api.dahopevi.com';
    const api_key = process.env.DAHOPEVI_API_KEY || '';

    switch (engine) {
      case TTSEngineEnum.kokoro:
        service = await Kokoro.init("fp32");
        break;
      
      case TTSEngineEnum.chatterbox:
        service = await ChatterboxTTS.init(api_key, dahopevi_url);
        break;
      
      case TTSEngineEnum.openai_edge_tts:
        service = await OpenAIEdgeTTS.init(api_key, dahopevi_url);
        break;

      default:
        throw new Error(`Unsupported TTS engine: ${engine}`);
    }

    // Cache the instance
    this.instances.set(engine, service);
    
    return service;
  }
}
