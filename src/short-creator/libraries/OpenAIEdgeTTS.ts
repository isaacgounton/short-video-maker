import axios from "axios";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";

interface OpenAIEdgeTTSResponse {
  audio_url: string;
  subtitle_url?: string;
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
      logger.debug({ text, voice, baseUrl: this.baseUrl }, "Generating audio with OpenAI Edge TTS");
      
      const response = await axios.post<OpenAIEdgeTTSResponse>(
        `${this.baseUrl}/v1/audio/speech`,
        {
          text,
          voice,
          model: "tts-1", // OpenAI TTS model
          response_format: "mp3"
        },
        {
          headers: {
            "Authorization": this.apiKey ? `Bearer ${this.apiKey}` : undefined,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout for TTS generation
        }
      );

      const responseData = response.data;
      
      if (!responseData.audio_url) {
        throw new Error(`No audio_url found in response: ${JSON.stringify(responseData)}`);
      }

      // Download the audio file
      logger.debug({ audio_url: responseData.audio_url }, "Downloading generated audio file");
      
      const audioResponse = await axios.get(responseData.audio_url, {
        responseType: "arraybuffer",
        timeout: 15000, // 15 second timeout for download
      });

      const audioBuffer = audioResponse.data;
      
      // Use duration from API response if available, otherwise estimate
      let audioLength: number;
      if (responseData.duration && typeof responseData.duration === 'number') {
        audioLength = responseData.duration;
      } else {
        // Estimate duration based on text length (rough approximation: 150 words per minute)
        const wordCount = text.split(/\s+/).length;
        audioLength = Math.max(1, Math.ceil((wordCount / 150) * 60));
      }
      
      logger.info({ 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voice, 
        audioLength: `${audioLength}s`,
        fileSize: `${audioBuffer.byteLength} bytes`
      }, "Audio generated successfully with OpenAI Edge TTS");

      return {
        audio: audioBuffer,
        audioLength,
      };
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voice,
        baseUrl: this.baseUrl
      }, "Error generating audio with OpenAI Edge TTS");
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      logger.debug({ baseUrl: this.baseUrl }, "Fetching available voices from OpenAI Edge TTS API");

      const response = await axios.get(`${this.baseUrl}/v1/voices`, {
        headers,
        timeout: 5000, // 5 second timeout
      });
      
      // Log the raw response to understand its structure
      logger.debug({ 
        responseData: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        firstItem: Array.isArray(response.data) ? response.data[0] : null
      }, "Raw voice response from OpenAI Edge TTS API");
      
      // Handle the specific voice structure: [{voices: [{name, gender, language}]}]
      let voices: string[] = [];
      
      if (Array.isArray(response.data)) {
        // The API returns an array with one object containing a voices array
        const voicesContainer = response.data[0];
        if (voicesContainer && voicesContainer.voices && Array.isArray(voicesContainer.voices)) {
          voices = voicesContainer.voices.map((voice: any) => voice.name).filter(Boolean);
        } else {
          // Fallback: try to extract from each item in the array
          voices = response.data.map((item: any) => {
            if (typeof item === 'string') {
              return item;
            } else if (item && typeof item === 'object') {
              return item.name || item.id || item.voice || String(item);
            }
            return String(item);
          }).filter(Boolean);
        }
      } else if (response.data.voices && Array.isArray(response.data.voices)) {
        // Direct voices array format
        voices = response.data.voices.map((voice: any) => {
          if (typeof voice === 'string') {
            return voice;
          } else if (voice && typeof voice === 'object') {
            return voice.name || voice.id || voice.voice || String(voice);
          }
          return String(voice);
        }).filter(Boolean);
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // OpenAI API format
        voices = response.data.data.map((voice: any) => {
          if (typeof voice === 'string') {
            return voice;
          } else if (voice && typeof voice === 'object') {
            return voice.name || voice.id || voice.voice || String(voice);
          }
          return String(voice);
        }).filter(Boolean);
      }
      
      if (!voices.length) {
        logger.warn("No voices found in API response, using fallback voices");
        return this.getFallbackVoices();
      }
      
      logger.info({ voiceCount: voices.length }, "Successfully fetched voices from OpenAI Edge TTS API");
      return voices;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        baseUrl: this.baseUrl 
      }, "Error fetching voices from OpenAI Edge TTS API, using fallback voices");
      return this.getFallbackVoices();
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
