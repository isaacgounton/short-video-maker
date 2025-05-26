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

      // Get audio duration using the audio buffer
      const audioBuffer = audioResponse.data;
      const audioContext = new (require("web-audio-api").AudioContext)();
      const audioLength = await new Promise<number>((resolve) => {
        audioContext.decodeAudioData(audioBuffer, (buffer: { duration: number }) => {
          resolve(buffer.duration);
        });
      });

      logger.debug({ text, voice, audioLength }, "Audio generated with Dahopevi");

      return {
        audio: audioBuffer,
        audioLength,
      };
    } catch (error) {
      logger.error("Error generating audio with Dahopevi:", error);
      throw error;
    }
  }

  listAvailableVoices(): string[] {
    // Return common Edge TTS voices as fallback
    return [
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
    ];
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
      
      return response.data.voices
        .filter((voice: { engine: string }) => voice.engine === "edge-tts")
        .map((voice: { name: any }) => voice.name);
    } catch (error) {
      logger.error("Error fetching voices from Dahopevi:", error);
      return this.listAvailableVoices(); // fallback to static list
    }
  }

  static async init(apiKey: string, baseUrl: string): Promise<EdgeTTS> {
    return new EdgeTTS(apiKey, baseUrl);
  }
}
