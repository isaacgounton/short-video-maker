import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import fs from "fs-extra";
import path from "path";

import { validateCreateLongFormInput } from "../longFormValidator";
import { LongFormCreator } from "../../long-creator/LongFormCreator";
import { logger } from "../../logger";
import { Config } from "../../config";

export class LongFormAPIRouter {
  public router: express.Router;
  private longFormCreator: LongFormCreator;
  private config: Config;

  constructor(config: Config, longFormCreator: LongFormCreator) {
    this.config = config;
    this.router = express.Router();
    this.longFormCreator = longFormCreator;

    this.router.use(express.json());

    this.setupRoutes();
  }

  private setupRoutes() {
    // Create long-form video
    this.router.post(
      "/long-form-video",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const input = validateCreateLongFormInput(req.body);

          logger.info({ input }, "Creating long-form video");

          const videoId = this.longFormCreator.addToQueue(
            input.scenes,
            input.config,
          );

          res.status(201).json({
            videoId,
          });
        } catch (error: unknown) {
          logger.error(error, "Error validating long-form input");

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

    // Get long-form video status
    this.router.get(
      "/long-form-video/:videoId/status",
      async (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        const status = this.longFormCreator.status(videoId);
        res.status(200).json({
          status,
        });
      },
    );

    // List all long-form videos
    this.router.get(
      "/long-form-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        const videos = this.longFormCreator.listAllVideos();
        res.status(200).json({
          videos,
        });
      },
    );

    // Delete long-form video
    this.router.delete(
      "/long-form-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        this.longFormCreator.deleteVideo(videoId);
        res.status(200).json({
          success: true,
        });
      },
    );

    // Get long-form video file
    this.router.get(
      "/long-form-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          const video = this.longFormCreator.getVideo(videoId);
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader(
            "Content-Disposition",
            `inline; filename=longform_${videoId}.mp4`,
          );
          res.send(video);
        } catch (error: unknown) {
          logger.error(error, "Error getting long-form video");
          res.status(404).json({
            error: "Video not found",
          });
        }
      },
    );

    // Admin endpoints for long-form queue management
    this.router.get(
      "/admin/long-form-queue-status",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const status = this.longFormCreator.getQueueStatus();
          res.status(200).json(status);
        } catch (error: unknown) {
          logger.error(error, "Error getting long-form queue status");
          res.status(500).json({
            error: "Failed to get queue status",
          });
        }
      },
    );

    this.router.post(
      "/admin/clear-stuck-long-form-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const result = this.longFormCreator.clearStuckVideos();
          res.status(200).json({
            message: "Cleared stuck long-form videos",
            ...result,
          });
        } catch (error: unknown) {
          logger.error(error, "Error clearing stuck long-form videos");
          res.status(500).json({
            error: "Failed to clear stuck videos",
          });
        }
      },
    );

    this.router.post(
      "/admin/restart-long-form-queue",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          this.longFormCreator.forceRestartQueue();
          res.status(200).json({
            message: "Long-form queue processing restarted",
          });
        } catch (error: unknown) {
          logger.error(error, "Error restarting long-form queue");
          res.status(500).json({
            error: "Failed to restart queue",
          });
        }
      },
    );
  }
}
