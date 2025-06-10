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
import { createResearchService } from "../services/ResearchService";

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

    // Research endpoints for AI video creation
    this.router.post(
      "/research-topic",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { searchTerm, targetLanguage = "en" } = req.body;
          
          if (!searchTerm) {
            res.status(400).json({
              error: "searchTerm is required",
            });
            return;
          }

          logger.info({ searchTerm, targetLanguage }, "Researching topic");

          // Use Perplexity MCP to research the topic
          const researchResult = await this.researchTopic(searchTerm, targetLanguage);
          
          res.status(200).json(researchResult);
        } catch (error: unknown) {
          logger.error(error, "Error researching topic");
          res.status(500).json({
            error: "Failed to research topic",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    this.router.post(
      "/generate-scenes",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { content, title, targetLanguage = "en" } = req.body;
          
          if (!content || !title) {
            res.status(400).json({
              error: "content and title are required",
            });
            return;
          }

          logger.info({ title, targetLanguage }, "Generating scenes from content");

          // Use AI to generate scenes from the research content
          const scenesResult = await this.generateScenesFromContent(content, title, targetLanguage);
          
          res.status(200).json(scenesResult);
        } catch (error: unknown) {
          logger.error(error, "Error generating scenes");
          res.status(500).json({
            error: "Failed to generate scenes",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );
  }

  private async researchTopic(searchTerm: string, targetLanguage: string) {
    try {
      // Create research service with API keys from environment
      const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
      const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
      const researchService = createResearchService(perplexityApiKey, deepSeekApiKey);
      
      // Use research service to get information about the topic
      const searchResult = await researchService.researchTopic(searchTerm, targetLanguage);
      
      return {
        title: searchResult.title,
        content: searchResult.content,
        sources: searchResult.sources,
        language: targetLanguage,
      };
    } catch (error) {
      logger.error(error, "Error in researchTopic");
      throw new Error("Failed to research topic");
    }
  }

  private async generateScenesFromContent(content: string, title: string, targetLanguage: string) {
    try {
      // Create research service with API keys from environment
      const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
      const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
      const researchService = createResearchService(perplexityApiKey, deepSeekApiKey);
      
      // Use research service to generate scenes from content
      const aiResult = await researchService.generateScenes(content, title, targetLanguage);
      
      return aiResult;
    } catch (error) {
      logger.error(error, "Error in generateScenesFromContent");
      throw new Error("Failed to generate scenes from content");
    }
  }

  private async callPerplexityMCP(searchTerm: string, targetLanguage: string) {
    try {
      // Use the available Perplexity MCP server
      // Note: In your setup, you would need to configure the Perplexity MCP server
      // For now, we'll use a comprehensive mock that simulates real research
      
      const detailedContent = this.generateDetailedContent(searchTerm, targetLanguage);
      
      const result = {
        title: `Comprehensive Guide to ${searchTerm}`,
        content: detailedContent,
        sources: [
          "Research Papers & Academic Studies",
          "Industry Reports & Analysis",
          "Expert Interviews & Insights", 
          "Scientific Publications",
          "Market Research Data"
        ]
      };

      logger.info({ searchTerm, contentLength: result.content.length }, "Generated research content");
      
      return result;
    } catch (error) {
      logger.error(error, "Error calling Perplexity MCP");
      throw error;
    }
  }

  private generateDetailedContent(searchTerm: string, targetLanguage: string): string {
    // Generate more realistic research content based on the search term
    const topics = [
      `Introduction to ${searchTerm}: ${searchTerm} represents a significant area of study and application in today's world. Understanding its core principles and fundamental concepts is essential for anyone looking to grasp its impact and potential.`,
      
      `Historical Context: The development of ${searchTerm} has evolved significantly over time. From its early beginnings to current implementations, we can trace a clear progression of innovation and refinement that has shaped our current understanding.`,
      
      `Key Components and Mechanisms: The fundamental workings of ${searchTerm} involve several interconnected elements. These components work together to create the comprehensive system we observe today, each playing a crucial role in the overall functionality.`,
      
      `Current Applications and Use Cases: In today's environment, ${searchTerm} finds application across multiple sectors and industries. From practical implementations to theoretical frameworks, its influence can be seen in various aspects of modern life.`,
      
      `Benefits and Advantages: The positive impacts of ${searchTerm} are numerous and well-documented. These benefits extend beyond immediate applications to include long-term advantages for individuals, organizations, and society as a whole.`,
      
      `Challenges and Considerations: Like any significant development, ${searchTerm} comes with its own set of challenges and considerations. Understanding these limitations and potential obstacles is crucial for successful implementation and future development.`,
      
      `Future Outlook and Trends: Looking ahead, the trajectory of ${searchTerm} shows promising developments and emerging trends. Anticipated advances and evolving applications suggest continued growth and refinement in this field.`,
      
      `Best Practices and Recommendations: Based on current research and practical experience, several best practices have emerged for working with ${searchTerm}. These guidelines help ensure optimal outcomes and successful implementation.`
    ];

    return topics.join('\n\n');
  }

  private createSceneGenerationPrompt(content: string, title: string, targetLanguage: string): string {
    return `You are an expert video creator. Create a short video script from this research content.

Title: ${title}
Content: ${content}
Target Language: ${targetLanguage}

Requirements:
1. Create 3-6 scenes that tell a compelling story
2. Each scene should be 10-20 seconds when spoken
3. Use clear, engaging language suitable for video narration
4. Include relevant search terms for background videos
5. Make it educational but entertaining

Return your response as JSON with this exact structure:
{
  "scenes": [
    {
      "text": "The narration text for this scene",
      "searchTerms": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "config": {
    "music": "chill",
    "voice": "en-US-AriaNeural",
    "ttsEngine": "edge-tts",
    "orientation": "portrait",
    "captionPosition": "bottom",
    "musicVolume": "medium",
    "paddingBack": 1500
  }
}

Create an engaging video script now:`;
  }

  private async callAIForSceneGeneration(prompt: string, targetLanguage: string) {
    try {
      // This would use the DEEPSEEK_API_KEY or similar AI service
      // For now, we'll return a mock response that follows the expected structure
      
      const voiceMap: { [key: string]: string } = {
        'en': 'en-US-AriaNeural',
        'fr': 'fr-FR-DeniseNeural', 
        'es': 'es-ES-ElviraNeural',
        'de': 'de-DE-KatjaNeural',
        'it': 'it-IT-ElsaNeural',
        'pt': 'pt-BR-FranciscaNeural',
        'ja': 'ja-JP-NanamiNeural',
        'zh': 'zh-CN-XiaoxiaoNeural',
        'ar': 'ar-SA-ZariyahNeural'
      };

      const mockScenes = [
        {
          text: "Welcome to our exploration of this fascinating topic. Today we'll dive deep into the subject and discover what makes it so important in our modern world.",
          searchTerms: ["introduction", "welcome", "modern world"]
        },
        {
          text: "Let's start by understanding the fundamental concepts and key principles that form the foundation of this subject.",
          searchTerms: ["foundation", "concepts", "principles"]
        },
        {
          text: "The historical development shows us how this field has evolved over time and shaped our current understanding.",
          searchTerms: ["history", "evolution", "development"]
        },
        {
          text: "In today's applications, we can see real-world examples of how these principles are being used to solve important problems.",
          searchTerms: ["applications", "real world", "solutions"]
        },
        {
          text: "Looking toward the future, the potential implications and opportunities are both exciting and transformative.",
          searchTerms: ["future", "potential", "transformation"]
        }
      ];

      const mockResult = {
        scenes: mockScenes,
        config: {
          music: "chill",
          voice: voiceMap[targetLanguage] || voiceMap['en'],
          ttsEngine: "edge-tts",
          orientation: "portrait",
          captionPosition: "bottom",
          musicVolume: "medium",
          paddingBack: 1500
        }
      };

      // In a real implementation, you would call the AI service like this:
      // const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     model: 'deepseek-chat',
      //     messages: [{ role: 'user', content: prompt }]
      //   })
      // });
      // const result = await response.json();
      // return JSON.parse(result.choices[0].message.content);

      return mockResult;
    } catch (error) {
      logger.error(error, "Error calling AI for scene generation");
      throw error;
    }
  }
}
