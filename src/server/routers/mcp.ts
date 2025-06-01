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
      "list-tools",
      "List all available MCP tools with their descriptions and parameters",
      {},
      async () => {
        const tools = [
          {
            name: "get-video-status",
            description: "Get the status of a video (ready, processing, failed)",
            parameters: {
              videoId: "The ID of the video"
            }
          },
          {
            name: "create-short-video",
            description: "Create a short video from a list of scenes",
            parameters: {
              scenes: "Each scene to be created",
              config: "Configuration for rendering the video"
            }
          },
          {
            name: "list-available-voices",
            description: "List all available OpenAI Edge TTS voices",
            parameters: {}
          },
          {
            name: "list-all-videos",
            description: "List all videos in the system with their status",
            parameters: {}
          },
          {
            name: "list-music-tags",
            description: "List all available music mood tags",
            parameters: {}
          },
          {
            name: "get-queue-status",
            description: "Get the current status of the video processing queue (admin tool)",
            parameters: {}
          },
          {
            name: "clear-stuck-videos",
            description: "Remove videos stuck in the queue for more than 30 minutes (admin tool)",
            parameters: {}
          },
          {
            name: "restart-queue",
            description: "Force restart the video processing queue (admin tool)",
            parameters: {}
          },
          {
            name: "get-voice-examples",
            description: "Get example voices for different languages using OpenAI Edge TTS",
            parameters: {}
          }
        ];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ tools }, null, 2)
            },
          ],
        };
      },
    );

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
              text: JSON.stringify({ status }, null, 2)
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
              text: JSON.stringify({ videoId }, null, 2)
            },
          ],
        };
      },
    );

    this.mcpServer.tool(      "list-available-voices",
      "List all available voices",
      {},
      async () => {
        const voices = this.shortCreator.ListAvailableVoices();
        
        return {
          content: [
            {
            type: "text",
            text: JSON.stringify({
              voices,
              note: "Using Azure TTS voices (format: [language-region]-[VoiceName]Neural, e.g., en-US-AriaNeural)"
            }, null, 2)
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
              text: JSON.stringify({ videos }, null, 2)
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
              text: JSON.stringify({ musicTags }, null, 2)
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
              text: JSON.stringify(queueStatus, null, 2)
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
              text: JSON.stringify(result, null, 2)
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
              text: JSON.stringify({ message: "Queue processing restarted successfully" }, null, 2)
            },
          ],
        };
      },
    );

    this.mcpServer.tool(      "get-voice-examples",
      "Get example voices for different languages",
      {},
      async () => {
        const voiceExamples = {
          "Language Examples": {
            "voices": {
              "English (US)": ["en-US-AriaNeural", "en-US-JennyNeural", "en-US-GuyNeural"],
              "French": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural", "fr-CA-JeanNeural"],
              "Spanish": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural", "es-MX-DaliaNeural"],
              "German": ["de-DE-KatjaNeural", "de-DE-ConradNeural"],
              "Italian": ["it-IT-ElsaNeural", "it-IT-DiegoNeural"],
              "Japanese": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"],
              "Chinese": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
              "Arabic": ["ar-SA-ZariyahNeural", "ar-SA-HamedNeural"]
            },
            "recommended": "en-US-AriaNeural",
            "note": "All voices in [language-region]-[VoiceName]Neural format"
          }
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(voiceExamples, null, 2)
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
