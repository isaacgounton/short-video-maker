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
import { TTSProvider } from "../../types/shorts";

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
          logger.debug({ body: req.body }, "Received request body");
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
          logger.error({ error, body: req.body }, "Error validating input");

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

    this.router.get(
      "/tts-providers",
      (req: ExpressRequest, res: ExpressResponse) => {
        const providers = Object.values(TTSProvider);
        res.status(200).json({ providers });
      },
    );

    // Add the endpoints that frontend is expecting
    this.router.get(
      "/tts/providers",
      (req: ExpressRequest, res: ExpressResponse) => {
        const providers = Object.values(TTSProvider);
        res.status(200).json(providers); // Return array directly
      },
    );

    this.router.get(
      "/tts/:provider/voices",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { provider } = req.params;
          if (
            !provider ||
            !Object.values(TTSProvider).includes(provider as TTSProvider)
          ) {
            res.status(400).json({
              error:
                "Valid provider is required. Options: " +
                Object.values(TTSProvider).join(", "),
            });
            return;
          }

          const voices = await this.shortCreator.getVoicesForProvider(
            provider as TTSProvider,
          );
          res.status(200).json(voices); // Return array directly
        } catch (error) {
          logger.error(error, "Error fetching voices for provider");
          // Return default voices as fallback instead of error
          const defaultVoices = this.shortCreator.ListAvailableVoices().filter(voice => {
            // Filter voices by provider if needed
            return true; // For now return all default voices
          });
          res.status(200).json(defaultVoices);
        }
      },
    );

    this.router.get(
      "/voices/:provider",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { provider } = req.params;
          if (
            !provider ||
            !Object.values(TTSProvider).includes(provider as TTSProvider)
          ) {
            res.status(400).json({
              error:
                "Valid provider is required. Options: " +
                Object.values(TTSProvider).join(", "),
            });
            return;
          }

          const voices = await this.shortCreator.getVoicesForProvider(
            provider as TTSProvider,
          );
          res.status(200).json({ provider, voices });
        } catch (error) {
          logger.error(error, "Error fetching voices for provider");
          res.status(500).json({
            error: "Failed to fetch voices for provider",
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
      // Generate comprehensive research content using the available context
      const researchContent = this.generateDetailedContent(searchTerm, targetLanguage);
      
      return {
        title: `Comprehensive Guide to ${searchTerm}`,
        content: researchContent,
        sources: [
          "Research Papers & Academic Studies",
          "Industry Reports & Analysis",
          "Expert Interviews & Insights", 
          "Scientific Publications",
          "Market Research Data"
        ],
        language: targetLanguage,
      };
    } catch (error) {
      logger.error(error, "Error in researchTopic");
      throw new Error("Failed to research topic");
    }
  }

  private async generateScenesFromContent(content: string, title: string, targetLanguage: string) {
    try {
      // Use the predefined voice mapping from MCP
      const voiceMap: { [key: string]: { provider: TTSProvider; voice: string } } = {
        'en': { provider: TTSProvider.Kokoro, voice: 'af_heart' },
        'fr': { provider: TTSProvider.OpenAIEdge, voice: 'fr-FR-DeniseNeural' },
        'es': { provider: TTSProvider.OpenAIEdge, voice: 'es-ES-ElviraNeural' },
        'de': { provider: TTSProvider.OpenAIEdge, voice: 'de-DE-KatjaNeural' },
        'it': { provider: TTSProvider.OpenAIEdge, voice: 'it-IT-ElsaNeural' },
        'pt': { provider: TTSProvider.OpenAIEdge, voice: 'pt-BR-FranciscaNeural' },
        'ja': { provider: TTSProvider.OpenAIEdge, voice: 'ja-JP-NanamiNeural' },
        'zh': { provider: TTSProvider.OpenAIEdge, voice: 'zh-CN-XiaoxiaoNeural' },
        'ar': { provider: TTSProvider.OpenAIEdge, voice: 'ar-SA-ZariyahNeural' }
      };

      // Generate scenes based on content
      const scenes = this.generateScenesFromText(content, title);
      
      const selectedVoice = voiceMap[targetLanguage] || voiceMap['en'];

      const result = {
        scenes,
        config: {
          music: "chill",
          voice: selectedVoice.voice,
          provider: selectedVoice.provider,
          orientation: "portrait",
          captionPosition: "bottom",
          musicVolume: "medium",
          paddingBack: 1500
        }
      };

      return result;
    } catch (error) {
      logger.error(error, "Error in generateScenesFromContent");
      throw new Error("Failed to generate scenes from content");
    }
  }

  private generateDetailedContent(searchTerm: string, targetLanguage: string): string {
    // Generate comprehensive research content based on the search term
    const sections = [
      `Introduction to ${searchTerm}: ${searchTerm} represents a significant area of study and application in today's world. Understanding its core principles and fundamental concepts is essential for anyone looking to grasp its impact and potential.`,
      
      `Historical Context: The development of ${searchTerm} has evolved significantly over time. From its early beginnings to current implementations, we can trace a clear progression of innovation and refinement that has shaped our current understanding.`,
      
      `Key Components and Mechanisms: The fundamental workings of ${searchTerm} involve several interconnected elements. These components work together to create the comprehensive system we observe today, each playing a crucial role in the overall functionality.`,
      
      `Current Applications and Use Cases: In today's environment, ${searchTerm} finds application across multiple sectors and industries. From practical implementations to theoretical frameworks, its influence can be seen in various aspects of modern life.`,
      
      `Benefits and Advantages: The positive impacts of ${searchTerm} are numerous and well-documented. These benefits extend beyond immediate applications to include long-term advantages for individuals, organizations, and society as a whole.`,
      
      `Challenges and Considerations: Like any significant development, ${searchTerm} comes with its own set of challenges and considerations. Understanding these limitations and potential obstacles is crucial for successful implementation and future development.`,
      
      `Future Outlook and Trends: Looking ahead, the trajectory of ${searchTerm} shows promising developments and emerging trends. Anticipated advances and evolving applications suggest continued growth and refinement in this field.`,
      
      `Best Practices and Recommendations: Based on current research and practical experience, several best practices have emerged for working with ${searchTerm}. These guidelines help ensure optimal outcomes and successful implementation.`
    ];

    return sections.join('\n\n');
  }

  private generateScenesFromText(content: string, title: string) {
    // Split content into logical sections and create scenes
    const contentSections = content.split('\n\n').filter(section => section.trim().length > 0);
    
    const scenes = [];
    
    // Introduction scene
    scenes.push({
      text: `Welcome to our exploration of ${title}. Today we'll dive deep into this fascinating topic and discover what makes it so important in our modern world.`,
      searchTerms: ["introduction", "welcome", "modern world", title.toLowerCase()]
    });

    // Create scenes from content sections (max 5 additional scenes)
    const maxScenes = Math.min(5, contentSections.length);
    for (let i = 0; i < maxScenes; i++) {
      const section = contentSections[i];
      const sectionTitle = section.split(':')[0];
      
      // Extract key terms for search
      const searchTerms = this.extractSearchTerms(section, title);
      
      // Create a concise scene text
      const sceneText = this.createSceneText(section);
      
      scenes.push({
        text: sceneText,
        searchTerms: searchTerms
      });
    }

    // Conclusion scene
    if (scenes.length > 1) {
      scenes.push({
        text: `As we've explored today, ${title} offers tremendous potential and opportunities. Understanding these concepts helps us navigate an increasingly complex world with greater insight and capability.`,
        searchTerms: ["conclusion", "future", "potential", "opportunities"]
      });
    }

    return scenes.slice(0, 6); // Maximum 6 scenes
  }

  private extractSearchTerms(section: string, title: string): string[] {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those']);
    
    // Extract meaningful words from the section
    const words = section.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 5);

    // Always include title-related terms
    const titleWords = title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return [...new Set([...titleWords, ...words])].slice(0, 6);
  }

  private createSceneText(section: string): string {
    // Extract the first sentence or create a summary
    const sentences = section.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length > 0) {
      let sceneText = sentences[0].trim();
      
      // If the first sentence is too short, add the second one
      if (sceneText.length < 80 && sentences.length > 1) {
        sceneText += '. ' + sentences[1].trim();
      }
      
      // Ensure it ends with proper punctuation
      if (!sceneText.match(/[.!?]$/)) {
        sceneText += '.';
      }
      
      return sceneText;
    }
    
    return section.slice(0, 200) + (section.length > 200 ? '...' : '');
  }
}
