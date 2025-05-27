import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import fs from "fs-extra";
import path from "path";

import { validateCreateShortInput } from "../validator";
import { ShortCreator } from "../../short-creator/ShortCreator";
import { logger } from "../../logger";
import { Config } from "../../config";

// todo abstract class
export class APIRouter {
  public router: express.Router;
  private shortCreator: ShortCreator;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.router = express.Router();
    this.shortCreator = shortCreator;

    this.router.use(express.json());

    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post(
      "/short-video",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const input = validateCreateShortInput(req.body);

          logger.info({ input }, "Creating short video");

          const videoId = this.shortCreator.addToQueue(
            input.scenes,
            input.config,
          );

          res.status(201).json({
            videoId,
          });
        } catch (error: unknown) {
          logger.error(error, "Error validating input");

          // Handle validation errors specifically
          if (error instanceof Error && error.message.startsWith("{")) {
            try {
              const errorData = JSON.parse(error.message);
              res.status(400).json({
                error: "Validation failed",
                message: errorData.message,
                missingFields: errorData.missingFields,
              });
              return;
            } catch (parseError: unknown) {
              logger.error(parseError, "Error parsing validation error");
            }
          }

          // Fallback for other errors
          res.status(400).json({
            error: "Invalid input",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    this.router.get(
      "/short-video/:videoId/status",
      async (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        const status = this.shortCreator.status(videoId);
        res.status(200).json({
          status,
        });
      },
    );

    this.router.get(
      "/music-tags",
      (req: ExpressRequest, res: ExpressResponse) => {
        res.status(200).json(this.shortCreator.ListAvailableMusicTags());
      },
    );

    this.router.get("/voices", (req: ExpressRequest, res: ExpressResponse) => {
      res.status(200).json(this.shortCreator.ListAvailableVoices());
    });

    // TTS-related endpoints
    this.router.get("/tts-engines", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const engines = await this.shortCreator.ListAvailableTTSEngines();
        res.status(200).json({ engines });
      } catch (error: unknown) {
        logger.error(error, "Error getting TTS engines");
        res.status(500).json({
          error: "Failed to get TTS engines",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.get("/tts-voices", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const allVoices = await this.shortCreator.ListAllAvailableVoices();
        res.status(200).json({ voices: allVoices });
      } catch (error: unknown) {
        logger.error(error, "Error getting all TTS voices");
        res.status(500).json({
          error: "Failed to get TTS voices",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.get("/tts-voices/:engine", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { engine } = req.params;
        if (!engine) {
          res.status(400).json({ error: "TTS engine is required" });
          return;
        }
        
        const voices = await this.shortCreator.ListAvailableVoicesForEngine(engine as any);
        res.status(200).json({ voices });
      } catch (error: unknown) {
        logger.error(error, "Error getting TTS voices for engine");
        res.status(500).json({
          error: "Failed to get TTS voices for engine",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.get(
      "/short-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        const videos = this.shortCreator.listAllVideos();
        res.status(200).json({
          videos,
        });
      },
    );

    this.router.delete(
      "/short-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        this.shortCreator.deleteVideo(videoId);
        res.status(200).json({
          success: true,
        });
      },
    );

    this.router.get(
      "/tmp/:tmpFile",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { tmpFile } = req.params;
        if (!tmpFile) {
          res.status(400).json({
            error: "tmpFile is required",
          });
          return;
        }
        const tmpFilePath = path.join(this.config.tempDirPath, tmpFile);
        if (!fs.existsSync(tmpFilePath)) {
          res.status(404).json({
            error: "tmpFile not found",
          });
          return;
        }

        if (tmpFile.endsWith(".mp3")) {
          res.setHeader("Content-Type", "audio/mpeg");
        }
        if (tmpFile.endsWith(".wav")) {
          res.setHeader("Content-Type", "audio/wav");
        }
        if (tmpFile.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
        }

        const tmpFileStream = fs.createReadStream(tmpFilePath);
        tmpFileStream.on("error", (error) => {
          logger.error(error, "Error reading tmp file");
          res.status(500).json({
            error: "Error reading tmp file",
            tmpFile,
          });
        });
        tmpFileStream.pipe(res);
      },
    );

    this.router.get(
      "/music/:fileName",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { fileName } = req.params;
        if (!fileName) {
          res.status(400).json({
            error: "fileName is required",
          });
          return;
        }
        const musicFilePath = path.join(this.config.musicDirPath, fileName);
        if (!fs.existsSync(musicFilePath)) {
          res.status(404).json({
            error: "music file not found",
          });
          return;
        }
        const musicFileStream = fs.createReadStream(musicFilePath);
        musicFileStream.on("error", (error) => {
          logger.error(error, "Error reading music file");
          res.status(500).json({
            error: "Error reading music file",
            fileName,
          });
        });
        musicFileStream.pipe(res);
      },
    );

    this.router.get(
      "/short-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          const video = this.shortCreator.getVideo(videoId);
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader(
            "Content-Disposition",
            `inline; filename=${videoId}.mp4`,
          );
          res.send(video);
        } catch (error: unknown) {
          logger.error(error, "Error getting video");
          res.status(404).json({
            error: "Video not found",
          });
        }
      },
    );

    // Admin endpoints for queue management
    this.router.get(
      "/admin/queue-status",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const status = this.shortCreator.getQueueStatus();
          res.status(200).json(status);
        } catch (error: unknown) {
          logger.error(error, "Error getting queue status");
          res.status(500).json({
            error: "Failed to get queue status",
          });
        }
      },
    );

    this.router.post(
      "/admin/clear-stuck-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const result = this.shortCreator.clearStuckVideos();
          res.status(200).json({
            message: "Cleared stuck videos",
            ...result,
          });
        } catch (error: unknown) {
          logger.error(error, "Error clearing stuck videos");
          res.status(500).json({
            error: "Failed to clear stuck videos",
          });
        }
      },
    );

    this.router.post(
      "/admin/restart-queue",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          this.shortCreator.forceRestartQueue();
          res.status(200).json({
            message: "Queue processing restarted",
          });
        } catch (error: unknown) {
          logger.error(error, "Error restarting queue");
          res.status(500).json({
            error: "Failed to restart queue",
          });
        }
      },
    );
  }
}
