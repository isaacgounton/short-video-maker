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
            description: "List all available TTS voices for all engines",
            parameters: {}
          },
          {
            name: "list-voices-for-engine",
            description: "List available voices for a specific TTS engine",
            parameters: {
              engine: "TTS engine name (kokoro, edge-tts, streamlabs-polly, openai-edge-tts)"
            }
          },
          {
            name: "list-tts-engines",
            description: "List all available TTS engines",
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
            description: "Get example voices for different languages and TTS engines",
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
      async ({ videoId }: { videoId: string }) => {
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
      async ({ scenes, config }: { scenes: any; config: any }) => {
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

    this.mcpServer.tool(
      "list-available-voices",
      "List all available TTS voices for all engines (uses cached/fallback voices for speed)",
      {},
      async () => {
        // Use the fast method that doesn't trigger service initialization
        const voices = this.shortCreator.ListAllAvailableVoicesFast();
        
        return {
          content: [
            {
            type: "text",
            text: JSON.stringify({
              ...voices,
              note: "Fast fallback voices - all engines available"
            }, null, 2)
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "list-voices-for-engine",
      "List available voices for a specific TTS engine (uses cached/fallback voices for speed)",
      {
        engine: z.enum(["kokoro", "edge-tts", "streamlabs-polly", "openai-edge-tts"]).describe("TTS engine name"),
      },
      async ({ engine }: { engine?: string }) => {
        // Use the fast method that doesn't trigger service initialization
        const voices = this.shortCreator.ListAvailableVoicesForEngineFast((engine || "kokoro") as any);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                engine,
                voices,
                note: "Fast fallback voices - no API calls required"
              }, null, 2)
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
        try {
          // Use a timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), 3000);
          });
          
          const enginesPromise = this.shortCreator.ListAvailableTTSEngines();
          const engines = await Promise.race([enginesPromise, timeoutPromise]);
          
          return {
            content: [
              {
              type: "text",
              text: JSON.stringify({ engines }, null, 2)
              },
            ],
          };
        } catch (error) {
          // Fallback to basic engine list
          const fallbackEngines = ["kokoro", "edge-tts", "streamlabs-polly", "openai-edge-tts"];
          
          return {
            content: [
              {
              type: "text",
              text: JSON.stringify({ 
                engines: fallbackEngines,
                note: "Fallback engines listed due to API timeout"
              }, null, 2)
              },
            ],
          };
        }
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

    this.mcpServer.tool(
      "get-voice-examples",
      "Get example voices for different languages and TTS engines",
      {},
      async () => {
        const voiceExamples = {
          "English": {
            "kokoro": ["af_heart", "am_adam", "bm_lewis", "bf_emma"],
            "edge-tts": ["en-US-AriaNeural", "en-US-JennyNeural", "en-GB-SoniaNeural", "en-CA-ClaraNeural"],
            "streamlabs-polly": ["Joanna", "Matthew", "Amy", "Brian"],
            "openai-edge-tts": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
          },
          "French": {
            "edge-tts": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural", "fr-CA-AntoineNeural", "fr-CA-SylvieNeural"],
            "note": "Use edge-tts for French voices. DO NOT use fr-FR-Standard-A (that's Google Cloud format)"
          },
          "Spanish": {
            "edge-tts": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural", "es-MX-DaliaNeural", "es-MX-JorgeNeural"]
          },
          "German": {
            "edge-tts": ["de-DE-KatjaNeural", "de-DE-ConradNeural", "de-AT-IngridNeural"]
          },
          "Italian": {
            "edge-tts": ["it-IT-ElsaNeural", "it-IT-IsabellaNeural", "it-IT-DiegoNeural"]
          },
          "Portuguese": {
            "edge-tts": ["pt-BR-FranciscaNeural", "pt-BR-AntonioNeural", "pt-PT-RaquelNeural"]
          },
          "Japanese": {
            "edge-tts": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural", "ja-JP-AoiNeural"]
          },
          "Chinese": {
            "edge-tts": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-TW-HsiaoChenNeural"]
          },
          "Arabic": {
            "edge-tts": ["ar-SA-ZariyahNeural", "ar-SA-HamedNeural", "ar-EG-ShakirNeural"]
          },
          "IMPORTANT_NOTES": {
            "voice_format_warning": "Each TTS engine uses different voice naming formats!",
            "kokoro": "Uses internal names like af_heart, am_adam",
            "edge-tts": "Uses Microsoft format like en-US-AriaNeural, fr-FR-DeniseNeural", 
            "streamlabs-polly": "Uses Amazon Polly names like Joanna, Matthew",
            "common_mistake": "Do NOT mix voice formats! fr-FR-Standard-A is Google Cloud format and will fail with edge-tts"
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
    this.router.get("/sse", async (req: any, res: any) => {
      logger.info("SSE GET request received");

      const transport = new SSEServerTransport("/mcp/messages", res);
      this.transports[transport.sessionId] = transport;
      res.on("close", () => {
        delete this.transports[transport.sessionId];
      });
      await this.mcpServer.connect(transport);
    });

    this.router.post("/messages", async (req: any, res: any) => {
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
