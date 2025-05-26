import axios from "axios";
import { Voices } from "../../types/shorts";
import { logger } from "../../config";

interface DahopeviResponse {
  response: {
    audio_url: string;
    subtitle_url: string;
  };
}

export class DahopeviTTS {
  constructor(private apiKey: string, private baseUrl: string) {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      const response = await axios.post<DahopeviResponse>(
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

  async listAvailableVoices(): Promise<Voices[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/audio/speech/voices`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });
      
      return response.data.voices
        .filter((voice: { engine: string }) => voice.engine === "edge-tts")
        .map((voice: { name: any }) => voice.name);
    } catch (error) {
      logger.error("Error fetching voices from Dahopevi:", error);
      throw error;
    }
  }

  static async init(apiKey: string, baseUrl: string): Promise<DahopeviTTS> {
    return new DahopeviTTS(apiKey, baseUrl);
  }
}
