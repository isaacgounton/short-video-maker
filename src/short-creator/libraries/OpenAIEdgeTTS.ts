import axios from "axios";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";

interface EdgeTTSResponse {
  response: {
    audio_url: string;
    subtitle_url: string;
    duration?: number;
  };
}

interface DahopeviResponse {
  audio_url: string;
  subtitle_url: string;
  duration?: number;
}

export class OpenAIEdgeTTS {
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
          tts: "openai-edge-tts", // Using openai-edge-tts engine in Dahopevi
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      // Handle both response formats: dahopevi direct and wrapped responses
      const responseData = response.data as DahopeviResponse | EdgeTTSResponse;
      
      let audio_url: string;
      let duration: number | undefined;
      
      // Check if it's the wrapped format (EdgeTTSResponse)
      if ('response' in responseData) {
        audio_url = responseData.response.audio_url;
        duration = responseData.response.duration;
      } else {
        // Direct format (DahopeviResponse)
        audio_url = responseData.audio_url;
        duration = responseData.duration;
      }
      
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
      }, "Audio generated with OpenAI Edge TTS via Dahopevi");

      return {
        audio: audioBuffer,
        audioLength,
      };
    } catch (error) {
      logger.error("Error generating audio with OpenAI Edge TTS via Dahopevi:", error);
      throw error;
    }
  }

  getFallbackVoices(): string[] {
    return [
      // OpenAI TTS-1 voices
      "alloy",
      "echo", 
      "fable",
      "onyx",
      "nova",
      "shimmer",
      
      // If your service also supports Edge TTS voices, include them as fallback
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
      "fr-CA-AntoineNeural",
      "fr-CA-SylvieNeural",
      
      // Spanish voices
      "es-ES-ElviraNeural",
      "es-ES-AlvaroNeural",
      "es-MX-DaliaNeural",
      "es-MX-JorgeNeural",
      
      // German voices
      "de-DE-KatjaNeural",
      "de-DE-ConradNeural",
      
      // Italian voices
      "it-IT-ElsaNeural",
      "it-IT-DiegoNeural",
      
      // Portuguese voices
      "pt-BR-FranciscaNeural",
      "pt-BR-AntonioNeural",
      
      // Japanese voices
      "ja-JP-NanamiNeural",
      "ja-JP-KeitaNeural",
      
      // Chinese voices
      "zh-CN-XiaoxiaoNeural",
      "zh-CN-YunxiNeural",
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
      
      // Handle both response formats: direct voices array or wrapped in response
      const voices = response.data?.voices || response.data?.response?.voices || [];
      const openaiEdgeVoices = voices.filter((voice: { engine?: string }) => voice?.engine === "openai-edge-tts");
      
      if (!openaiEdgeVoices.length) {
        logger.warn("No openai-edge-tts voices found in API response, using fallback voices");
        return this.getFallbackVoices();
      }
      
      const voiceNames = openaiEdgeVoices.map((voice: { name?: string }) => voice?.name).filter(Boolean);
      logger.info(`Fetched ${voiceNames.length} OpenAI Edge TTS voices from API`);
      return voiceNames;
    } catch (error) {
      logger.error("Error fetching voices from Dahopevi (using fallback voices):", error);
      return this.getFallbackVoices(); // Always return fallback voices on error
    }
  }

  static async init(apiKey: string, baseUrl: string): Promise<OpenAIEdgeTTS> {
    const instance = new OpenAIEdgeTTS(apiKey, baseUrl);
    
    try {
      logger.info({ baseUrl }, "Initializing OpenAI Edge TTS service");
      
      // Pre-fetch and cache voices during initialization with timeout
      const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout during voice fetching")), 3000);
      });
      
      const voicesPromise = instance.getAvailableVoicesFromAPI();
      const voices = await Promise.race([voicesPromise, timeoutPromise]);
      
      instance.cachedVoices = voices;
      logger.info({ 
        voiceCount: voices.length,
        baseUrl 
      }, "OpenAI Edge TTS service initialized successfully");
    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        baseUrl 
      }, "Failed to fetch voices during initialization, using fallback voices");
      instance.cachedVoices = instance.getFallbackVoices();
    }
    
    return instance;
  }
}
