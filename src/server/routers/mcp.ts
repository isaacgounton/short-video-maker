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

    // Add voice documentation resource
    this.mcpServer.resource(
      "voice-provider-guide",
      "voice-provider://guide",
      {
        name: "Voice Provider Guide",
        description: "Complete guide for TTS voice and provider combinations",
        mimeType: "text/markdown"
      },
      async () => {
        const providers = Object.values(TTSProvider);
        const voiceMapping: { [provider: string]: string[] } = {};
        
        for (const provider of providers) {
          try {
            voiceMapping[provider] = await this.shortCreator.getVoicesForProvider(provider);
          } catch (error) {
            voiceMapping[provider] = [];
          }
        }

        let guide = "# TTS Voice and Provider Guide\n\n";
        guide += "This guide shows which voices are available for each TTS provider.\n\n";
        guide += "## Important: Voice-Provider Compatibility\n\n";
        guide += "Each TTS provider has its own set of voices. You MUST use the correct voice for each provider.\n\n";
        
        for (const provider of providers) {
          guide += `## ${provider.toUpperCase()} Provider\n\n`;
          guide += `Available voices for ${provider}:\n\n`;
          
          if (voiceMapping[provider].length > 0) {
            for (const voice of voiceMapping[provider]) {
              guide += `- \`${voice}\`\n`;
            }
          } else {
            guide += "- No voices available or error fetching voices\n";
          }
          guide += "\n";
        }
        
        guide += "## Usage Examples\n\n";
        guide += "✅ **Correct Usage:**\n";
        guide += "- Provider: `kokoro`, Voice: `af_heart`\n";
        guide += "- Provider: `openai-edge-tts`, Voice: `en-US-JennyNeural`\n\n";
        guide += "❌ **Incorrect Usage:**\n";
        guide += "- Provider: `kokoro`, Voice: `en-US-Neural2-D` (this voice doesn't exist in kokoro)\n";
        guide += "- Provider: `openai-edge-tts`, Voice: `af_heart` (this voice doesn't exist in openai-edge-tts)\n\n";
        guide += "## Predefined Voice Recommendations\n\n";
        guide += "Use the `get-predefined-voices-by-language` tool to get recommended voices organized by language.\n\n";
        guide += "**Quick Reference:**\n";
        guide += "- **English**: kokoro (af_heart - best quality), openai-edge-tts (alloy, echo, fable), chatterbox (Emily.wav, Michael.wav)\n";
        guide += "- **Other Languages**: Use openai-edge-tts exclusively for French, Spanish, German, Italian, Portuguese, Japanese, Chinese, Arabic\n\n";
        guide += "## Best Practices\n\n";
        guide += "1. Use `get-predefined-voices-by-language` for quick access to recommended voices\n";
        guide += "2. Use `list-voices-for-provider` to get complete current voice lists\n";
        guide += "3. For English content: prefer kokoro (af_heart) for best quality\n";
        guide += "4. For non-English content: use openai-edge-tts provider exclusively\n";

        return {
          contents: [
            {
              uri: "voice-provider://guide",
              text: guide,
              mimeType: "text/markdown"
            }
          ]
        };
      }
    );

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
      "List all available voices across all TTS providers with provider mapping",
      {},
      async () => {
        const providers = Object.values(TTSProvider);
        const voiceMapping: { [provider: string]: string[] } = {};
        
        for (const provider of providers) {
          try {
            voiceMapping[provider] = await this.shortCreator.getVoicesForProvider(provider);
          } catch (error) {
            voiceMapping[provider] = [];
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ 
                voiceMapping,
                guidance: "Each provider has specific voices. Always use list-voices-for-provider to get valid voices for your chosen provider."
              }, null, 2),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      "get-predefined-voices-by-language",
      "Get predefined voice recommendations organized by language and provider",
      {},
      async () => {
        const predefinedVoices = {
          "English": {
            "kokoro": ["af_heart", "af_alloy", "af_aoede"],
            "openai-edge-tts": ["alloy", "echo", "fable"],
            "chatterbox": ["Emily.wav", "Michael.wav", "Alice.wav", "Connor.wav", "Olivia.wav", "Ryan.wav"],
            "note": "Kokoro: af_heart is Grade A quality. OpenAI Edge TTS voices are OpenAI-compatible. Chatterbox uses .wav extension."
          },
          "French": {
            "openai-edge-tts": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural", "fr-CA-AntoineNeural", "fr-CA-SylvieNeural"],
            "note": "Use openai-edge-tts for French voices. Available through Edge TTS integration."
          },
          "Spanish": {
            "openai-edge-tts": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural", "es-MX-DaliaNeural", "es-MX-JorgeNeural"],
            "note": "Use openai-edge-tts for Spanish voices. ES = Spain, MX = Mexico variants."
          },
          "German": {
            "openai-edge-tts": ["de-DE-KatjaNeural", "de-DE-ConradNeural", "de-AT-IngridNeural"],
            "note": "Use openai-edge-tts for German voices. DE = Germany, AT = Austria variants."
          },
          "Italian": {
            "openai-edge-tts": ["it-IT-ElsaNeural", "it-IT-IsabellaNeural", "it-IT-DiegoNeural"],
            "note": "Use openai-edge-tts for Italian voices."
          },
          "Portuguese": {
            "openai-edge-tts": ["pt-BR-FranciscaNeural", "pt-BR-AntonioNeural", "pt-PT-RaquelNeural"],
            "note": "Use openai-edge-tts for Portuguese voices. BR = Brazil, PT = Portugal variants."
          },
          "Japanese": {
            "openai-edge-tts": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural", "ja-JP-AoiNeural"],
            "note": "Use openai-edge-tts for Japanese voices."
          },
          "Chinese": {
            "openai-edge-tts": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-TW-HsiaoChenNeural"],
            "note": "Use openai-edge-tts for Chinese voices. CN = Mainland China, TW = Taiwan variants."
          },
          "Arabic": {
            "openai-edge-tts": ["ar-SA-ZariyahNeural", "ar-SA-HamedNeural", "ar-EG-ShakirNeural"],
            "note": "Use openai-edge-tts for Arabic voices. SA = Saudi Arabia, EG = Egypt variants."
          },
          "guidance": {
            "provider_priority": "For English: kokoro (best quality), openai-edge-tts (good variety), chatterbox (backup). For other languages: use openai-edge-tts exclusively.",
            "voice_selection": "Always verify voice availability with list-voices-for-provider before using.",
            "format_notes": "Chatterbox voices include .wav extension, others don't."
          }
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(predefinedVoices, null, 2),
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
