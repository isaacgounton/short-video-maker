import axios from "axios";
import {
  VoiceEnum,
  type kokoroModelPrecision,
  type Voices,
} from "../../types/shorts";
import { logger } from "../../config";

export class Kokoro {
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
        headers['Authorization'] = `Bearer ${this.api_key}`;
      }

      // Call dahopevi's TTS endpoint
      const response = await axios.post(`${this.dahopevi_url}/v1/audio/speech`, {
        tts: "kokoro",
        text: text,
        voice: voice,
        output_format: "wav"
      }, {
        headers,
        timeout: 60000, // 60 second timeout
      });

      if (response.status !== 200) {
        throw new Error(`TTS request failed with status ${response.status}`);
      }

      const { audio_url } = response.data;
      
      // Download the audio file
      const audioResponse = await axios.get(audio_url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const audioBuffer = audioResponse.data;
      
      // Estimate audio length (rough calculation for WAV files)
      // WAV header is 44 bytes, then raw audio data
      // Assuming 16-bit, 22050 Hz mono (typical for TTS)
      const dataSize = audioBuffer.byteLength - 44;
      const audioLength = dataSize / (2 * 22050); // 2 bytes per sample, 22050 samples per second
      
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
    // Get dahopevi URL from environment or default to localhost
    const dahopevi_url = process.env.DAHOPEVI_URL || 'http://localhost:8080';
    const api_key = process.env.DAHOPEVI_API_KEY;
    
    logger.debug({ dahopevi_url, dtype }, "Initializing Kokoro with dahopevi TTS service");
    
    const kokoro = new Kokoro(dahopevi_url, api_key);
    
    // Test connection to dahopevi
    try {
      await kokoro.testConnection();
      logger.info("Successfully connected to dahopevi TTS service");
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
        headers['Authorization'] = `Bearer ${this.api_key}`;
      }

      await axios.get(`${this.dahopevi_url}/health`, {
        headers,
        timeout: 5000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot connect to dahopevi at ${this.dahopevi_url}: ${errorMessage}`);
    }
  }

  listAvailableVoices(): Voices[] {
    // Return all available voices from the enum
    const voices = Object.values(VoiceEnum) as Voices[];
    return voices;
  }

  async getVoicesFromDahopevi(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.api_key) {
        headers['Authorization'] = `Bearer ${this.api_key}`;
      }

      const response = await axios.get(`${this.dahopevi_url}/v1/audio/speech/voices`, {
        headers,
        timeout: 10000
      });

      return response.data.voices || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, "Could not fetch voices from dahopevi");
      return [];
    }
  }
}
