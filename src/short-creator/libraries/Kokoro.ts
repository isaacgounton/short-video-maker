import axios from "axios";
import {
  VoiceEnum,
  type kokoroModelPrecision,
  type Voices,
} from "../../types/shorts";
import { logger } from "../../config";

// Use Node.js global types (Buffer and process are available globally in Node.js)
// @types/node provides the proper typing for these globals

export class Kokoro {
  private cachedVoices: string[] | null = null; // Cache for API voices
  
  constructor(private dahopevi_url: string, private api_key?: string) {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      logger.debug({ text, voice }, "Generating audio via dahopevi /speech endpoint");
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.api_key) {
        headers['x-api-key'] = this.api_key;
      }

      // Call dahopevi's TTS endpoint with longer timeout for video generation
      const response = await axios.post(`${this.dahopevi_url}/v1/audio/speech`, {
        tts: "kokoro",
        text: text,
        voice: voice,
        output_format: "wav"
      }, {
        headers,
        timeout: 120000, // 2 minute timeout for initial request
      });

      if (response.status !== 200) {
        throw new Error(`TTS request failed with status ${response.status}`);
      }

      const { audio_url, duration } = response.data.response || response.data;
      
      // Download the audio file with extended timeout
      const audioResponse = await axios.get(audio_url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 1 minute timeout for download
      });

      const audioBuffer = audioResponse.data;
      
      // Use duration from API response if available, otherwise estimate
      let audioLength: number;
      if (duration && typeof duration === 'number') {
        audioLength = duration;
      } else {
        // Fallback: estimate audio length (rough calculation for WAV files)
        // WAV header is 44 bytes, then raw audio data
        // Assuming 16-bit, 22050 Hz mono (typical for TTS)
        const dataSize = audioBuffer.byteLength - 44;
        audioLength = dataSize / (2 * 22050); // 2 bytes per sample, 22050 samples per second
      }
      
      logger.debug({ text, voice, audioLength, audioSize: audioBuffer.byteLength }, "Audio generated via dahopevi");

      return {
        audio: audioBuffer,
        audioLength: audioLength,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, text, voice }, "Failed to generate audio via dahopevi");
      throw new Error(`TTS generation failed: ${errorMessage}`);
    }
  }

  static concatWavBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    if (buffers.length === 0) {
      throw new Error("No buffers to concatenate");
    }
    
    if (buffers.length === 1) {
      return buffers[0];
    }

    const header = Buffer.from(buffers[0].slice(0, 44));
    let totalDataLength = 0;

    const dataParts = buffers.map((buf) => {
      const b = Buffer.from(buf);
      const data = b.slice(44);
      totalDataLength += data.length;
      return data;
    });

    header.writeUInt32LE(36 + totalDataLength, 4);
    header.writeUInt32LE(totalDataLength, 40);

    return Buffer.concat([header, ...dataParts]);
  }

  static async init(dtype: kokoroModelPrecision): Promise<Kokoro> {
    // Get dahopevi URL from environment or default to public API
    const dahopevi_url = process.env.DAHOPEVI_BASE_URL || process.env.DAHOPEVI_URL || 'https://api.dahopevi.com';
    const api_key = process.env.DAHOPEVI_API_KEY;
    
    logger.debug({ dahopevi_url, dtype }, "Initializing Kokoro with dahopevi TTS service");
    
    const kokoro = new Kokoro(dahopevi_url, api_key);
    
    // Test connection to dahopevi
    try {
      await kokoro.testConnection();
      logger.info("Successfully connected to dahopevi TTS service");
      
      // Fetch and cache available voices from API (non-blocking)
      // Don't block initialization on voice fetching since we have fallbacks
      kokoro.getVoicesFromDahopevi().then(voices => {
        if (voices.length > 0) {
          logger.info({ voiceCount: voices.length }, "Successfully fetched kokoro voices from dahopevi API");
        } else {
          logger.warn("No kokoro voices found in dahopevi API, will use fallback list");
        }
      }).catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn({ error: errorMessage }, "Could not fetch kokoro voices from dahopevi");
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, "Could not verify dahopevi connection, but continuing");
    }
    
    return kokoro;
  }

  async testConnection(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (this.api_key) {
        headers['x-api-key'] = this.api_key;
      }

      await axios.get(`${this.dahopevi_url}/health`, {
        headers,
        timeout: 3000 // Reduced timeout for faster startup
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot connect to dahopevi at ${this.dahopevi_url}: ${errorMessage}`);
    }
  }

  listAvailableVoices(): string[] {
    // If we have cached voices from API, use them, otherwise use fallback
    if (this.cachedVoices) {
      return this.cachedVoices;
    }
    
    // Fallback list with current Kokoro voice enum values if API is not available
    return [
      "af_heart",
      "af_alloy", 
      "af_aoede",
      "af_bella",
      "af_jessica",
      "af_kore",
      "af_nicole",
      "af_nova",
      "af_river",
      "af_sarah",
      "af_sky",
      "am_adam",
      "am_echo",
      "am_eric",
      "am_fenrir",
      "am_liam",
      "am_michael",
      "am_onyx",
      "am_puck",
      "am_santa",
      "bf_emma",
      "bf_isabella",
      "bm_george",
      "bm_lewis",
      "bf_alice",
      "bf_lily",
      "bm_daniel",
      "bm_fable",
    ];
  }

  async getVoicesFromDahopevi(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.api_key) {
        headers['x-api-key'] = this.api_key;
      }

      const response = await axios.get(`${this.dahopevi_url}/v1/audio/speech/voices`, {
        headers,
        timeout: 5000 // Reduced timeout to 5 seconds
      });

      // Filter for kokoro voices and cache them
      const voices = response.data?.response?.voices || [];
      const kokoroVoices = voices
        .filter((voice: { engine?: string }) => voice?.engine === "kokoro")
        .map((voice: { name?: string }) => voice?.name).filter(Boolean);
      
      // Cache the voices for future use
      this.cachedVoices = kokoroVoices;
      
      return kokoroVoices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, "Could not fetch kokoro voices from dahopevi");
      return [];
    }
  }
}
