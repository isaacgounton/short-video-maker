import ffmpeg from "fluent-ffmpeg";
import { Readable } from "node:stream";
import { logger } from "../../logger";

export class FFMpeg {
  static async init(): Promise<FFMpeg> {
    return import("@ffmpeg-installer/ffmpeg").then((ffmpegInstaller) => {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      logger.info("FFmpeg path set to:", ffmpegInstaller.path);
      return new FFMpeg();
    });
  }  async saveNormalizedAudio(
    audio: ArrayBuffer,
    outputPath: string,
    inputFormat: string = 'auto'
  ): Promise<string> {
    logger.debug({ inputFormat }, "Normalizing audio for Whisper");
    
    // Validate the audio buffer
    if (!audio || audio.byteLength === 0) {
      throw new Error("Cannot process empty audio buffer");
    }
    
    logger.debug({ bufferSize: audio.byteLength, inputFormat }, "Audio buffer validation passed");
    
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);

    return new Promise((resolve, reject) => {      // Create base command
      let command = ffmpeg().input(inputStream);
      
      // If format is specified and not 'auto', use it for input
      if (inputFormat && inputFormat !== 'auto') {
        // Map supported formats to their FFmpeg input format names
        const formatMapping: {[key: string]: string} = {
          'mp3': 'mp3',
          'opus': 'opus',
          'aac': 'aac',
          'flac': 'flac',
          'wav': 'wav',
          'pcm': 's16le', // Default PCM format, may need adjustment
        };
        
        const ffmpegFormat = formatMapping[inputFormat] || inputFormat;
        command = command.inputFormat(ffmpegFormat);
        logger.debug({ inputFormat, ffmpegFormat }, "Setting explicit input format for FFmpeg");
      } else {
        // Try to auto-detect format from buffer header
        const detectedFormat = this.detectAudioFormat(audio);
        if (detectedFormat !== 'auto') {
          const formatMapping: {[key: string]: string} = {
            'mp3': 'mp3',
            'opus': 'opus',
            'aac': 'aac',
            'flac': 'flac',
            'wav': 'wav',
            'pcm': 's16le',
          };
          const ffmpegFormat = formatMapping[detectedFormat] || detectedFormat;
          command = command.inputFormat(ffmpegFormat);
          logger.debug({ detectedFormat, ffmpegFormat }, "Auto-detected input format for FFmpeg");
        }
      }
      
      // Set up output format for whisper (16kHz, mono, WAV)
      command = command
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(16000)
        .toFormat("wav");
      
      // Add additional debugging for the ffmpeg command
      command.on("start", (commandLine: string) => {
        logger.debug({ commandLine }, "FFmpeg process started");
      });
      
      command.on("end", () => {
        logger.debug({ outputPath }, "Audio normalization complete");
        resolve(outputPath);
      });
      
      command.on("error", (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error, errorMessage, bufferSize: audio.byteLength }, "Error normalizing audio:");
        reject(error);
      });
      
      command.save(outputPath);
    });
  }

  async createMp3DataUri(audio: ArrayBuffer): Promise<string> {
    // Validate the audio buffer
    if (!audio || audio.byteLength === 0) {
      throw new Error("Cannot process empty audio buffer");
    }
    
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg()
        .input(inputStream)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3")
        .on("error", (err: Error) => {
          logger.error({ error: err }, "Error creating MP3 data URI");
          reject(err);
        })
        .pipe()
        .on("data", (data: Buffer) => {
          chunks.push(data);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(`data:audio/mp3;base64,${buffer.toString("base64")}`);
        })
        .on("error", (err: Error) => {
          logger.error({ error: err }, "Error in pipe stream");
          reject(err);
        });
    });
  }
  async saveToMp3(audio: ArrayBuffer, filePath: string, inputFormat: string = 'auto'): Promise<string> {
    // Validate the audio buffer
    if (!audio || audio.byteLength === 0) {
      throw new Error("Cannot process empty audio buffer");
    }
    
    logger.debug({ bufferSize: audio.byteLength, inputFormat }, "Saving audio to MP3");
    
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    
    return new Promise((resolve, reject) => {
      // Create base command
      let command = ffmpeg().input(inputStream);      // If format is specified and not 'auto', use it for input
      if (inputFormat && inputFormat !== 'auto') {
        // Map supported formats to their FFmpeg input format names
        const formatMapping: {[key: string]: string} = {
          'mp3': 'mp3',
          'opus': 'opus',
          'aac': 'aac',
          'flac': 'flac',
          'wav': 'wav',
          'pcm': 's16le', // Default PCM format, may need adjustment
        };
        
        const ffmpegFormat = formatMapping[inputFormat] || inputFormat;
        command = command.inputFormat(ffmpegFormat);
        logger.debug({ inputFormat, ffmpegFormat }, "Setting explicit input format for FFmpeg MP3 conversion");
      } else {
        // Try to auto-detect format from buffer header
        const detectedFormat = this.detectAudioFormat(audio);
        if (detectedFormat !== 'auto') {
          const formatMapping: {[key: string]: string} = {
            'mp3': 'mp3',
            'opus': 'opus',
            'aac': 'aac',
            'flac': 'flac',
            'wav': 'wav',
            'pcm': 's16le',
          };
          const ffmpegFormat = formatMapping[detectedFormat] || detectedFormat;
          command = command.inputFormat(ffmpegFormat);
          logger.debug({ detectedFormat, ffmpegFormat }, "Auto-detected input format for FFmpeg MP3 conversion");
        }
      }
      
      // Set up output format (MP3)
      command = command
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3");
      
      command.on("start", (commandLine: string) => {
        logger.debug({ commandLine }, "FFmpeg MP3 conversion started");
      });
      
      command.on("end", () => {
        logger.debug({ filePath }, "Audio MP3 conversion complete");
        resolve(filePath);
      });
      
      command.on("error", (error: Error) => {
        logger.error({ error, filePath }, "Error saving to MP3:");
        reject(error);
      });
        command.save(filePath);
    });
  }
  
  /**
   * Helper method to detect audio format from file buffer header
   * This is a basic implementation that can be expanded for more accurate detection
   */
  detectAudioFormat(buffer: ArrayBuffer): string {
    const header = new Uint8Array(buffer.slice(0, 12));
    
    // Check for WAV header
    if (
      header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45
    ) {
      return 'wav';
    }
    
    // Check for MP3 header (ID3 or MPEG frame sync)
    if (
      (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) || // ID3
      ((header[0] === 0xFF) && ((header[1] & 0xE0) === 0xE0)) // MPEG frame sync
    ) {
      return 'mp3';
    }
    
    // Check for FLAC header
    if (
      header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43
    ) {
      return 'flac';
    }
    
    // Check for Ogg/Opus header
    if (
      header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53
    ) {
      return 'opus'; // Could be Vorbis too, would need deeper inspection
    }
    
    // Check for AAC (ADTS) header
    if (
      (header[0] === 0xFF) && ((header[1] & 0xF6) === 0xF0)
    ) {
      return 'aac';
    }
    
    // Default to 'auto' if no match found
    logger.debug({ headerBytes: [...header].map(b => b.toString(16).padStart(2, '0')).join(' ') }, 
      "Could not detect audio format from header, defaulting to auto");
    return 'auto';
  }
}
