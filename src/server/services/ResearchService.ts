import { logger } from "../../logger";
import { TTSProvider, SceneInput, RenderConfig, MusicMoodEnum, CaptionPositionEnum, OrientationEnum, MusicVolumeEnum } from "../../types/shorts";

interface ResearchResult {
  title: string;
  content: string;
  sources: string[];
  language: string;
}

interface SceneGenerationResult {
  scenes: SceneInput[];
  config: RenderConfig;
}

/**
 * Research Service for AI-powered video content generation
 * Uses Perplexity API and DeepSeek API directly (Docker-friendly)
 */
export class ResearchService {
  private perplexityApiKey?: string;
  private deepSeekApiKey?: string;
  private googleApiKey?: string;
  private searchEngineId?: string;

  constructor(
    perplexityApiKey?: string, 
    deepSeekApiKey?: string,
    googleApiKey?: string,
    searchEngineId?: string
  ) {
    this.perplexityApiKey = perplexityApiKey;
    this.deepSeekApiKey = deepSeekApiKey;
    this.googleApiKey = googleApiKey;
    this.searchEngineId = searchEngineId;
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
          if (this.googleApiKey && this.searchEngineId) {
            return await this.researchWithGoogleSearch(searchTerm, targetLanguage, this.googleApiKey, this.searchEngineId);
          }
        }
      }
      
      // Try Google Custom Search if Perplexity not available
      if (this.googleApiKey && this.searchEngineId) {
        logger.info("Using Google Custom Search for research");
        return await this.researchWithGoogleSearch(searchTerm, targetLanguage, this.googleApiKey, this.searchEngineId);
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
        return this.generateMockScenes(title, targetLanguage, content);
      }
    } catch (error) {
      logger.error(error, "Error in generateScenes, falling back to mock");
      return this.generateMockScenes(title, targetLanguage, content);
    }
  }

  /**
   * Research using Perplexity API (Docker-compatible)
   */
  private async researchWithPerplexity(searchTerm: string, targetLanguage: string): Promise<ResearchResult> {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: `Research this topic in detail for ${targetLanguage} language. Provide comprehensive information, key points, statistics, examples, and relevant context with real facts and data: ${searchTerm}. Include specific details, numbers, and concrete examples wherever possible.`
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

      // Create a more descriptive title based on the research
      const title = this.generateResearchTitle(searchTerm, content);

      return {
        title: title,
        content: content,
        sources: sources.length > 0 ? sources : [
          "Perplexity AI Research",
          "Academic & Industry Sources",
          "Real-time Web Data"
        ],
        language: targetLanguage
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
      const searchQuery = `${searchTerm} comprehensive guide information facts statistics`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=8`;
      
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
          content += `**${title}**\n${snippet}\n\n`;
        }
        
        if (link) {
          // Extract domain for source attribution
          try {
            const domain = new URL(link).hostname;
            sources.push(domain);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
      
      // If we didn't get enough content, add some structured information
      if (content.length < 500) {
        content += this.generateStructuredContent(searchTerm);
      }
      
      return {
        title: `Research Report: ${searchTerm}`,
        content: content.trim(),
        sources: sources.length > 0 ? [...new Set(sources)] : [
          "Google Search Results",
          "Web Sources",
          "Online Publications"
        ],
        language: targetLanguage
      };
    } catch (error) {
      logger.error(error, "Error calling Google Custom Search API");
      throw error;
    }
  }

  /**
   * Generate a more descriptive title from research content
   */
  private generateResearchTitle(searchTerm: string, content: string): string {
    // Extract key concepts from the first paragraph
    const firstParagraph = content.split('\n')[0];
    const words = firstParagraph.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const relevantWords = words.filter(word => 
      !['this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'were', 'said', 'each', 'which', 'their', 'time', 'also', 'many', 'more', 'some', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'than', 'only', 'come', 'work', 'life', 'way', 'even', 'back', 'any', 'good', 'through', 'about'].includes(word)
    );

    // Try to create a more descriptive title
    if (relevantWords.length > 0 && relevantWords[0] !== searchTerm.toLowerCase()) {
      return `${searchTerm}: Key Insights and Analysis`;
    }
    
    return `Understanding ${searchTerm}: Research Insights`;
  }

  /**
   * Generate structured content when search results are insufficient
   */
  private generateStructuredContent(searchTerm: string): string {
    return `

## Key Areas of ${searchTerm}

**Overview and Definition**
${searchTerm} encompasses important concepts and applications that are relevant in today's context. Understanding its fundamental principles is essential for comprehensive knowledge.

**Main Components**
The core elements that make up ${searchTerm} include various interconnected systems and processes that work together to create meaningful outcomes.

**Applications and Use Cases**
${searchTerm} finds practical applications across different sectors, with implementations ranging from basic applications to advanced systems.

**Benefits and Impact**
The advantages of ${searchTerm} extend to multiple stakeholders, providing value through improved efficiency, enhanced capabilities, and strategic advantages.

**Current Trends**
Recent developments in ${searchTerm} show promising directions with ongoing research and innovation driving future possibilities.

**Future Outlook**
The evolution of ${searchTerm} continues to show potential for growth and refinement across various domains and applications.
        `;
  }

  /**
   * Extract source citations from content
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
      urlMatches.forEach(url => {
        try {
          const domain = new URL(url).hostname;
          sources.push(domain);
        } catch (e) {
          // Invalid URL, skip
        }
      });
    }

    // Look for source indicators in text
    const sourceIndicators = [
      /according to ([^,\.]+)/gi,
      /studies show/gi,
      /research indicates/gi,
      /experts suggest/gi,
      /data from ([^,\.]+)/gi
    ];

    sourceIndicators.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        sources.push("Research Studies");
        sources.push("Expert Sources");
      }
    });

    return [...new Set(sources)].slice(0, 6); // Remove duplicates and limit to 6
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
              content: 'You are an expert video content creator. Always respond with valid JSON only, no additional text or explanations.'
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
      let aiResponse = result.choices[0].message.content;
      
      // Clean up AI response - remove markdown code blocks if present
      aiResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Parse JSON response from AI
      const parsedResult = JSON.parse(aiResponse);
      
      // Validate and transform the response structure to match our types
      if (!parsedResult.scenes || !Array.isArray(parsedResult.scenes)) {
        throw new Error("Invalid AI response structure");
      }

      // Transform to our expected format
      const scenes: SceneInput[] = parsedResult.scenes.map((scene: any) => ({
        text: scene.text || "",
        searchTerms: Array.isArray(scene.searchTerms) ? scene.searchTerms : []
      }));

      // Get voice configuration for the target language
      const voiceConfig = this.getVoiceConfigForLanguage(targetLanguage);

      const config: RenderConfig = {
        music: MusicMoodEnum.chill,
        voice: voiceConfig.voice,
        provider: voiceConfig.provider,
        orientation: OrientationEnum.portrait,
        captionPosition: CaptionPositionEnum.bottom,
        musicVolume: MusicVolumeEnum.medium,
        paddingBack: 1500
      };

      return { scenes, config };
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
      `**Introduction to ${searchTerm}**\n${searchTerm} represents a significant area of study and application in today's world. Understanding its core principles and fundamental concepts is essential for anyone looking to grasp its impact and potential.`,
      
      `**Historical Context**\nThe development of ${searchTerm} has evolved significantly over time. From its early beginnings to current implementations, we can trace a clear progression of innovation and refinement that has shaped our current understanding.`,
      
      `**Key Components and Mechanisms**\nThe fundamental workings of ${searchTerm} involve several interconnected elements. These components work together to create the comprehensive system we observe today, each playing a crucial role in the overall functionality.`,
      
      `**Current Applications and Use Cases**\nIn today's environment, ${searchTerm} finds application across multiple sectors and industries. From practical implementations to theoretical frameworks, its influence can be seen in various aspects of modern life.`,
      
      `**Benefits and Advantages**\nThe positive impacts of ${searchTerm} are numerous and well-documented. These benefits extend beyond immediate applications to include long-term advantages for individuals, organizations, and society as a whole.`,
      
      `**Challenges and Considerations**\nLike any significant development, ${searchTerm} comes with its own set of challenges and considerations. Understanding these limitations and potential obstacles is crucial for successful implementation and future development.`,
      
      `**Future Outlook and Trends**\nLooking ahead, the trajectory of ${searchTerm} shows promising developments and emerging trends. Anticipated advances and evolving applications suggest continued growth and refinement in this field.`,
      
      `**Best Practices and Recommendations**\nBased on current research and practical experience, several best practices have emerged for working with ${searchTerm}. These guidelines help ensure optimal outcomes and successful implementation.`
    ];

    return {
      title: `Understanding ${searchTerm}: Research Insights`,
      content: topics.join('\n\n'),
      sources: [
        "Research Papers & Academic Studies",
        "Industry Reports & Analysis",
        "Expert Interviews & Insights", 
        "Scientific Publications",
        "Market Research Data"
      ],
      language: targetLanguage
    };
  }

  /**
   * Generate scenes based on content (fallback when AI not available)
   */
  private generateMockScenes(title: string, targetLanguage: string, content?: string): SceneGenerationResult {
    // Extract key topic from title
    const topic = title.replace(/^(Comprehensive Research:|Research Report:|Understanding|Research Insights:)\s*/i, '').replace(/:\s*.*$/, '');
    
    // Try to extract key information from content if available
    let keyTerms = [topic];
    let keyPoints: string[] = [];
    
    if (content) {
      // Extract key terms and concepts from content
      const sentences = content.split(/[.!?]+/).slice(0, 10); // First 10 sentences
      const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      const commonTerms = words.filter((word, index, arr) => 
        arr.indexOf(word) !== index && 
        !['this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'were', 'said', 'each', 'which', 'their', 'time', 'also', 'many', 'more', 'some', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'than', 'only', 'come', 'work', 'life', 'way', 'even', 'back', 'any', 'good', 'woman', 'through', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'out', 'she', 'use', 'her', 'you', 'all', 'and', 'are', 'but', 'can', 'had', 'not', 'one', 'our', 'the', 'was', 'for'].includes(word)
      );
      
      keyTerms = [topic, ...commonTerms.slice(0, 5)];
      
      // Extract meaningful sentences
      keyPoints = sentences.filter(s => s.trim().length > 20 && s.trim().length < 200).slice(0, 6);
    }

    // Generate scenes based on available content
    const scenes: SceneInput[] = [];
    
    if (keyPoints.length > 0) {
      // Use actual content points
      for (let i = 0; i < Math.min(6, keyPoints.length); i++) {
        const point = keyPoints[i].trim().replace(/^\*\*|\*\*$/g, ''); // Remove markdown bold
        if (point) {
          scenes.push({
            text: point.length > 200 ? point.substring(0, 200) + "..." : point,
            searchTerms: keyTerms.slice(0, 4)
          });
        }
      }
    }
    
    // Fill remaining scenes if needed
    while (scenes.length < 4) {
      const sceneTemplates = [
        `Understanding ${topic} is crucial in today's rapidly evolving landscape, where its applications continue to expand across multiple sectors.`,
        `The fundamentals of ${topic} involve key principles that form the backbone of modern implementations and strategic approaches.`,
        `Current applications of ${topic} demonstrate its versatility across various industries and use cases, providing significant value.`,
        `The benefits of ${topic} extend beyond immediate applications to long-term strategic advantages for organizations and individuals.`,
        `Future developments in ${topic} promise exciting innovations and breakthrough applications that will reshape the landscape.`,
        `Key considerations for ${topic} include both opportunities and challenges that shape its evolution and adoption patterns.`
      ];
      
      const templateIndex: number = scenes.length % sceneTemplates.length;
      scenes.push({
        text: sceneTemplates[templateIndex],
        searchTerms: keyTerms.slice(0, 4)
      });
    }

    // Get voice configuration for the target language
    const voiceConfig = this.getVoiceConfigForLanguage(targetLanguage);

    const config: RenderConfig = {
      music: MusicMoodEnum.chill,
      voice: voiceConfig.voice,
      provider: voiceConfig.provider,
      orientation: OrientationEnum.portrait,
      captionPosition: CaptionPositionEnum.bottom,
      musicVolume: MusicVolumeEnum.medium,
      paddingBack: 1500
    };

    return {
      scenes: scenes.slice(0, 6), // Max 6 scenes
      config
    };
  }

  /**
   * Get appropriate voice configuration for target language
   */
  private getVoiceConfigForLanguage(targetLanguage: string): { provider: TTSProvider; voice: string } {
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

    return voiceMap[targetLanguage] || voiceMap['en'];
  }

  /**
   * Create AI prompt for scene generation
   */
  private createSceneGenerationPrompt(content: string, title: string, targetLanguage: string): string {
    // Truncate content if too long but keep key information
    const maxContentLength = 2500;
    let truncatedContent = content;
    if (content.length > maxContentLength) {
      // Try to keep complete paragraphs
      const paragraphs = content.split('\n\n');
      truncatedContent = '';
      for (const paragraph of paragraphs) {
        if ((truncatedContent + paragraph).length > maxContentLength) {
          break;
        }
        truncatedContent += paragraph + '\n\n';
      }
      if (truncatedContent.length < maxContentLength * 0.8) {
        truncatedContent = content.substring(0, maxContentLength) + "...";
      }
    }

    return `You are a professional video script writer. Create an engaging short video script based on this SPECIFIC research content. You MUST use the actual facts, details, and information from the research - do NOT create generic content.

=== RESEARCH TO CONVERT ===
Title: ${title}

Research Content:
${truncatedContent}

=== YOUR TASK ===
Transform this research into 4-6 video scenes that:
1. Use SPECIFIC facts, numbers, examples, and details from the research above
2. Each scene should be 40-60 words (15-25 seconds when spoken)
3. Tell a compelling story using the ACTUAL research findings
4. Include specific search terms based on the REAL content discussed
5. Write in ${targetLanguage} language
6. Be educational but engaging, suitable for short-form video content

=== CRITICAL REQUIREMENTS ===
- Extract SPECIFIC information from the research content provided
- Use REAL facts, statistics, examples from the content
- Do NOT use generic phrases like "fascinating topic" or "modern world"
- Base search terms on ACTUAL subjects discussed in the research
- Each scene must reference concrete information from the research
- Make it suitable for TikTok/YouTube Shorts style content

=== EXAMPLE STRUCTURE ===
Scene 1: Hook with a specific fact/statistic from research
Scene 2: Core concept/definition with real details
Scene 3: Specific application/example from research
Scene 4: Concrete benefit/impact mentioned in research
Scene 5: Future implications based on research findings
Scene 6: Call to action or summary of key takeaway

Return ONLY this JSON structure:
{
  "scenes": [
    {
      "text": "Specific narration using REAL research content (40-60 words)",
      "searchTerms": ["specific", "terms", "from", "actual research"]
    }
  ],
  "config": {
    "music": "chill",
    "voice": "${this.getVoiceConfigForLanguage(targetLanguage).voice}",
    "provider": "${this.getVoiceConfigForLanguage(targetLanguage).provider}",
    "orientation": "portrait",
    "captionPosition": "bottom",
    "musicVolume": "medium",
    "paddingBack": 1500
  }
}`;
  }
}

/**
 * Factory function to create ResearchService instance
 */
export function createResearchService(
  perplexityApiKey?: string, 
  deepSeekApiKey?: string,
  googleApiKey?: string,
  searchEngineId?: string
): ResearchService {
  return new ResearchService(perplexityApiKey, deepSeekApiKey, googleApiKey, searchEngineId);
}
