import z from "zod";

export enum MusicMoodEnum {
  sad = "sad",
  melancholic = "melancholic",
  happy = "happy",
  euphoric = "euphoric/high",
  excited = "excited",
  chill = "chill",
  uneasy = "uneasy",
  angry = "angry",
  dark = "dark",
  hopeful = "hopeful",
  contemplative = "contemplative",
  funny = "funny/quirky",
}

export enum CaptionPositionEnum {
  top = "top",
  center = "center",
  bottom = "bottom",
}

export type Scene = {
  captions: Caption[];
  video: string;
  audio: {
    url: string;
    duration: number;
  };
};

export const sceneInput = z.object({
  text: z.string().describe("Text to be spoken in the video"),
  searchTerms: z
    .array(z.string())
    .describe(
      "Search term for video, 1 word, and at least 2-3 search terms should be provided for each scene. Make sure to match the overall context with the word - regardless what the video search result would be.",
    ),
});
export type SceneInput = z.infer<typeof sceneInput>;

export enum VoiceEnum {
  // OpenAI Compatible voices
  alloy = "alloy",
  echo = "echo",
  fable = "fable",
  onyx = "onyx",
  nova = "nova",
  shimmer = "shimmer",
  
  // English (US) voices
  "en-US-AriaNeural" = "en-US-AriaNeural",
  "en-US-JennyNeural" = "en-US-JennyNeural",
  "en-US-GuyNeural" = "en-US-GuyNeural",
  "en-US-DavisNeural" = "en-US-DavisNeural",
  "en-US-AmberNeural" = "en-US-AmberNeural",
  "en-US-AnaNeural" = "en-US-AnaNeural",
  "en-US-ChristopherNeural" = "en-US-ChristopherNeural",
  "en-US-EricNeural" = "en-US-EricNeural",
  "en-US-EmmaNeural" = "en-US-EmmaNeural",
  "en-US-BrianNeural" = "en-US-BrianNeural",
  "en-US-MichelleNeural" = "en-US-MichelleNeural",
  "en-US-RogerNeural" = "en-US-RogerNeural",
  "en-US-SteffanNeural" = "en-US-SteffanNeural",
  
  // English (UK) voices
  "en-GB-SoniaNeural" = "en-GB-SoniaNeural",
  "en-GB-RyanNeural" = "en-GB-RyanNeural",
  "en-GB-LibbyNeural" = "en-GB-LibbyNeural",
  "en-GB-AbbiNeural" = "en-GB-AbbiNeural",
  "en-GB-AlfieNeural" = "en-GB-AlfieNeural",
  "en-GB-BellaNeural" = "en-GB-BellaNeural",
  
  // English (Australia) voices
  "en-AU-NatashaNeural" = "en-AU-NatashaNeural",
  "en-AU-WilliamNeural" = "en-AU-WilliamNeural",
  "en-AU-AnnetteNeural" = "en-AU-AnnetteNeural",
  "en-AU-CarlyNeural" = "en-AU-CarlyNeural",
  "en-AU-DarrenNeural" = "en-AU-DarrenNeural",
  "en-AU-DuncanNeural" = "en-AU-DuncanNeural",
  
  // English (Canada) voices
  "en-CA-ClaraNeural" = "en-CA-ClaraNeural",
  "en-CA-LiamNeural" = "en-CA-LiamNeural",
  
  // French voices
  "fr-FR-DeniseNeural" = "fr-FR-DeniseNeural",
  "fr-FR-HenriNeural" = "fr-FR-HenriNeural",
  "fr-FR-JeromeNeural" = "fr-FR-JeromeNeural",
  "fr-FR-JosephineNeural" = "fr-FR-JosephineNeural",
  "fr-FR-BrigitteNeural" = "fr-FR-BrigitteNeural",
  "fr-FR-AlainNeural" = "fr-FR-AlainNeural",
  "fr-CA-AntoineNeural" = "fr-CA-AntoineNeural",
  "fr-CA-JeanNeural" = "fr-CA-JeanNeural",
  "fr-CA-SylvieNeural" = "fr-CA-SylvieNeural",
  
