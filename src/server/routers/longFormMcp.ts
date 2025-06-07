import type { CreateLongFormInput, LongFormVideoMetadata } from "../../types/longform";
import type { LongFormCreator } from "../../long-creator/LongFormCreator";
import { logger } from "../../logger";

export function createLongFormMcpTools(longFormCreator: LongFormCreator) {
  return {
    create_long_form_video: {
      description: "Create a long-form video with person overlay, name banner, and subtitles",
      inputSchema: {
        type: "object",
        properties: {
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "Text to be spoken in the video"
                },
                searchTerms: {
                  type: "array",
                  items: { type: "string" },
                  description: "Search terms for background video, 1-2 words each"
                }
              },
              required: ["text", "searchTerms"]
            },
            description: "Array of scenes for the video"
          },
          config: {
            type: "object",
            properties: {
              personImageUrl: {
                type: "string",
                format: "uri",
                description: "URL of the person image to overlay"
              },
              personName: {
                type: "string",
                description: "Name to display in the banner"
              },
              voice: {
                type: "string",
                description: "Voice for TTS generation"
              },
              ttsEngine: {
                type: "string",
                enum: ["kokoro", "edge-tts", "streamlabs-polly", "openai-edge-tts"],
                description: "TTS engine to use"
              },
              music: {
                type: "string",
                enum: ["sad", "melancholic", "happy", "euphoric/high", "excited", "chill", "uneasy", "angry", "dark", "hopeful", "contemplative", "funny/quirky"],
                description: "Music mood"
              },
              musicVolume: {
                type: "string",
                enum: ["muted", "low", "medium", "high"],
                description: "Music volume level"
              },
              nameBannerColor: {
                type: "string",
                description: "Color for the name banner (default: #FF4444)"
              },
              personOverlaySize: {
                type: "number",
                minimum: 0.1,
                maximum: 0.5,
                description: "Size of person overlay as fraction of screen width"
              },
              paddingBack: {
                type: "number",
                description: "Extra time at end in milliseconds"
              }
            },
            required: ["personImageUrl", "personName"]
          }
        },
        required: ["scenes", "config"],
        additionalProperties: false
      },
      handler: async (input: CreateLongFormInput) => {
        try {
          logger.info({ input }, "MCP: Creating long-form video");
          const videoId = longFormCreator.addToQueue(input.scenes, input.config);
          return {
            success: true,
            videoId,
            message: "Long-form video creation started"
          };
        } catch (error) {
          logger.error({ error }, "MCP: Error creating long-form video");
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    },

    list_long_form_videos: {
      description: "List all long-form videos",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },
      handler: async () => {
        try {
          const videos = longFormCreator.listAllVideos();
          return {
            success: true,
            videos,
            count: videos.length
          };
        } catch (error) {
          logger.error({ error }, "MCP: Error listing long-form videos");
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    },

    get_long_form_video_status: {
      description: "Get the status of a long-form video",
      inputSchema: {
        type: "object",
        properties: {
          videoId: {
            type: "string",
            description: "ID of the video to check"
          }
        },
        required: ["videoId"],
        additionalProperties: false
      },
      handler: async (input: { videoId: string }) => {
        try {
          const status = longFormCreator.status(input.videoId);
          return {
            success: true,
            videoId: input.videoId,
            status
          };
        } catch (error) {
          logger.error({ error, videoId: input.videoId }, "MCP: Error getting long-form video status");
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    },

    delete_long_form_video: {
      description: "Delete a long-form video",
      inputSchema: {
        type: "object",
        properties: {
          videoId: {
            type: "string",
            description: "ID of the video to delete"
          }
        },
        required: ["videoId"],
        additionalProperties: false
      },
      handler: async (input: { videoId: string }) => {
        try {
          longFormCreator.deleteVideo(input.videoId);
          return {
            success: true,
            videoId: input.videoId,
            message: "Long-form video deleted successfully"
          };
        } catch (error) {
          logger.error({ error, videoId: input.videoId }, "MCP: Error deleting long-form video");
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    }
  };
}
