import { logger, Config } from "../../config";
import type { Caption } from "../../types/shorts";

export interface TranscriptionOptions {
  language?: string;
  includeSegments?: boolean;
  wordTimestamps?: boolean;
  maxWordsPerLine?: number;
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    probability: number;
  }>;
}

export interface TranscriptionResponse {
  text: string;
  srt?: string;
  segments?: TranscriptionSegment[];
  text_url?: string;
  srt_url?: string;
  segments_url?: string;
}

export class Transcription {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.transcriptionApiUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.transcriptionApiKey;
    
    if (!this.apiKey) {
      logger.warn("DAHOPEVI_API_KEY not found. Please set the environment variable for transcription to work.");
    }
    
    logger.info({ baseUrl: this.baseUrl }, "Transcription service initialized");
  }

  async transcribeFromUrl(
    mediaUrl: string, 
    options: TranscriptionOptions = {}
  ): Promise<Caption[]> {
    try {
      if (!this.apiKey) {
        throw new Error("DAHOPEVI_API_KEY is required for transcription. Please set the environment variable.");
      }

      const payload: any = {
        media_url: mediaUrl,
        task: "transcribe",
        include_text: true,
        include_segments: true,
        include_srt: false,
        word_timestamps: options.wordTimestamps || true,
        response_type: "direct",
        language: options.language
      };

      // Only include max_words_per_line if we're including SRT (as per API docs)
      if (options.maxWordsPerLine && payload.include_srt) {
        payload.max_words_per_line = options.maxWordsPerLine;
      }

      logger.debug({ 
        mediaUrl, 
        language: options.language,
        payload 
      }, "Starting transcription with dahopevi API");

      const response = await fetch(`${this.baseUrl}/v1/media/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription API error: HTTP ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(`Transcription failed: ${result.message || 'Unknown error'}`);
      }

      const transcriptionData: TranscriptionResponse = result.response;
      
      if (!transcriptionData.segments || transcriptionData.segments.length === 0) {
        logger.warn({ mediaUrl }, "No segments returned from transcription");
        return [];
      }

      // Convert segments to Caption format
      const captions: Caption[] = [];
      
      for (const segment of transcriptionData.segments) {
        if (!segment.text || segment.text.trim() === "") {
          continue;
        }

        // If word timestamps are available, create captions for each word
        if (segment.words && segment.words.length > 0) {
          for (const word of segment.words) {
            if (word.word.trim() === "") continue;
            
            captions.push({
              text: word.word,
              startMs: Math.round(word.start * 1000),
              endMs: Math.round(word.end * 1000),
            });
          }
        } else {
          // Fallback: create a single caption for the entire segment
          captions.push({
            text: segment.text.trim(),
            startMs: Math.round(segment.start * 1000),
            endMs: Math.round(segment.end * 1000),
          });
        }
      }

      logger.debug({ 
        mediaUrl, 
        captionsCount: captions.length,
        language: options.language 
      }, "Transcription completed successfully");

      return captions;
    } catch (error) {
      logger.error({ 
        error, 
        mediaUrl, 
        language: options.language 
      }, "Failed to transcribe audio with dahopevi API");
      throw error;
    }
  }

  async transcribeFromFile(
    audioPath: string, 
    options: TranscriptionOptions = {}
  ): Promise<Caption[]> {
    // For file-based transcription, we need to upload the file first or serve it via HTTP
    // This would require implementing file upload to dahopevi or serving files via HTTP
    // For now, let's throw an error with instructions
    throw new Error(
      "Direct file transcription not implemented. " +
      "Audio files need to be accessible via HTTP URL for dahopevi transcription. " +
      "Consider serving temporary files via HTTP or uploading to cloud storage."
    );
  }

  /**
   * Get language code from voice locale
   */
  static getLanguageFromVoice(voiceLocale: string): string | undefined {
    if (!voiceLocale) return undefined;
    
    // Extract language code from locale (e.g., "en-US" -> "en")
    const langCode = voiceLocale.split('-')[0].toLowerCase();
    
    // Map some common language codes to match whisper expected formats
    const languageMap: Record<string, string> = {
      'en': 'en',
      'es': 'es', 
      'fr': 'fr',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'ru': 'ru',
      'ja': 'ja',
      'ko': 'ko',
      'zh': 'zh',
      'ar': 'ar',
      'hi': 'hi',
      'nl': 'nl',
      'pl': 'pl',
      'tr': 'tr',
      'sv': 'sv',
      'da': 'da',
      'no': 'no',
      'fi': 'fi',
      'hu': 'hu',
      'cs': 'cs',
      'bg': 'bg',
      'hr': 'hr',
      'sk': 'sk',
      'sl': 'sl',
      'et': 'et',
      'lv': 'lv',
      'lt': 'lt',
      'mt': 'mt',
      'ga': 'ga',
      'cy': 'cy'
    };
    
    return languageMap[langCode];
  }

  /**
   * Get voice locale from voice configuration files
   */
  static getVoiceLocale(voiceName: string, voiceConfigs: any[]): string | undefined {
    for (const config of voiceConfigs) {
      const voice = config.find((v: any) => v.name === voiceName);
      if (voice && voice.locale) {
        return voice.locale;
      }
    }
    return undefined;
  }
}
