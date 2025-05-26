import axios from "axios";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";

interface DahopeviResponse {
  audio_url: string;
  subtitle_url: string;
}

export class StreamlabsPolly {
  constructor(private dahopevi_url: string, private api_key?: string) {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      logger.debug({ text, voice }, "Generating audio via dahopevi /speech endpoint with streamlabs-polly");
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.api_key) {
        headers['Authorization'] = `Bearer ${this.api_key}`;
      }

      // Call dahopevi's TTS endpoint
      const response = await axios.post(`${this.dahopevi_url}/v1/audio/speech`, {
        tts: "streamlabs-polly",
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
      
      logger.debug({ text, voice, audioLength, audioSize: audioBuffer.byteLength }, "Audio generated via dahopevi with streamlabs-polly");

      return {
        audio: audioBuffer,
        audioLength: audioLength,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, text, voice }, "Failed to generate audio via dahopevi with streamlabs-polly");
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

  static async init(): Promise<StreamlabsPolly> {
    // Get dahopevi URL from environment or default to localhost
    const dahopevi_url = process.env.DAHOPEVI_URL || 'http://localhost:8080';
    const api_key = process.env.DAHOPEVI_API_KEY;
    
    logger.debug({ dahopevi_url }, "Initializing StreamlabsPolly with dahopevi TTS service");
    
    const streamlabsPolly = new StreamlabsPolly(dahopevi_url, api_key);
    
    // Test connection to dahopevi
    try {
      await streamlabsPolly.testConnection();
      logger.info("Successfully connected to dahopevi TTS service for StreamlabsPolly");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, "Could not verify dahopevi connection for StreamlabsPolly, but continuing");
    }
    
    return streamlabsPolly;
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
    // For streamlabs-polly, we'll need to fetch available voices from the API
    // For now, return some common voices - this should be updated to fetch from API
    return ["af_heart", "af_alloy", "af_nova"] as Voices[];
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

      // Filter for streamlabs-polly voices
      return response.data.voices
        .filter((voice: { engine: string }) => voice.engine === "streamlabs-polly")
        .map((voice: { name: string }) => voice.name) || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, "Could not fetch streamlabs-polly voices from dahopevi");
      return [];
    }
  }
}
