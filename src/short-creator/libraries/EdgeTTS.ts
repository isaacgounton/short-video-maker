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

      // Download the audio file
      const audioResponse = await axios.get(response.data.response.audio_url, {
        responseType: "arraybuffer",
      });

      // Get audio duration - use a simple estimation based on file size and bitrate
      // For more accurate duration, we'll let the downstream audio processing handle it
      const audioBuffer = audioResponse.data;
      
      // Rough estimation: assuming 128kbps MP3, 1 second ≈ 16KB
      // This is a fallback - the actual duration will be calculated by FFmpeg later
      const estimatedDuration = audioBuffer.byteLength / (128 * 1024 / 8); // seconds
      const audioLength = Math.max(1, estimatedDuration); // minimum 1 second
      
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
      });
      
      const voices = response.data?.response?.voices || [];
      const edgeVoices = voices.filter((voice: { engine?: string }) => voice?.engine === "edge-tts");
      
      if (!edgeVoices.length) {
        logger.warn("No edge-tts voices found in API response");
        return this.getFallbackVoices();
      }
      
      return edgeVoices.map((voice: { name?: string }) => voice?.name).filter(Boolean);
    } catch (error) {
      logger.error("Error fetching voices from Dahopevi:", error);
      return this.listAvailableVoices(); // fallback to static list
    }
  }

  static async init(apiKey: string, baseUrl: string): Promise<EdgeTTS> {
    const instance = new EdgeTTS(apiKey, baseUrl);
    try {
      // Pre-fetch and cache voices during initialization
      const voices = await instance.getAvailableVoicesFromAPI();
      instance.cachedVoices = voices;
      logger.info(`Cached ${voices.length} EdgeTTS voices from dahopevi API`);
    } catch (error) {
      logger.warn("Failed to fetch voices from API during initialization, will use fallback list until next API call succeeds");
      instance.cachedVoices = instance.getFallbackVoices();
    }
    return instance;
  }
}
