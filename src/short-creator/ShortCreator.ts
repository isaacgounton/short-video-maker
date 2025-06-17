import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";

import { TTS } from "./libraries/TTS";
import { Remotion } from "./libraries/Remotion";
import { Transcription } from "./libraries/Transcription";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import {
  SceneInput,
  RenderConfig,
  Scene,
  TTSVoice,
  TTSProvider,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];

  constructor(
    private config: Config,
    private remotion: Remotion,
    private tts: TTS,
    private transcription: Transcription,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    const scenes: Scene[] = [];
    let totalDuration = 0;
    const excludeVideoIds = [];
    const tempFiles = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    let index = 0;
    for (const scene of inputScenes) {
      let audioLength: number;
      let captions: any;
      let video: any;
      let tempVideoPath: string;
      let tempVideoFileName: string;
      let tempMp3FileName: string;
      
      try {
        // Generate audio with the configured provider and voice
        logger.debug(`Generating audio for scene text: "${scene.text.substring(0, 50)}${scene.text.length > 50 ? '...' : ''}"`);
        
        // Determine the provider and validate voice compatibility ONCE for the entire video
        // This prevents different voices from being used across scenes
        let provider = config.provider ?? TTSProvider.Kokoro;
        let voice = config.voice;
        
        // Only do voice compatibility check on the first scene to ensure consistency
        if (index === 0) {
          if (!voice || !await this.isVoiceCompatibleWithProvider(voice, provider)) {
            voice = await this.getDefaultVoiceForProvider(provider);
            if (config.voice && config.voice !== voice) {
              logger.warn({
                originalVoice: config.voice,
                selectedVoice: voice,
                provider
              }, "Original voice is incompatible with provider, using default voice for entire video");
            }
            // Update the config to use the validated voice for all subsequent scenes
            config.voice = voice;
            config.provider = provider;
          }
        } else {
          // Use the voice and provider from config that was validated in the first scene
          voice = config.voice!;
          provider = config.provider!;
        }
        
        const audio = await this.tts.generate(
          scene.text,
          voice,
          provider
        );
        audioLength = audio.audioLength;
        const { audio: audioStream, format: audioFormat } = audio;

        // Validate audio buffer to prevent processing empty audio
        if (!audioStream || audioStream.byteLength === 0) {
          throw new Error(`Invalid audio buffer received from TTS. Buffer size: ${audioStream?.byteLength || 0} bytes`);
        }
        
        // Validate audio duration to prevent very short scenes
        if (audioLength < 1.0) {
          logger.warn({
            sceneIndex: index,
            audioLength,
            textLength: scene.text.length,
            text: scene.text.substring(0, 100)
          }, "Scene has very short duration (< 1 second), this might cause timing issues");
        }
        
        logger.debug(`Audio generated successfully. Format: ${audioFormat}, Buffer size: ${audioStream.byteLength} bytes, Duration: ${audioLength}s`);

        // add the paddingBack in seconds to the last scene
        if (index + 1 === inputScenes.length && config.paddingBack) {
          audioLength += config.paddingBack / 1000;
        }

        const tempId = cuid();
        const tempWavFileName = `${tempId}.wav`;
        tempMp3FileName = `${tempId}.mp3`;
        tempVideoFileName = `${tempId}.mp4`;
        const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
        const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
        tempVideoPath = path.join(
          this.config.tempDirPath,
          tempVideoFileName,
        );

        tempFiles.push(tempVideoPath);
        tempFiles.push(tempWavPath, tempMp3Path);

        // Process audio and generate captions
        try {
          logger.debug("Saving audio as MP3");
          await this.ffmpeg.saveToMp3(audioStream, tempMp3Path, audioFormat);
            // Use dahopevi transcription service for multilingual support
          logger.debug("Generating captions with dahopevi transcription service");
          
          // Get voice locale to determine language for transcription
          let voiceLocale: string | undefined;
          let language: string | undefined;
          
          try {
            // Get voice locale dynamically from TTS service instead of static files
            const voiceWithLocale = await this.tts.getVoiceWithLocale(voice, provider);            if (voiceWithLocale && voiceWithLocale.locale) {
              voiceLocale = voiceWithLocale.locale;
              language = Transcription.getLanguageFromVoice(voiceLocale);
              logger.debug({ voice, voiceLocale, language }, "Detected language from TTS API");
            } else {
              // Fallback: try to load from static files for any provider that doesn't support locale API
              voiceLocale = await this.getVoiceLocaleFromFiles(voice);
              if (voiceLocale) {
                language = Transcription.getLanguageFromVoice(voiceLocale);
              }
              logger.debug({ voice, voiceLocale, language }, "Detected language from static files fallback");
            }
          } catch (error) {
            logger.warn({ error, voice, provider }, "Could not detect voice language, transcription may be less accurate");          }
          
          // Transcribe using the MP3 file URL (using unauthenticated endpoint for transcription service)
          const mp3Url = `${this.config.publicUrl}/tmp/${tempMp3FileName}`;
          captions = await this.transcription.transcribeFromUrl(mp3Url, {
            language,
            wordTimestamps: true,
            maxWordsPerLine: 8
          });
          
        } catch (audioError) {
          logger.error({ error: audioError }, "Error processing audio files or generating captions");
          throw new Error(`Failed to generate captions: ${audioError instanceof Error ? audioError.message : String(audioError)}`);
        }

        // Find and download video
        video = await this.pexelsApi.findVideo(
          scene.searchTerms,
          audioLength,
          excludeVideoIds,
          orientation,
        );

        logger.debug(`Downloading video from ${video.url} to ${tempVideoPath}`);

        await new Promise<void>((resolve, reject) => {
          const fileStream = fs.createWriteStream(tempVideoPath);
          https
            .get(video.url, (response: http.IncomingMessage) => {
              if (response.statusCode !== 200) {
                reject(
                  new Error(`Failed to download video: ${response.statusCode}`),
                );
                return;
              }

              response.pipe(fileStream);

              fileStream.on("finish", () => {
                fileStream.close();
                logger.debug(`Video downloaded successfully to ${tempVideoPath}`);
                resolve();
              });
            })
            .on("error", (err: Error) => {
              fs.unlink(tempVideoPath, () => {}); // Delete the file if download failed
              logger.error(err, "Error downloading video:");
              reject(err);
            });
        });

        excludeVideoIds.push(video.id);

        scenes.push({
          captions,
          video: `http://localhost:${this.config.port}/tmp/${tempVideoFileName}`,
          audio: {
            url: `http://localhost:${this.config.port}/tmp/${tempMp3FileName}`,
            duration: audioLength,
          },
        });

        totalDuration += audioLength;
      } catch (error) {
        logger.error({ error, scene, config }, "Error processing scene");
        throw error;
      }

      index++;
    }
    if (config.paddingBack) {
      totalDuration += config.paddingBack / 1000;
    }

    // Add detailed logging for duration issues
    logger.info({
      totalScenes: inputScenes.length,
      individualSceneDurations: scenes.map(s => s.audio.duration),
      totalDuration,
      paddingBack: config.paddingBack,
      estimatedVideoLength: `${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}`
    }, "Video duration calculation completed");

    // Validate minimum video duration
    if (totalDuration < 5) {
      logger.warn({ totalDuration }, "Video duration is very short (< 5 seconds), this might cause rendering issues");
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic, videoDuration: totalDuration }, "Selected music for the video");

    await this.remotion.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: config.paddingBack,
          ...{
            captionBackgroundColor: config.captionBackgroundColor,
            captionPosition: config.captionPosition,
          },
          musicVolume: config.musicVolume,
        },
      },
      videoId,
      orientation,
    );

    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    const videos: { id: string; status: VideoStatus }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push({ id: videoId, status });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ id: queueItem.id, status: "processing" });
      }
    }

    return videos;
  }
  
  public ListAvailableVoices(): string[] {
    return this.tts.listAvailableVoices();
  }

  public async getVoicesForProvider(provider: TTSProvider): Promise<string[]> {
    return this.tts.getAvailableVoices(provider);
  }

  private async isVoiceCompatibleWithProvider(voice: string, provider: TTSProvider): Promise<boolean> {
    try {
      const availableVoices = await this.tts.getAvailableVoices(provider);
      return availableVoices.includes(voice);
    } catch (error) {
      logger.warn({ voice, provider, error }, "Error checking voice compatibility, assuming incompatible");
      return false;
    }
  }

  private async getDefaultVoiceForProvider(provider: TTSProvider): Promise<string> {
    try {
      const availableVoices = await this.tts.getAvailableVoices(provider);
      if (availableVoices.length === 0) {
        throw new Error(`No voices available for provider ${provider}`);
      }
      
      // Return the first available voice as default
      return availableVoices[0];
    } catch (error) {
      logger.error({ provider, error }, "Error getting default voice for provider");
      
      // Fallback to hardcoded defaults based on provider
      switch (provider) {
        case TTSProvider.Kokoro:
          return TTSVoice.af_heart;
        case TTSProvider.Chatterbox:
          return TTSVoice.Rachel;
        case TTSProvider.OpenAIEdge:
          return "alloy"; // Use string literal since enum might not have this
        default:
          return TTSVoice.af_heart;
      }
    }
  }

  /**
   * Fallback method to get voice locale from static files
   */
  private async getVoiceLocaleFromFiles(voice: string): Promise<string | undefined> {
    const voiceConfigs: any[] = [];
    
    // Try to load all 3 voice config files
    const voiceFiles = [
      "voices/kokoro_voices.json",
      "voices/openai_edge_tts_voices.json", 
      "voices/chatterbox-predefined-voices.json"
    ];
    
    // Try multiple possible paths for voice config files
    const possibleBasePaths = ["", "../", "../../"];
    
    for (const file of voiceFiles) {
      for (const basePath of possibleBasePaths) {
        try {
          const filePath = path.resolve(basePath + file);
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf8");
            const parsed = JSON.parse(data);
            
            // Handle different file formats
            if (Array.isArray(parsed)) {
              voiceConfigs.push(parsed);
            } else if (parsed.voices && Array.isArray(parsed.voices)) {
              // chatterbox format: { "voices": [...] }
              voiceConfigs.push(parsed.voices.map((v: string) => ({ name: v, locale: "en-US" })));
            }
            
            logger.debug(`Loaded voice config from: ${filePath}`);
            break; // Found this file, stop trying other paths
          }
        } catch (error) {
          // Continue trying other paths
        }
      }
    }
    
    // Look for the voice in the loaded configs
    return Transcription.getVoiceLocale(voice, voiceConfigs);
  }
}
