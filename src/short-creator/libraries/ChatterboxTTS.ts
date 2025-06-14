import { TTSService } from "./TTSFactory";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";
import axios from "axios";

export class ChatterboxTTS implements TTSService {
  private constructor(private apiKey: string, private baseUrl: string) {}

  static async init(apiKey: string, baseUrl: string): Promise<ChatterboxTTS> {
    const instance = new ChatterboxTTS(apiKey, baseUrl);
    await instance.validateConnection();
    return instance;
  }

  private async validateConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/voices`, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      
      if (response.status !== 200) {
        throw new Error(`Failed to connect to Chatterbox TTS service: ${response.statusText}`);
      }

      logger.info("Successfully connected to Chatterbox TTS service");
    } catch (error) {
      logger.error("Failed to validate Chatterbox TTS connection", error);
      throw error;
    }
  }

  async generate(text: string, voice: Voices): Promise<{ audio: ArrayBuffer; audioLength: number }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/audio/speech`,
        {
          text,
          voice,
          tts: "chatterbox",
          output_format: "mp3"
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          responseType: "arraybuffer"
        }
      );

      const audio = response.data;
      
      // Get audio duration
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(audio.slice(0));
      const audioLength = audioBuffer.duration * 1000; // Convert to milliseconds

      return {
        audio,
        audioLength
      };
    } catch (error) {
      logger.error("Failed to generate speech with Chatterbox TTS", error);
      throw error;
    }
  }

  listAvailableVoices(): string[] {
    // Return array of supported voice IDs for Chatterbox
    return [
      "Abigail", "Adrian", "Alexander", "Alice", "Austin",
      "Axel", "Connor", "Cora", "Elena", "Eli",
      "Emily", "Everett", "Gabriel", "Gianna", "Henry",
      "Ian", "Jade", "Jeremiah", "Jordan", "Julian",
      "Layla", "Leonardo", "Michael", "Miles", "Olivia",
      "Ryan", "Taylor", "Thomas"
    ];
  }
}
