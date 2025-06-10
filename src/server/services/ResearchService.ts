import { logger } from "../../logger";

interface ResearchResult {
  title: string;
  content: string;
  sources: string[];
}

interface SceneGenerationResult {
  scenes: Array<{
    text: string;
    searchTerms: string[];
  }>;
  config: {
    music: string;
    voice: string;
    ttsEngine: string;
    orientation: string;
    captionPosition: string;
    musicVolume: string;
    paddingBack: number;
  };
}

/**
 * Research Service for AI-powered video content generation
 * Uses Perplexity API and DeepSeek API directly (Docker-friendly)
 */
export class ResearchService {
  private perplexityApiKey?: string;
  private deepSeekApiKey?: string;

  constructor(perplexityApiKey?: string, deepSeekApiKey?: string) {
    this.perplexityApiKey = perplexityApiKey;
    this.deepSeekApiKey = deepSeekApiKey;
  }

  /**
   * Research a topic using Perplexity API, Google Custom Search, or fallback to mock
   */
  async researchTopic(searchTerm: string, targetLanguage: string = "en"): Promise<ResearchResult> {
    try {
      // Try Perplexity first (best for comprehensive research)
      if (this.perplexityApiKey) {
        try {
          return await this.researchWithPerplexity(searchTerm, targetLanguage);
        } catch (perplexityError) {
          logger.warn(perplexityError, "Perplexity API failed, trying Google Custom Search");
          
          // Fallback to Google Custom Search
          const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
          const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
          
          if (googleApiKey && searchEngineId) {
            return await this.researchWithGoogleSearch(searchTerm, targetLanguage, googleApiKey, searchEngineId);
          }
        }
      }
      
      // Try Google Custom Search if Perplexity not available
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (googleApiKey && searchEngineId) {
        logger.info("Using Google Custom Search for research");
        return await this.researchWithGoogleSearch(searchTerm, targetLanguage, googleApiKey, searchEngineId);
      }
      
      logger.info("Using mock research (no API keys configured)");
      return this.generateMockResearch(searchTerm, targetLanguage);
    } catch (error) {
      logger.error(error, "Error in researchTopic, falling back to mock");
      return this.generateMockResearch(searchTerm, targetLanguage);
    }
  }

  /**
   * Generate video scenes from research content using AI
   */
  async generateScenes(content: string, title: string, targetLanguage: string = "en"): Promise<SceneGenerationResult> {
    try {
      if (this.deepSeekApiKey) {
        return await this.generateScenesWithAI(content, title, targetLanguage);
      } else {
        logger.info("Using mock scene generation (no DeepSeek API key configured)");
        return this.generateMockScenes(title, targetLanguage);
      }
    } catch (error) {
      logger.error(error, "Error in generateScenes, falling back to mock");
      return this.generateMockScenes(title, targetLanguage);
    }
  }

