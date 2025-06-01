import { Voices } from "../../types/shorts";
import { logger } from "../../config";
import { TTSService } from "./TTSFactory";

// Declare process global for Node.js environment
declare const process: any;

export class OpenAIEdgeTTS implements TTSService {
  private cachedVoices: string[] = [
    // OpenAI-style voices (for compatibility)
    "alloy",
    "echo",
    "fable",
    "onyx",
    "nova",
    "shimmer",
    
    // English (US) - Male & Female
    "en-US-AriaNeural",      // Female
    "en-US-JennyNeural",     // Female
    "en-US-GuyNeural",       // Male
    "en-US-DavisNeural",     // Male
    "en-US-AmberNeural",     // Female
    "en-US-AnaNeural",       // Female (Child)
    "en-US-ChristopherNeural", // Male
    "en-US-EricNeural",      // Male
    "en-US-EmmaNeural",      // Female
    "en-US-BrianNeural",     // Male
    
    // English (UK) - Male & Female
    "en-GB-SoniaNeural",     // Female
    "en-GB-RyanNeural",      // Male
    "en-GB-LibbyNeural",     // Female
    "en-GB-AbbiNeural",      // Female
    "en-GB-AlfieNeural",     // Male
    "en-GB-BellaNeural",     // Female
    
    // English (Australia) - Male & Female
    "en-AU-NatashaNeural",   // Female
    "en-AU-WilliamNeural",   // Male
    "en-AU-AnnetteNeural",   // Female
    "en-AU-CarlyNeural",     // Female
    "en-AU-DarrenNeural",    // Male
    "en-AU-DuncanNeural",    // Male
    
    // English (Canada) - Male & Female
    "en-CA-ClaraNeural",     // Female
    "en-CA-LiamNeural",      // Male
    "en-CA-ClaraNeural",     // Female
    
    // French (France) - Male & Female
    "fr-FR-DeniseNeural",    // Female
    "fr-FR-HenriNeural",     // Male
    "fr-FR-JeromeNeural",    // Male
    "fr-FR-JosephineNeural", // Female
    "fr-FR-BrigitteNeural",  // Female
    "fr-FR-AlainNeural",     // Male
    
    // French (Canada) - Male & Female
    "fr-CA-SylvieNeural",    // Female
    "fr-CA-JeanNeural",      // Male
    "fr-CA-AntoineNeural",   // Male
    
    // Spanish (Spain) - Male & Female
    "es-ES-ElviraNeural",    // Female
    "es-ES-AlvaroNeural",    // Male
    "es-ES-AbrilNeural",     // Female
    "es-ES-ArnauNeural",     // Male
    "es-ES-DarioNeural",     // Male
    "es-ES-EliasNeural",     // Male
    
    // Spanish (Mexico) - Male & Female
    "es-MX-DaliaNeural",     // Female
    "es-MX-JorgeNeural",     // Male
    "es-MX-CandelaNeural",   // Female
    "es-MX-CecilioNeural",   // Male
    
    // German (Germany) - Male & Female
    "de-DE-KatjaNeural",     // Female
    "de-DE-ConradNeural",    // Male
    "de-DE-AmalaNeural",     // Female
    "de-DE-BerndNeural",     // Male
    "de-DE-ChristelNeural",  // Female
    "de-DE-GiselaNeural",    // Female
    
    // German (Austria) - Male & Female
    "de-AT-IngridNeural",    // Female
    "de-AT-JonasNeural",     // Male
    
    // Italian - Male & Female
    "it-IT-ElsaNeural",      // Female
    "it-IT-IsabellaNeural",  // Female
    "it-IT-DiegoNeural",     // Male
    "it-IT-BenignoNeural",   // Male
    "it-IT-CalimeroNeural",  // Male
    "it-IT-CataldoNeural",   // Male
    
    // Portuguese (Brazil) - Male & Female
    "pt-BR-FranciscaNeural", // Female
    "pt-BR-AntonioNeural",   // Male
    "pt-BR-BrendaNeural",    // Female
    "pt-BR-DonatoNeural",    // Male
    "pt-BR-ElzaNeural",      // Female
    "pt-BR-FabioNeural",     // Male
    
    // Portuguese (Portugal) - Male & Female
    "pt-PT-RaquelNeural",    // Female
    "pt-PT-DuarteNeural",    // Male
    "pt-PT-FernandaNeural",  // Female
    
    // Japanese - Male & Female
    "ja-JP-NanamiNeural",    // Female
    "ja-JP-KeitaNeural",     // Male
    "ja-JP-AoiNeural",       // Female
    "ja-JP-DaichiNeural",    // Male
    "ja-JP-MayuNeural",      // Female
    "ja-JP-NaokiNeural",     // Male
    
    // Chinese (Simplified) - Male & Female
    "zh-CN-XiaoxiaoNeural", // Female
    "zh-CN-YunxiNeural",    // Male
    "zh-CN-YunyangNeural",  // Male
    "zh-CN-XiaochenNeural", // Female
    "zh-CN-XiaohanNeural",  // Female
    "zh-CN-XiaomengNeural", // Female
    
    // Chinese (Traditional - Taiwan) - Male & Female
    "zh-TW-HsiaoChenNeural", // Female
    "zh-TW-YunJheNeural",    // Male
    "zh-TW-HsiaoYuNeural",   // Female
    
    // Korean - Male & Female
    "ko-KR-SunHiNeural",     // Female
    "ko-KR-InJoonNeural",    // Male
    "ko-KR-BongJinNeural",   // Male
    "ko-KR-GookMinNeural",   // Male
    
    // Russian - Male & Female
    "ru-RU-SvetlanaNeural",  // Female
    "ru-RU-DmitryNeural",    // Male
    "ru-RU-DariyaNeural",    // Female
    
    // Arabic (Saudi Arabia) - Male & Female
    "ar-SA-ZariyahNeural",   // Female
    "ar-SA-HamedNeural",     // Male
    
    // Arabic (Egypt) - Male & Female
    "ar-EG-SalmaNeural",     // Female
    "ar-EG-ShakirNeural",    // Male
    
    // Hindi (India) - Male & Female
    "hi-IN-SwaraNeural",     // Female
    "hi-IN-MadhurNeural",    // Male
    "hi-IN-MadhurNeural",    // Male
    
    // Dutch (Netherlands) - Male & Female
    "nl-NL-ColetteNeural",   // Female
    "nl-NL-MaartenNeural",   // Male
    "nl-NL-FennaNeural",     // Female
    
    // Swedish - Male & Female
    "sv-SE-SofieNeural",     // Female
    "sv-SE-MattiasNeural",   // Male
    "sv-SE-HilleviNeural",   // Female
    
    // Norwegian - Male & Female
    "nb-NO-IselinNeural",    // Female
    "nb-NO-FinnNeural",      // Male
    "nb-NO-PernilleNeural",  // Female
    
    // Danish - Male & Female
    "da-DK-ChristelNeural",  // Female
    "da-DK-JeppeNeural",     // Male
    
    // Finnish - Male & Female
    "fi-FI-NooraNeural",     // Female
    "fi-FI-HarriNeural",     // Male
    "fi-FI-SelmaNeural",     // Female
  ];

