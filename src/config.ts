import path from "path";
import "dotenv/config";
import os from "os";
import fs from "fs-extra";
import pino from "pino";
import bcrypt from "bcryptjs";

const defaultLogLevel: pino.Level = "info";
const defaultPort = 3123;
const defaultTtsApiUrl = "https://tts.dahopevi.com/api";
const defaultTranscriptionApiUrl = "https://api.dahopevi.com";

// Create the global logger
const versionNumber = process.env.npm_package_version;
export const logger = pino({
  level: process.env.LOG_LEVEL || defaultLogLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    pid: process.pid,
    version: versionNumber,
  },
});

export class Config {
  private dataDirPath: string;
  private libsDirPath: string;
  private staticDirPath: string;

  public installationSuccessfulPath: string;
  public videosDirPath: string;
  public tempDirPath: string;
  public packageDirPath: string;
  public musicDirPath: string;
  public pexelsApiKey: string;
  public logLevel: pino.Level;
  public port: number;
  public runningInDocker: boolean;
  public devMode: boolean;
  public ttsApiUrl: string = defaultTtsApiUrl;
  public transcriptionApiUrl: string = defaultTranscriptionApiUrl;
  public transcriptionApiKey: string;
  public publicUrl: string;

  // Authentication configuration
  public authUsername: string;
  public authPasswordHash: string;
  public sessionSecret: string;

  // docker-specific, performance-related settings to prevent memory issues
  public concurrency?: number;
  public videoCacheSizeInBytes: number | null = null;

  constructor() {
    this.dataDirPath =
      process.env.DATA_DIR_PATH ||
      path.join(os.homedir(), ".ai-agents-az-video-generator");
    this.libsDirPath = path.join(this.dataDirPath, "libs");

    this.videosDirPath = path.join(this.dataDirPath, "videos");
    this.tempDirPath = path.join(this.dataDirPath, "temp");
    this.installationSuccessfulPath = path.join(
      this.dataDirPath,
      "installation-successful",
    );

    fs.ensureDirSync(this.dataDirPath);
    fs.ensureDirSync(this.libsDirPath);
    fs.ensureDirSync(this.videosDirPath);
    fs.ensureDirSync(this.tempDirPath);

    this.packageDirPath = path.join(__dirname, "..");
    this.staticDirPath = path.join(this.packageDirPath, "static");
    this.musicDirPath = path.join(this.staticDirPath, "music");

    this.pexelsApiKey = process.env.PEXELS_API_KEY as string;
    this.logLevel = (process.env.LOG_LEVEL || defaultLogLevel) as pino.Level;
    this.port = process.env.PORT ? parseInt(process.env.PORT) : defaultPort;
    this.runningInDocker = process.env.DOCKER === "true";
    this.devMode = process.env.DEV === "true";

    this.ttsApiUrl = process.env.TTS_API_URL || defaultTtsApiUrl;
    this.transcriptionApiUrl = process.env.TRANSCRIPTION_API_URL || defaultTranscriptionApiUrl;
    this.transcriptionApiKey = process.env.DAHOPEVI_API_KEY || "";
    this.publicUrl = process.env.PUBLIC_URL || `http://localhost:${this.port}`;
    
    // Authentication configuration
    this.authUsername = process.env.AUTH_USERNAME || "etugrand";
    
    // If AUTH_PASSWORD_HASH is provided and looks like a bcrypt hash, use it directly
    // Otherwise, if it's a plain password or not provided, hash it
    const envPasswordHash = process.env.AUTH_PASSWORD_HASH;
    if (envPasswordHash && envPasswordHash.startsWith('$2')) {
      // Already a bcrypt hash
      this.authPasswordHash = envPasswordHash;
    } else {
      // Plain text password or default, needs to be hashed
      const plainPassword = envPasswordHash || "O0UgSbS4cbOmFa";
      this.authPasswordHash = bcrypt.hashSync(plainPassword, 10);
    }
    
    this.sessionSecret = process.env.SESSION_SECRET || "your-super-secret-session-key-change-this-in-production";
    
    this.concurrency = process.env.CONCURRENCY
      ? parseInt(process.env.CONCURRENCY)
      : undefined;

    if (process.env.VIDEO_CACHE_SIZE_IN_BYTES) {
      this.videoCacheSizeInBytes = parseInt(
        process.env.VIDEO_CACHE_SIZE_IN_BYTES,
      );
    }
  }

  public ensureConfig() {
    if (!this.pexelsApiKey) {
      throw new Error(
        "PEXELS_API_KEY environment variable is missing. Get your free API key: https://www.pexels.com/api/key/ - see how to run the project: https://github.com/gyoridavid/short-video-maker",
      );
    }
  }
}