  // Spanish voices
  "es-ES-ElviraNeural" = "es-ES-ElviraNeural",
  "es-ES-AlvaroNeural" = "es-ES-AlvaroNeural",
  "es-ES-AbrilNeural" = "es-ES-AbrilNeural",
  "es-ES-ArnauNeural" = "es-ES-ArnauNeural",
  "es-ES-DarioNeural" = "es-ES-DarioNeural",
  "es-ES-EliasNeural" = "es-ES-EliasNeural",
  "es-MX-DaliaNeural" = "es-MX-DaliaNeural",
  "es-MX-JorgeNeural" = "es-MX-JorgeNeural",
  "es-MX-CandelaNeural" = "es-MX-CandelaNeural",
  "es-MX-CecilioNeural" = "es-MX-CecilioNeural",
  
  // German voices
  "de-DE-KatjaNeural" = "de-DE-KatjaNeural",
  "de-DE-ConradNeural" = "de-DE-ConradNeural",
  "de-DE-AmalaNeural" = "de-DE-AmalaNeural",
  "de-DE-BerndNeural" = "de-DE-BerndNeural",
  "de-DE-ChristelNeural" = "de-DE-ChristelNeural",
  "de-DE-GiselaNeural" = "de-DE-GiselaNeural",
  "de-AT-IngridNeural" = "de-AT-IngridNeural",
  "de-AT-JonasNeural" = "de-AT-JonasNeural",
  
  // Italian voices
  "it-IT-ElsaNeural" = "it-IT-ElsaNeural",
  "it-IT-IsabellaNeural" = "it-IT-IsabellaNeural",
  "it-IT-DiegoNeural" = "it-IT-DiegoNeural",
  "it-IT-BenignoNeural" = "it-IT-BenignoNeural",
  "it-IT-CalimeroNeural" = "it-IT-CalimeroNeural",
  "it-IT-CataldoNeural" = "it-IT-CataldoNeural",
  
  // Portuguese voices
  "pt-BR-FranciscaNeural" = "pt-BR-FranciscaNeural",
  "pt-BR-AntonioNeural" = "pt-BR-AntonioNeural",
  "pt-BR-BrendaNeural" = "pt-BR-BrendaNeural",
  "pt-BR-DonatoNeural" = "pt-BR-DonatoNeural",
  "pt-BR-ElzaNeural" = "pt-BR-ElzaNeural",
  "pt-BR-FabioNeural" = "pt-BR-FabioNeural",
  "pt-PT-RaquelNeural" = "pt-PT-RaquelNeural",
  "pt-PT-DuarteNeural" = "pt-PT-DuarteNeural",
  "pt-PT-FernandaNeural" = "pt-PT-FernandaNeural",
  
  // Japanese voices
  "ja-JP-NanamiNeural" = "ja-JP-NanamiNeural",
  "ja-JP-KeitaNeural" = "ja-JP-KeitaNeural",
  "ja-JP-AoiNeural" = "ja-JP-AoiNeural",
  "ja-JP-DaichiNeural" = "ja-JP-DaichiNeural",
  "ja-JP-MayuNeural" = "ja-JP-MayuNeural",
  "ja-JP-NaokiNeural" = "ja-JP-NaokiNeural",
  
  // Chinese voices
  "zh-CN-XiaoxiaoNeural" = "zh-CN-XiaoxiaoNeural",
  "zh-CN-YunxiNeural" = "zh-CN-YunxiNeural",
  "zh-CN-YunyangNeural" = "zh-CN-YunyangNeural",
  "zh-CN-XiaochenNeural" = "zh-CN-XiaochenNeural",
  "zh-CN-XiaohanNeural" = "zh-CN-XiaohanNeural",
  "zh-CN-XiaomengNeural" = "zh-CN-XiaomengNeural",
  "zh-TW-HsiaoChenNeural" = "zh-TW-HsiaoChenNeural",
  "zh-TW-YunJheNeural" = "zh-TW-YunJheNeural",
  "zh-TW-HsiaoYuNeural" = "zh-TW-HsiaoYuNeural",
  
  // Korean voices
  "ko-KR-SunHiNeural" = "ko-KR-SunHiNeural",
  "ko-KR-InJoonNeural" = "ko-KR-InJoonNeural",
  "ko-KR-BongJinNeural" = "ko-KR-BongJinNeural",
  "ko-KR-GookMinNeural" = "ko-KR-GookMinNeural",
  