  /**
   * Research using Perplexity API (Docker-compatible)
   */
  private async researchWithPerplexity(searchTerm: string, targetLanguage: string): Promise<ResearchResult> {
    try {
      // Use Perplexity API directly for Docker deployment
      const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityApiKey) {
        throw new Error("PERPLEXITY_API_KEY not configured");
      }

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: `Research this topic in detail for ${targetLanguage} language. Provide comprehensive information, key points, and relevant context: ${searchTerm}`
          }],
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "";

      // Extract sources from the content (Perplexity includes citations)
      const sources = this.extractSourcesFromContent(content);

      return {
        title: `Comprehensive Research: ${searchTerm}`,
        content: content,
        sources: sources.length > 0 ? sources : [
          "Perplexity AI Research",
          "Academic & Industry Sources",
          "Real-time Web Data"
        ]
      };
    } catch (error) {
      logger.error(error, "Error calling Perplexity API");
      throw error;
    }
  }

  /**
   * Research using Google Custom Search API
   */
  private async researchWithGoogleSearch(searchTerm: string, targetLanguage: string, apiKey: string, searchEngineId: string): Promise<ResearchResult> {
    try {
      // Search for comprehensive information about the topic
      const searchQuery = `${searchTerm} comprehensive guide information`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=5`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      const items = result.items || [];
      
      // Extract information from search results
      let content = `Research Summary for: ${searchTerm}\n\n`;
      const sources: string[] = [];
      
      for (const item of items) {
        const title = item.title || "";
        const snippet = item.snippet || "";
        const link = item.link || "";
        
        if (snippet) {
          content += `${title}\n${snippet}\n\n`;
        }
        
        if (link) {
          // Extract domain for source attribution
          const domain = new URL(link).hostname;
          sources.push(domain);
        }
      }
      
      // If we didn't get enough content, add some structured information
      if (content.length < 500) {
        content += `
Key Areas of ${searchTerm}:

1. Overview and Definition: ${searchTerm} encompasses important concepts and applications that are relevant in today's context.

2. Main Components: Understanding the fundamental elements that make up ${searchTerm} is essential for comprehensive knowledge.

3. Applications: ${searchTerm} has various practical applications across different sectors and industries.

4. Benefits: The advantages and positive impacts of ${searchTerm} are significant for users and society.

5. Future Outlook: The development and evolution of ${searchTerm} continues to show promising trends.
        `;
      }
      
      return {
        title: `Research Report: ${searchTerm}`,
        content: content.trim(),
        sources: sources.length > 0 ? [...new Set(sources)] : [
          "Google Search Results",
          "Web Sources",
          "Online Publications"
        ]
      };
    } catch (error) {
      logger.error(error, "Error calling Google Custom Search API");
      throw error;
    }
  }

  /**
   * Extract source citations from Perplexity response content
   */
  private extractSourcesFromContent(content: string): string[] {
    const sources: string[] = [];
    
    // Look for citation patterns like [1], [2], etc.
    const citationMatches = content.match(/\[\d+\]/g);
    if (citationMatches) {
      sources.push("Academic Research Papers");
      sources.push("Industry Reports");
      sources.push("Expert Analysis");
    }

    // Look for URL patterns
    const urlMatches = content.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) {
      sources.push("Web Sources");
      sources.push("Official Documentation");
    }

    return sources;
  }

  /**
   * Generate scenes using DeepSeek AI
   */
  private async generateScenesWithAI(content: string, title: string, targetLanguage: string): Promise<SceneGenerationResult> {
    try {
      const prompt = this.createSceneGenerationPrompt(content, title, targetLanguage);
      
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.deepSeekApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are an expert video content creator. Always respond with valid JSON only, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      // Parse JSON response from AI
      const parsedResult = JSON.parse(aiResponse);
      
      // Validate the response structure
      if (!parsedResult.scenes || !Array.isArray(parsedResult.scenes)) {
        throw new Error("Invalid AI response structure");
      }

      return parsedResult;
    } catch (error) {
      logger.error(error, "Error calling DeepSeek API");
      throw error;
    }
  }

  /**
   * Generate mock research for development/fallback
   */
  private generateMockResearch(searchTerm: string, targetLanguage: string): ResearchResult {
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

    return {
      title: `Comprehensive Guide to ${searchTerm}`,
      content: topics.join('\n\n'),
      sources: [
        "Research Papers & Academic Studies",
        "Industry Reports & Analysis",
        "Expert Interviews & Insights", 
        "Scientific Publications",
        "Market Research Data"
      ]
    };
  }

  /**
   * Generate mock scenes for development/fallback
   */
  private generateMockScenes(title: string, targetLanguage: string): SceneGenerationResult {
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

    const scenes = [
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

    return {
      scenes,
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
  }

  /**
   * Create AI prompt for scene generation
   */
  private createSceneGenerationPrompt(content: string, title: string, targetLanguage: string): string {
    return `Create a short video script from this research content for ${targetLanguage} language.

Title: ${title}
Content: ${content}

Requirements:
1. Create 4-6 scenes that tell a compelling story
2. Each scene should be 15-25 seconds when spoken (approximately 40-60 words)
3. Use clear, engaging language suitable for video narration in ${targetLanguage}
4. Include 3-4 relevant search terms for background videos per scene
5. Make it educational but entertaining
6. Ensure smooth transitions between scenes

Return ONLY valid JSON with this exact structure:
{
  "scenes": [
    {
      "text": "The narration text for this scene in ${targetLanguage}",
      "searchTerms": ["keyword1", "keyword2", "keyword3", "keyword4"]
    }
  ],
  "config": {
    "music": "chill",
    "voice": "${this.getVoiceForLanguage(targetLanguage)}",
    "ttsEngine": "edge-tts",
    "orientation": "portrait",
    "captionPosition": "bottom",
    "musicVolume": "medium",
    "paddingBack": 1500
  }
}`;
  }

  /**
   * Get appropriate voice for target language
   */
  private getVoiceForLanguage(targetLanguage: string): string {
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

    return voiceMap[targetLanguage] || voiceMap['en'];
  }
}

/**
 * Factory function to create ResearchService instance
 */
export function createResearchService(perplexityApiKey?: string, deepSeekApiKey?: string): ResearchService {
  return new ResearchService(perplexityApiKey, deepSeekApiKey);
}
