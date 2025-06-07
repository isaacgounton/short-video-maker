import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";

import { Kokoro } from "./libraries/Kokoro";
import { TTSFactory, TTSService } from "./libraries/TTSFactory";
import { Remotion } from "./libraries/Remotion";
import { IWhisper } from "./libraries/IWhisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";
import { TTSEngineEnum } from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
    timestamp: number;
  }[] = [];
  private isProcessing = false;
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: IWhisper,
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
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
      timestamp: Date.now(),
    });
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        const currentItem = this.queue[0];
        const { sceneInput, config, id, timestamp } = currentItem;
        
        // Check for timeout (30 minutes)
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        if (now - timestamp > timeout) {
          logger.warn({ id, timestamp, now }, "Video processing timed out, removing from queue");
          this.queue.shift();
          continue;
        }
        
        logger.info({ id, queueLength: this.queue.length }, "Processing video item in the queue");
        
        try {
          await this.createShort(id, sceneInput, config);
          logger.info({ id }, "Video created successfully");
        } catch (error: unknown) {
          logger.error({ error, id }, "Error creating video, moving to next item");
        }
        
        // Remove the processed item from queue
        this.queue.shift();
      }
    } finally {
      this.isProcessing = false;
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

    // Get the TTS service based on the selected engine
    const ttsEngine = config.ttsEngine || TTSEngineEnum.kokoro;
    const ttsService = await TTSFactory.getTTSService(ttsEngine);
    
    let index = 0;
    for (const scene of inputScenes) {
      const audio = await ttsService.generate(
        scene.text,
        config.voice ?? "af_heart",
      );
      let { audioLength } = audio;
      const { audio: audioStream } = audio;

      // add the paddingBack in seconds to the last scene
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      const tempId = cuid();
      const tempWavFileName = `${tempId}.wav`;
      const tempMp3FileName = `${tempId}.mp3`;
      const tempVideoFileName = `${tempId}.mp4`;
      const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
      const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
      const tempVideoPath = path.join(
        this.config.tempDirPath,
        tempVideoFileName,
      );
      tempFiles.push(tempVideoPath);
      tempFiles.push(tempWavPath, tempMp3Path);

      await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
      const captions = await this.whisper.CreateCaption(tempWavPath);

      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      
      // Get actual audio duration from the processed file to fix scene cutting issues
      try {
        const actualDuration = await this.ffmpeg.getAudioDuration(tempMp3Path);
        if (actualDuration > 0) {
          logger.debug({
            originalDuration: audioLength,
            actualDuration,
            scene: scene.text.substring(0, 50) + "..."
          }, "Updated audio duration from FFmpeg");
          audioLength = actualDuration;
        }
      } catch (error) {
        logger.warn({ error, audioLength }, "Could not get actual audio duration, using estimated duration");
      }
      const video = await this.pexelsApi.findVideo(
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
        video: `http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`,
        audio: {
          url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
          duration: audioLength,
        },
      });

      totalDuration += audioLength;
      index++;
    }
    if (config.paddingBack) {
      totalDuration += config.paddingBack / 1000;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

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
    return this.kokoro.listAvailableVoices();
  }

  public async ListAvailableTTSEngines(): Promise<TTSEngineEnum[]> {
    return Object.values(TTSEngineEnum);
  }

  public async ListAvailableVoicesForEngine(engine: TTSEngineEnum): Promise<string[]> {
    try {
      const ttsService = await TTSFactory.getTTSService(engine);
      return ttsService.listAvailableVoices();
    } catch (error) {
      logger.error({ engine, error }, "Failed to get voices for TTS engine");
      return [];
    }
  }

  public ListAvailableVoicesForEngineFast(engine: TTSEngineEnum): string[] {
    // Fast fallback method that doesn't trigger service initialization
    const fallbackVoices: { [key: string]: string[] } = {
      kokoro: ["af_heart", "af_alloy", "af_nova", "am_adam", "am_echo", "bm_lewis", "bf_emma"],
      "edge-tts": [
        "en-US-AriaNeural", "en-US-JennyNeural", "en-US-GuyNeural",
        "fr-FR-DeniseNeural", "fr-CA-AntoineNeural", "es-ES-ElviraNeural",
        "de-DE-KatjaNeural", "it-IT-ElsaNeural", "pt-BR-FranciscaNeural"
      ],
      "streamlabs-polly": ["Joanna", "Matthew", "Amy", "Brian", "Emma"],
      "openai-edge-tts": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    };
    
    return fallbackVoices[engine] || [];
  }

  public ListAllAvailableVoicesFast(): Record<string, string[]> {
    // Fast fallback method that doesn't trigger service initialization
    return {
      kokoro: ["af_heart", "af_alloy", "af_nova", "am_adam", "am_echo", "bm_lewis", "bf_emma"],
      "edge-tts": [
        "en-US-AriaNeural", "en-US-JennyNeural", "en-US-GuyNeural",
        "fr-FR-DeniseNeural", "fr-CA-AntoineNeural", "es-ES-ElviraNeural",
        "de-DE-KatjaNeural", "it-IT-ElsaNeural", "pt-BR-FranciscaNeural"
      ],
      "streamlabs-polly": ["Joanna", "Matthew", "Amy", "Brian", "Emma"],
      "openai-edge-tts": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    };
  }

  public async ListAllAvailableVoices(): Promise<Record<string, string[]>> {
    try {
      const allVoices = await TTSFactory.getAllAvailableVoices();
      return allVoices as Record<string, string[]>;
    } catch (error) {
      logger.error({ error }, "Failed to get all available voices");
      return {};
    }
  }

  // Admin methods for queue management
  public getQueueStatus(): { queueLength: number; isProcessing: boolean; items: Array<{id: string; timestamp: number; age: number}> } {
    const now = Date.now();
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      items: this.queue.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        age: now - item.timestamp
      }))
    };
  }

  public clearStuckVideos(): { removed: number; clearedProcessing: boolean } {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    const initialLength = this.queue.length;
    
    // Remove timed out items
    this.queue = this.queue.filter(item => {
      const isTimedOut = now - item.timestamp > timeout;
      if (isTimedOut) {
        logger.warn({ id: item.id, age: now - item.timestamp }, "Removing timed out video from queue");
      }
      return !isTimedOut;
    });
    
    const removed = initialLength - this.queue.length;
    
    // Reset processing flag if queue is empty
    let clearedProcessing = false;
    if (this.queue.length === 0 && this.isProcessing) {
      this.isProcessing = false;
      clearedProcessing = true;
      logger.info("Reset processing flag due to empty queue");
    }
    
    return { removed, clearedProcessing };
  }

  public forceRestartQueue(): void {
    logger.info("Force restarting queue processing");
    this.isProcessing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}
