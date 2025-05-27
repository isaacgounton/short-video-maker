import axios from "axios";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";

interface EdgeTTSResponse {
  response: {
    audio_url: string;
    subtitle_url: string;
  };
}

export class EdgeTTS {
  private cachedVoices: string[] | null = null;

  constructor(private apiKey: string, private baseUrl: string) {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      const response = await axios.post<EdgeTTSResponse>(
        `${this.baseUrl}/v1/audio/speech`,
        {
          text,
          voice,
          tts: "edge-tts", // Using edge-tts as default since it supports most features
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      // Handle response format correctly - dahopevi returns data directly
      const responseData = response.data;
      const audio_url = responseData.audio_url;
      const duration = responseData.duration;
      
      if (!audio_url) {
        throw new Error(`No audio_url found in response: ${JSON.stringify(responseData)}`);
      }

      // Download the audio file
      const audioResponse = await axios.get(audio_url, {
        responseType: "arraybuffer",
      });

      // Get audio duration from API response or estimate
      const audioBuffer = audioResponse.data;
      
      // Use duration from API response if available, otherwise use conservative estimate
      let audioLength: number;
      if (duration && typeof duration === 'number') {
        audioLength = duration;
      } else {
        // Conservative fallback - will be corrected by FFmpeg processing
        audioLength = 10; // Conservative placeholder
      }
      
      logger.debug({ 
        text, 
        voice, 
        audioLength: `${audioLength}s (estimated)`,
        fileSize: `${audioBuffer.byteLength} bytes`
      }, "Audio generated with Dahopevi");

      return {
        audio: audioBuffer,
        audioLength,
      };
    } catch (error) {
      logger.error("Error generating audio with Dahopevi:", error);
      throw error;
    }
  }

  getFallbackVoices(): string[] {
    return [
      // English voices
      "en-US-AriaNeural",
      "en-US-JennyNeural", 
      "en-US-GuyNeural",
      "en-US-AnaNeural",
      "en-US-ChristopherNeural",
      "en-US-EricNeural",
      "en-US-MichelleNeural",
      "en-US-RogerNeural",
      "en-US-SteffanNeural",
      "en-GB-SoniaNeural",
      "en-GB-RyanNeural",
      "en-GB-LibbyNeural",
      "en-AU-NatashaNeural",
      "en-AU-WilliamNeural",
      "en-CA-ClaraNeural",
      
      // French voices
      "fr-FR-DeniseNeural",
      "fr-FR-HenriNeural",
      "fr-FR-JeromeNeural",
      "fr-FR-JosephineNeural",
      "fr-CA-AntoineNeural",
      "fr-CA-JeanNeural",
      "fr-CA-SylvieNeural",
      
      // Spanish voices
      "es-ES-ElviraNeural",
      "es-ES-AlvaroNeural",
      "es-MX-DaliaNeural",
      "es-MX-JorgeNeural",
      
      // German voices
      "de-DE-KatjaNeural",
      "de-DE-ConradNeural",
      "de-AT-IngridNeural",
      "de-AT-JonasNeural",
      
      // Italian voices
      "it-IT-ElsaNeural",
      "it-IT-IsabellaNeural",
      "it-IT-DiegoNeural",
      
      // Portuguese voices
      "pt-BR-FranciscaNeural",
      "pt-BR-AntonioNeural",
      "pt-PT-RaquelNeural",
      "pt-PT-DuarteNeural",
      
      // Japanese voices
      "ja-JP-NanamiNeural",
      "ja-JP-KeitaNeural",
      "ja-JP-AoiNeural",
      
      // Chinese voices
      "zh-CN-XiaoxiaoNeural",
      "zh-CN-YunxiNeural",
      "zh-CN-YunyangNeural",
      "zh-TW-HsiaoChenNeural",
      "zh-TW-YunJheNeural",
      
      // Arabic voices
      "ar-SA-ZariyahNeural",
      "ar-SA-HamedNeural",
      "ar-EG-ShakirNeural",
      "ar-EG-SalmaNeural",
    ];
  }

  listAvailableVoices(): string[] {
    return this.cachedVoices && this.cachedVoices.length > 0 
      ? this.cachedVoices 
      : this.getFallbackVoices();
  }

  async getAvailableVoicesFromAPI(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/v1/audio/speech/voices`, {
        headers,
        timeout: 5000, // 5 second timeout
      });
      
      const voices = response.data?.response?.voices || [];
      const edgeVoices = voices.filter((voice: { engine?: string }) => voice?.engine === "edge-tts");
      
      if (!edgeVoices.length) {
        logger.warn("No edge-tts voices found in API response, using fallback voices");
        return this.getFallbackVoices();
      }
      
      return edgeVoices.map((voice: { name?: string }) => voice?.name).filter(Boolean);
    } catch (error) {
      logger.error("Error fetching voices from Dahopevi (using fallback voices):", error);
      return this.getFallbackVoices(); // Always return fallback voices on error
    }
  }

  static async init(apiKey: string, baseUrl: string): Promise<EdgeTTS> {
    const instance = new EdgeTTS(apiKey, baseUrl);
    try {
      // Pre-fetch and cache voices during initialization with timeout
      const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout during initialization")), 3000);
      });
      
      const voicesPromise = instance.getAvailableVoicesFromAPI();
      const voices = await Promise.race([voicesPromise, timeoutPromise]);
      
      instance.cachedVoices = voices;
      logger.info(`Cached ${voices.length} EdgeTTS voices from dahopevi API`);
    } catch (error) {
      logger.warn("Failed to fetch voices from API during initialization, using fallback voices");
      instance.cachedVoices = instance.getFallbackVoices();
    }
    return instance;
  }
}
