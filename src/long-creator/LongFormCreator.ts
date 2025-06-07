/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";

import { TTSFactory } from "../short-creator/libraries/TTSFactory";
import { IWhisper } from "../short-creator/libraries/IWhisper";
import { FFMpeg } from "../short-creator/libraries/FFmpeg";
import { PexelsAPI } from "../short-creator/libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "../short-creator/music";
import {
  LongFormSceneInput,
  LongFormRenderConfig,
  LongFormScene,
  LongFormVideoStatus,
  LongFormVideoMetadata,
} from "../types/longform";
import { TTSEngineEnum, MusicMoodEnum, OrientationEnum, type MusicForVideo } from "../types/shorts";
import { LongFormRemotionRenderer } from "./LongFormRemotionRenderer";

export class LongFormCreator {
  private queue: {
    sceneInput: LongFormSceneInput[];
    config: LongFormRenderConfig;
    id: string;
    timestamp: number;
  }[] = [];
  private isProcessing = false;
  
  constructor(
    private config: Config,
    private longFormRenderer: LongFormRemotionRenderer,
    private whisper: IWhisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): LongFormVideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return LongFormVideoStatus.processing;
    }
    if (fs.existsSync(videoPath)) {
      return LongFormVideoStatus.ready;
    }
    return LongFormVideoStatus.failed;
  }

  public addToQueue(sceneInput: LongFormSceneInput[], config: LongFormRenderConfig): string {
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
        
        // Check for timeout (45 minutes for long-form videos)
        const now = Date.now();
        const timeout = 45 * 60 * 1000; // 45 minutes
        if (now - timestamp > timeout) {
          logger.warn({ id, timestamp, now }, "Long-form video processing timed out, removing from queue");
          this.queue.shift();
          continue;
        }
        
        logger.info({ id, queueLength: this.queue.length }, "Processing long-form video item in the queue");
        
        try {
          await this.createLongForm(id, sceneInput, config);
          logger.info({ id }, "Long-form video created successfully");
        } catch (error: unknown) {
          logger.error({ error, id }, "Error creating long-form video, moving to next item");
        }
        
        // Remove the processed item from queue
        this.queue.shift();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async createLongForm(
    videoId: string,
    inputScenes: LongFormSceneInput[],
    config: LongFormRenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating long-form video",
    );
    
    const scenes: LongFormScene[] = [];
    let totalDuration = 0;
    const excludeVideoIds = [];
    const tempFiles = [];

    // Get the TTS service based on the selected engine
    const ttsEngine = config.ttsEngine || TTSEngineEnum.kokoro;
    const ttsService = await TTSFactory.getTTSService(ttsEngine);
    
    // Download person image
    const personImageTempId = cuid();
    const personImageFileName = `${personImageTempId}.jpg`;
    const personImagePath = path.join(this.config.tempDirPath, personImageFileName);
    tempFiles.push(personImagePath);
    
    await this.downloadFile(config.personImageUrl, personImagePath);

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
      tempFiles.push(tempVideoPath, tempWavPath, tempMp3Path);

      await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
      const captions = await this.whisper.CreateCaption(tempWavPath);

      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      
      // Get actual audio duration from the processed file
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

      // For long-form videos, use landscape orientation
      const video = await this.pexelsApi.findVideo(
        scene.searchTerms,
        audioLength,
        excludeVideoIds,
        OrientationEnum.landscape, // Always use landscape for long-form videos
      );

      logger.debug(`Downloading video from ${video.url} to ${tempVideoPath}`);
      await this.downloadFile(video.url, tempVideoPath);
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
    logger.debug({ selectedMusic }, "Selected music for the long-form video");

    await this.longFormRenderer.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: config.paddingBack,
          musicVolume: config.musicVolume,
          personImageUrl: `http://localhost:${this.config.port}/api/tmp/${personImageFileName}`,
          personName: config.personName,
          nameBannerColor: config.nameBannerColor || "#FF4444",
          personOverlaySize: config.personOverlaySize || 0.25,
        },
      },
      videoId,
    );

    // Clean up temp files
    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  private async downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const fileStream = fs.createWriteStream(filePath);
      const protocol = url.startsWith('https:') ? https : http;
      
      protocol
        .get(url, (response: http.IncomingMessage) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download file: ${response.statusCode}`),
            );
            return;
          }

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            logger.debug(`File downloaded successfully to ${filePath}`);
            resolve();
          });
        })
        .on("error", (err: Error) => {
          fs.unlink(filePath, () => {}); // Delete the file if download failed
          logger.error(err, "Error downloading file:");
          reject(err);
        });
    });
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `longform_${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted long-form video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Long-form video ${videoId} not found`);
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

  public listAllVideos(): LongFormVideoMetadata[] {
    const videos: LongFormVideoMetadata[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for long-form MP4 files and extract video IDs
    for (const file of files) {
      if (file.startsWith("longform_") && file.endsWith(".mp4")) {
        const videoId = file.replace("longform_", "").replace(".mp4", "");

        let status: LongFormVideoStatus = LongFormVideoStatus.ready;
        const inQueue = this.queue.find((item) => item.id === videoId);
        
        // Get file stats for metadata
        const filePath = path.join(this.config.videosDirPath, file);
        const stats = fs.statSync(filePath);
        
        if (inQueue) {
          status = LongFormVideoStatus.processing;
        }

        videos.push({ 
          id: videoId, 
          status,
          personName: inQueue?.config.personName || "Unknown",
          createdAt: stats.birthtime,
          scenes: inQueue?.sceneInput.length || 0
        });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ 
          id: queueItem.id, 
          status: LongFormVideoStatus.processing,
          personName: queueItem.config.personName,
          createdAt: new Date(queueItem.timestamp),
          scenes: queueItem.sceneInput.length
        });
      }
    }

    return videos;
  }

  // Admin methods for queue management
  public getQueueStatus(): { queueLength: number; isProcessing: boolean; items: Array<{id: string; timestamp: number; age: number; personName: string}> } {
    const now = Date.now();
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      items: this.queue.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        age: now - item.timestamp,
        personName: item.config.personName
      }))
    };
  }

  public clearStuckVideos(): { removed: number; clearedProcessing: boolean } {
    const now = Date.now();
    const timeout = 45 * 60 * 1000; // 45 minutes
    const initialLength = this.queue.length;
    
    // Remove timed out items
    this.queue = this.queue.filter(item => {
      const isTimedOut = now - item.timestamp > timeout;
      if (isTimedOut) {
        logger.warn({ id: item.id, age: now - item.timestamp }, "Removing timed out long-form video from queue");
      }
      return !isTimedOut;
    });
    
    const removed = initialLength - this.queue.length;
    
    // Reset processing flag if queue is empty
    let clearedProcessing = false;
    if (this.queue.length === 0 && this.isProcessing) {
      this.isProcessing = false;
      clearedProcessing = true;
      logger.info("Reset long-form processing flag due to empty queue");
    }
    
    return { removed, clearedProcessing };
  }

  public forceRestartQueue(): void {
    logger.info("Force restarting long-form queue processing");
    this.isProcessing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}
