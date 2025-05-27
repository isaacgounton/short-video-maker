import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import z from "zod";

import { ShortCreator } from "../../short-creator/ShortCreator";
import { logger } from "../../logger";
import { renderConfig, sceneInput } from "../../types/shorts";

export class MCPRouter {
  router: express.Router;
  shortCreator: ShortCreator;
  transports: { [sessionId: string]: SSEServerTransport } = {};
  mcpServer: McpServer;
  constructor(shortCreator: ShortCreator) {
    this.router = express.Router();
    this.shortCreator = shortCreator;

    this.mcpServer = new McpServer({
      name: "Short Creator",
      version: "0.0.1",
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    this.setupMCPServer();
    this.setupRoutes();
  }

  private setupMCPServer() {
    this.mcpServer.tool(
      "get-video-status",
      "Get the status of a video (ready, processing, failed)",
      {
        videoId: z.string().describe("The ID of the video"),
      },
      async ({ videoId }) => {
        const status = this.shortCreator.status(videoId);
        return {
          content: [
            {
              type: "text",
              text: status,
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "create-short-video",
      "Create a short video from a list of scenes",
      {
        scenes: z.array(sceneInput).describe("Each scene to be created"),
        config: renderConfig.describe("Configuration for rendering the video"),
      },
      async ({ scenes, config }) => {
        const videoId = await this.shortCreator.addToQueue(scenes, config);

        return {
          content: [
            {
              type: "text",
              text: videoId,
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-available-voices",
      "List all available TTS voices for all engines",
      {},
      async () => {
        const allVoices = await this.shortCreator.ListAllAvailableVoices();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(allVoices, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-voices-for-engine",
      "List available voices for a specific TTS engine",
      {
        engine: z.enum(["kokoro", "edge-tts", "streamlabs-polly"]).describe("TTS engine name"),
      },
      async ({ engine }) => {
        const voices = await this.shortCreator.ListAvailableVoicesForEngine(engine as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ engine, voices }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-tts-engines",
      "List all available TTS engines",
      {},
      async () => {
        const engines = await this.shortCreator.ListAvailableTTSEngines();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ engines }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-all-videos",
      "List all videos in the system with their status",
      {},
      async () => {
        const videos = this.shortCreator.listAllVideos();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ videos }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-music-tags",
      "List all available music mood tags",
      {},
      async () => {
        const musicTags = this.shortCreator.ListAvailableMusicTags();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ musicTags }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "get-queue-status",
      "Get the current status of the video processing queue (admin tool)",
      {},
      async () => {
        const queueStatus = this.shortCreator.getQueueStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(queueStatus, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "clear-stuck-videos",
      "Remove videos that have been stuck in the queue for more than 30 minutes (admin tool)",
      {},
      async () => {
        const result = this.shortCreator.clearStuckVideos();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "restart-queue",
      "Force restart the video processing queue (admin tool)",
      {},
      async () => {
        this.shortCreator.forceRestartQueue();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ message: "Queue processing restarted successfully" }, null, 2),
            },
          ],
        };
      },
    );
  }

  private setupRoutes() {
    this.router.get("/sse", async (req, res) => {
      logger.info("SSE GET request received");

      const transport = new SSEServerTransport("/mcp/messages", res);
      this.transports[transport.sessionId] = transport;
      res.on("close", () => {
        delete this.transports[transport.sessionId];
      });
      await this.mcpServer.connect(transport);
    });

    this.router.post("/messages", async (req, res) => {
      logger.info("SSE POST request received");

      const sessionId = req.query.sessionId as string;
      const transport = this.transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).send("No transport found for sessionId");
      }
    });
  }
}
