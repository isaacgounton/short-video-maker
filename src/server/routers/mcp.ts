import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import z from "zod";

import { ShortCreator } from "../../short-creator/ShortCreator";
import { logger } from "../../logger";
import { renderConfig, sceneInput, TTSProvider } from "../../types/shorts";

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
      "list-tts-providers",
      "List all available TTS (Text-to-Speech) providers",
      {},
      async () => {
        const providers = Object.values(TTSProvider);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ providers }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-voices-for-provider",
      "List all available voices for a specific TTS provider",
      {
        provider: z.nativeEnum(TTSProvider).describe("The TTS provider to get voices for"),
      },
      async ({ provider }) => {
        try {
          const voices = await this.shortCreator.getVoicesForProvider(provider);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ provider, voices }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching voices for provider ${provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    this.mcpServer.tool(
      "list-all-voices",
      "List all available voices across all TTS providers",
      {},
      async () => {
        const voices = this.shortCreator.ListAvailableVoices();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ voices }, null, 2),
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
