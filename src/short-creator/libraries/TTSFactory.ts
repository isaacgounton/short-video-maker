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
    
    // Use Promise.allSettled to handle timeouts gracefully
    const voicePromises = Object.values(TTSEngineEnum).map(async (engine) => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Voice fetching timeout')), 8000);
        });
        
        const servicePromise = this.getTTSService(engine).then(service =>
          service.listAvailableVoices()
        );
        
        const voiceList = await Promise.race([servicePromise, timeoutPromise]);
        return { engine, voices: voiceList };
      } catch (error) {
        logger.warn({ engine, error }, "Failed to get voices for TTS engine");
        return { engine, voices: [] };
      }
    });
    
    const results = await Promise.allSettled(voicePromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        voices[result.value.engine] = result.value.voices;
      } else {
        // Find which engine failed and set empty array
        const failedEngine = Object.values(TTSEngineEnum).find(
          engine => !voices.hasOwnProperty(engine)
        );
        if (failedEngine) {
          voices[failedEngine] = [];
        }
      }
    });
    
    return voices as Record<TTSEngineEnum, string[]>;
  }

  static clearCache(): void {
    this.instances.clear();
  }
}
