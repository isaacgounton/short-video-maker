import { Voices } from "../../types/shorts";
import { logger } from "../../config";
import { TTSService } from "./TTSFactory";

// Declare process global for Node.js environment
declare const process: any;

export class OpenAIEdgeTTS implements TTSService {
  private cachedVoices: string[] = [
    // OpenAI Edge TTS supported voices
    "alloy",
    "echo",
    "fable",
    "onyx",
    "nova",
    "shimmer"
  ];

  constructor() {}

  async generate(
    text: string,
    voice: Voices,
  ): Promise<{
    audio: ArrayBuffer;
    audioLength: number;
  }> {
    try {
      logger.debug({ text, voice }, "Generating audio with OpenAI Edge TTS");

      // Validate voice
      const selectedVoice = this.validateVoice(voice);
      
      // Call the local Python OpenAI Edge TTS service
      const audioBuffer = await this.callLocalTTSService(text, selectedVoice);
      
      // Estimate audio duration (rough estimation based on text length)
      // This is a conservative estimate - actual duration will be determined by audio processing
      const estimatedDuration = this.estimateAudioDuration(text);
      
      logger.debug({ 
        text, 
        voice: selectedVoice, 
        audioLength: `${estimatedDuration}s (estimated)`,
        fileSize: `${audioBuffer.byteLength} bytes`
      }, "Audio generated with OpenAI Edge TTS");

      return {
        audio: audioBuffer,
        audioLength: estimatedDuration,
      };
    } catch (error) {
      logger.error("Error generating audio with OpenAI Edge TTS:", error);
      throw error;
    }
  }

  private validateVoice(voice: Voices): string {
    // If voice is already a valid OpenAI voice, use it
    if (this.cachedVoices.includes(voice)) {
      return voice;
    }

    // Try to map some common voice names to OpenAI voices
    const voiceMappings: Record<string, string> = {
      // Female voices
      "af_heart": "nova",
      "af_alloy": "alloy", 
      "af_nova": "nova",
      "af_bella": "nova",
      "af_jessica": "nova",
      "af_sarah": "nova",
      "bf_emma": "nova",
      "bf_isabella": "nova",
      "bf_alice": "nova",
      "bf_lily": "nova",
      
      // Male voices  
      "am_adam": "onyx",
      "am_echo": "echo",
      "am_eric": "onyx",
      "am_liam": "onyx",
      "am_michael": "onyx",
      "am_onyx": "onyx",
      "bm_george": "onyx",
      "bm_lewis": "onyx",
      "bm_daniel": "onyx",
      "bm_fable": "fable",
      
      // Special voices
      "af_aoede": "shimmer",
      "af_kore": "shimmer",
      "af_nicole": "shimmer",
      "af_river": "shimmer", 
      "af_sky": "shimmer",
      "am_fenrir": "echo",
      "am_puck": "echo",
      "am_santa": "echo",
    };

    // Check if we have a mapping for this voice
    if (voiceMappings[voice]) {
      return voiceMappings[voice];
    }

    // Default fallback
    logger.warn({ voice }, "Unknown voice, using default 'alloy'");
    return "alloy";
  }

  private async callLocalTTSService(text: string, voice: string): Promise<ArrayBuffer> {
    try {
      // Get the TTS service URL from environment or use default
      const ttsServiceUrl = process.env?.OPENAI_EDGE_TTS_URL || 'http://localhost:5050';
      const apiKey = process.env?.DAHOPEVI_API_KEY || process.env?.API_KEY || 'your-api-key';
      
      logger.debug({ ttsServiceUrl, voice }, "Calling local OpenAI Edge TTS service");
      
      const response = await fetch(`${ttsServiceUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          voice: voice,
          response_format: 'mp3',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS service responded with ${response.status}: ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      logger.debug({ audioSize: audioBuffer.byteLength }, "Audio generated successfully");
      
      return audioBuffer;
    } catch (error) {
      logger.error("Error calling local TTS service:", error);
      throw error;
    }
  }

  private async convertToArrayBuffer(audioData: any): Promise<ArrayBuffer> {
    try {
      // Handle different types of audio data that openai-edge-tts might return
      if (audioData instanceof ArrayBuffer) {
        return audioData;
      }
      
      if (audioData instanceof Uint8Array) {
        return audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      }
      
      // Check for Node.js Buffer type without importing it
      if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer && audioData instanceof (globalThis as any).Buffer) {
        return audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      }
      
      // If it's a readable stream or response, read it
      if (audioData && typeof audioData.arrayBuffer === 'function') {
        return await audioData.arrayBuffer();
      }
      
      // If it's a response-like object with a blob method
      if (audioData && typeof audioData.blob === 'function') {
        const blob = await audioData.blob();
        return await blob.arrayBuffer();
      }
      
      // If it's already array buffer-like
      if (audioData && audioData.buffer) {
        return audioData.buffer;
      }
      
      throw new Error('Unsupported audio data format');
    } catch (error) {
      logger.error("Error converting audio data to ArrayBuffer:", error);
      throw error;
    }
  }

  private estimateAudioDuration(text: string): number {
    // Rough estimation: average speaking speed is about 150-160 words per minute
    // This translates to about 2.5-2.7 words per second
    const words = text.split(/\s+/).length;
    const estimatedSeconds = words / 2.6; // Conservative estimate
    
    // Add some buffer time and ensure minimum duration
    return Math.max(1, Math.ceil(estimatedSeconds * 1.1));
  }

  listAvailableVoices(): string[] {
    return [...this.cachedVoices];
  }

  static async init(): Promise<OpenAIEdgeTTS> {
    const instance = new OpenAIEdgeTTS();
    logger.info("OpenAI Edge TTS service initialized successfully");
    return instance;
  }
}