  constructor() {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      logger.debug({ text, voice }, "Generating audio with OpenAI Edge TTS");

      // Validate voice
      const selectedVoice = this.validateVoice(voice);
      
      // Call the local Python OpenAI Edge TTS service
      const audioBuffer = await this.callLocalTTSService(text, selectedVoice);
      
      // Estimate audio duration (rough estimation based on text length)
      // This is a conservative estimate - actual duration will be determined by audio processing
      const estimatedDuration = this.estimateAudioDuration(text);
      
      logger.debug({ 
        text, 
        voice: selectedVoice, 
        audioLength: `${estimatedDuration}s (estimated)`,
        fileSize: `${audioBuffer.byteLength} bytes`
      }, "Audio generated with OpenAI Edge TTS");

      return {
        audio: audioBuffer,
        audioLength: estimatedDuration,
      };
    } catch (error) {
      logger.error("Error generating audio with OpenAI Edge TTS:", error);
      throw error;
    }
  }

  private validateVoice(voice: Voices): string {
    logger.debug({ voice, availableVoices: this.cachedVoices.length }, "Validating voice");
    
    // If voice is already a valid voice (including all Edge TTS voices), use it
    if (this.cachedVoices.includes(voice)) {
      logger.debug({ voice }, "Voice found in cached voices");
      return voice;
    }

    // Legacy OpenAI voice mappings for compatibility
    const voiceMappings: Record<string, string> = {
      "alloy": "en-US-AriaNeural",
      "echo": "en-US-GuyNeural",
      "fable": "en-US-JennyNeural",
      "onyx": "en-US-ChristopherNeural",
      "nova": "en-US-EmmaNeural",
      "shimmer": "en-US-MichelleNeural"
    };

    // Check if we have a mapping for this voice
    if (voiceMappings[voice]) {
      logger.debug({ voice, mappedVoice: voiceMappings[voice] }, "Found voice mapping");
      return voiceMappings[voice];
    }

    // If it's a direct Edge TTS voice name, use it as-is
    // This allows users to specify voices like "en-US-AriaNeural" directly
    if (voice.includes("-") && voice.includes("Neural")) {
      logger.debug({ voice }, "Using direct Edge TTS voice");
      return voice;
    }

    // Default fallback
    logger.warn({ voice, availableVoices: this.cachedVoices.slice(0, 10) }, "Unknown voice, using default 'en-US-AriaNeural'");
    return "en-US-AriaNeural";
  }

  private async callLocalTTSService(text: string, voice: string, retries: number = 3): Promise<ArrayBuffer> {
    // Get the TTS service URL from environment or use default
    // In Docker, use the service name 'edge-tts', otherwise fall back to localhost
    const ttsServiceUrl = process.env?.OPENAI_EDGE_TTS_URL ||
                         (process.env?.DOCKER === 'true' ? 'http://edge-tts:5050' : 'http://localhost:5050');
    const apiKey = process.env?.DAHOPEVI_API_KEY || process.env?.API_KEY || 'your-api-key';
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug({ ttsServiceUrl, voice, attempt, retries }, "Calling local OpenAI Edge TTS service");
        
        const response = await fetch(`${ttsServiceUrl}/v1/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: text,
            voice: voice,
            response_format: 'mp3',
            speed: 1.0,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout for TTS generation
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`TTS service responded with ${response.status}: ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        logger.debug({ audioSize: audioBuffer.byteLength, attempt }, "Audio generated successfully");
        
        return audioBuffer;
        
      } catch (error) {
        logger.warn({
          error: error instanceof Error ? error.message : String(error),
          ttsServiceUrl,
          voice,
          textLength: text.length,
          attempt,
          retries
        }, "Error calling local TTS service");
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          logger.debug({ waitTime, attempt }, "Waiting before TTS retry");
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Final attempt failed, throw error
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Unable to connect to TTS service at ${ttsServiceUrl}. Please ensure the OpenAI Edge TTS service is running and accessible.`);
          }
          throw error;
        }
      }
    }
    
    throw new Error('TTS service call failed after all retries');
  }

  private async convertToArrayBuffer(audioData: any): Promise<ArrayBuffer> {
    try {
      // Handle different types of audio data that openai-edge-tts might return
      if (audioData instanceof ArrayBuffer) {
        return audioData;
      }
      
      if (audioData instanceof Uint8Array) {
        return audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      }
      
      // Check for Node.js Buffer type without importing it
      if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer && audioData instanceof (globalThis as any).Buffer) {
        return audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      }
      
      // If it's a readable stream or response, read it
      if (audioData && typeof audioData.arrayBuffer === 'function') {
        return await audioData.arrayBuffer();
      }
      
      // If it's a response-like object with a blob method
      if (audioData && typeof audioData.blob === 'function') {
        const blob = await audioData.blob();
        return await blob.arrayBuffer();
      }
      
      // If it's already array buffer-like
      if (audioData && audioData.buffer) {
        return audioData.buffer;
      }
      
      throw new Error('Unsupported audio data format');
    } catch (error) {
      logger.error("Error converting audio data to ArrayBuffer:", error);
      throw error;
    }
  }

  private estimateAudioDuration(text: string): number {
    // Rough estimation: average speaking speed is about 150-160 words per minute
    // This translates to about 2.5-2.7 words per second
    const words = text.split(/\s+/).length;
    const estimatedSeconds = words / 2.6; // Conservative estimate
    
    // Add some buffer time and ensure minimum duration
    return Math.max(1, Math.ceil(estimatedSeconds * 1.1));
  }

  listAvailableVoices(): string[] {
    return [...this.cachedVoices];
  }

  async testConnection(retries: number = 3): Promise<boolean> {
    const ttsServiceUrl = process.env?.OPENAI_EDGE_TTS_URL ||
                         (process.env?.DOCKER === 'true' ? 'http://edge-tts:5050' : 'http://localhost:5050');
    const apiKey = process.env?.DAHOPEVI_API_KEY || process.env?.API_KEY || 'your-api-key';
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug({ ttsServiceUrl, attempt, retries }, "Testing TTS service connection");
        
        const response = await fetch(`${ttsServiceUrl}/v1/voices`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (response.ok) {
          logger.info({ ttsServiceUrl, attempt }, "TTS service connection successful");
          return true;
        } else {
          logger.warn({
            ttsServiceUrl,
            attempt,
            status: response.status,
            statusText: response.statusText
          }, "TTS service connection failed");
        }
      } catch (error) {
        logger.warn({
          ttsServiceUrl,
          attempt,
          retries,
          error: error instanceof Error ? error.message : String(error)
        }, "TTS service connection test failed");
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.debug({ waitTime }, "Waiting before retry");
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    return false;
  }

  static async init(): Promise<OpenAIEdgeTTS> {
    const instance = new OpenAIEdgeTTS();
    
    // Test connection to TTS service
    const connectionTest = await instance.testConnection();
    if (!connectionTest) {
      logger.warn("OpenAI Edge TTS service connection test failed, but proceeding with initialization");
    }
    
    logger.info("OpenAI Edge TTS service initialized successfully");
    return instance;
  }
}