  // Russian voices
  "ru-RU-SvetlanaNeural" = "ru-RU-SvetlanaNeural",
  "ru-RU-DmitryNeural" = "ru-RU-DmitryNeural",
  "ru-RU-DariyaNeural" = "ru-RU-DariyaNeural",
  
  // Arabic voices
  "ar-SA-ZariyahNeural" = "ar-SA-ZariyahNeural",
  "ar-SA-HamedNeural" = "ar-SA-HamedNeural",
  "ar-EG-ShakirNeural" = "ar-EG-ShakirNeural",
  "ar-EG-SalmaNeural" = "ar-EG-SalmaNeural",
  
  // Hindi voices
  "hi-IN-SwaraNeural" = "hi-IN-SwaraNeural",
  "hi-IN-MadhurNeural" = "hi-IN-MadhurNeural",
  
  // Dutch voices
  "nl-NL-ColetteNeural" = "nl-NL-ColetteNeural",
  "nl-NL-MaartenNeural" = "nl-NL-MaartenNeural",
  "nl-NL-FennaNeural" = "nl-NL-FennaNeural",
  
  // Swedish voices
  "sv-SE-SofieNeural" = "sv-SE-SofieNeural",
  "sv-SE-MattiasNeural" = "sv-SE-MattiasNeural",
  "sv-SE-HilleviNeural" = "sv-SE-HilleviNeural",
  
  // Norwegian voices
  "nb-NO-IselinNeural" = "nb-NO-IselinNeural",
  "nb-NO-FinnNeural" = "nb-NO-FinnNeural",
  "nb-NO-PernilleNeural" = "nb-NO-PernilleNeural",
  
  // Danish voices
  "da-DK-ChristelNeural" = "da-DK-ChristelNeural",
  "da-DK-JeppeNeural" = "da-DK-JeppeNeural",
  
  // Finnish voices
  "fi-FI-NooraNeural" = "fi-FI-NooraNeural",
  "fi-FI-HarriNeural" = "fi-FI-HarriNeural",
  "fi-FI-SelmaNeural" = "fi-FI-SelmaNeural",
}

export enum OrientationEnum {
  landscape = "landscape",
  portrait = "portrait",
}

export enum MusicVolumeEnum {
  muted = "muted",
  low = "low",
  medium = "medium",
  high = "high",
}

export const renderConfig = z.object({
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
  captionPosition: z
    .nativeEnum(CaptionPositionEnum)
    .optional()
    .describe("Position of the caption in the video"),
  captionBackgroundColor: z
    .string()
    .optional()
    .describe(
      "Background color of the caption, a valid css color, default is blue",
    ),  voice: z
    .string()
    .optional()
    .describe("Voice to be used for the speech, default is en-US-AriaNeural"),
  orientation: z
    .nativeEnum(OrientationEnum)
    .optional()
    .describe("Orientation of the video, default is portrait"),  musicVolume: z
    .nativeEnum(MusicVolumeEnum)
    .optional()
    .describe("Volume of the music, default is high"),
});
export type RenderConfig = z.infer<typeof renderConfig>;

export type Voices = string;

export type Video = {
  id: string;
  url: string;
  width: number;
  height: number;
};
export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
};

export type CaptionLine = {
  texts: Caption[];
};
export type CaptionPage = {
  startMs: number;
  endMs: number;
  lines: CaptionLine[];
};

export const createShortInput = z.object({
  scenes: z.array(sceneInput).describe("Each scene to be created"),
  config: renderConfig.describe("Configuration for rendering the video"),
});
export type CreateShortInput = z.infer<typeof createShortInput>;

export type VideoStatus = "processing" | "ready" | "failed";

export type Music = {
  file: string;
  start: number;
  end: number;
  mood: string;
};
export type MusicForVideo = Music & {
  url: string;
};

export type MusicTag = `${MusicMoodEnum}`;



export type whisperModels =
  | "tiny"
  | "tiny.en"
  | "base"
  | "base.en"
  | "small"
  | "small.en"
  | "medium"
  | "medium.en"
  | "large-v1"
  | "large-v2"
  | "large-v3"
  | "large-v3-turbo";
