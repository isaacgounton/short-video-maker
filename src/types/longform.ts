import z from "zod";
import { VoiceEnum, MusicMoodEnum, MusicVolumeEnum, TTSEngineEnum, OrientationEnum } from "./shorts";

export type LongFormScene = {
  captions: LongFormCaption[];
  video: string;
  audio: {
    url: string;
    duration: number;
  };
};

export type LongFormCaption = {
  text: string;
  startMs: number;
  endMs: number;
};

export const longFormSceneInput = z.object({
  text: z.string().describe("Text to be spoken in the video"),
  searchTerms: z
    .array(z.string())
    .describe(
      "Search terms for background video, 1-2 words each, at least 2-3 search terms should be provided for each scene.",
    ),
});
export type LongFormSceneInput = z.infer<typeof longFormSceneInput>;

export const longFormRenderConfig = z.object({
  paddingBack: z
    .number()
    .optional()
    .describe(
      "For how long the video should be playing after the speech is done, in milliseconds. 1500 is a good value.",
    ),
  music: z
    .nativeEnum(MusicMoodEnum)
    .optional()
    .describe("Music tag to be used to find the right music for the video"),
  voice: z
    .string()
    .optional()
    .describe("Voice to be used for the speech, default is af_heart"),
  musicVolume: z
    .nativeEnum(MusicVolumeEnum)
    .optional()
    .describe("Volume of the music, default is medium"),
  ttsEngine: z
    .nativeEnum(TTSEngineEnum)
    .optional()
    .describe("TTS engine to use for speech generation, default is kokoro"),
  // Long-form specific options
  personImageUrl: z
    .string()
    .url()
    .describe("URL of the person image to overlay on the video"),
  personName: z
    .string()
    .describe("Name of the person to display in the name banner"),
  nameBannerColor: z
    .string()
    .optional()
    .default("#FF4444")
    .describe("Background color of the name banner, default is coral/red"),
  personOverlaySize: z
    .number()
    .min(0.1)
    .max(0.5)
    .optional()
    .default(0.25)
    .describe("Size of person overlay as fraction of screen width (0.1-0.5), default 0.25"),
});
export type LongFormRenderConfig = z.infer<typeof longFormRenderConfig>;

export const createLongFormInput = z.object({
  scenes: z.array(longFormSceneInput).describe("Each scene to be created"),
  config: longFormRenderConfig.describe("Configuration for rendering the long-form video"),
});
export type CreateLongFormInput = z.infer<typeof createLongFormInput>;

export enum LongFormVideoStatus {
  processing = "processing",
  ready = "ready", 
  failed = "failed",
}

export type LongFormVideoMetadata = {
  id: string;
  status: LongFormVideoStatus;
  personName: string;
  duration?: number;
  createdAt: Date;
  scenes: number;
};
