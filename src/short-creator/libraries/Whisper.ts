import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
} from "@remotion/install-whisper-cpp";
import path from "path";
import fs from "fs";

import { Config } from "../../config";
import type { Caption } from "../../types/shorts";
import { IWhisper } from "./IWhisper";
import { logger } from "../../logger";

export const ErrorWhisper = new Error("There was an error with WhisperCpp");

export class Whisper implements IWhisper {
  constructor(private config: Config) {}

  static async init(config: Config): Promise<Whisper> {
    // Check if we're using a shared Whisper installation
    const isSharedWhisper = process.env.SHARED_WHISPER_PATH;
    
    if (!config.runningInDocker && !isSharedWhisper) {
      logger.debug("Installing WhisperCpp");
      await installWhisperCpp({
        to: config.whisperInstallPath,
        version: config.whisperVersion,
        printOutput: true,
      });
      logger.debug("WhisperCpp installed");
      logger.debug("Downloading Whisper model");
      await downloadWhisperModel({
        model: config.whisperModel,
        folder: path.join(config.whisperInstallPath, "models"),
        printOutput: config.whisperVerbose,
        onProgress: (downloadedBytes: number, totalBytes: number) => {
          const progress = `${Math.round((downloadedBytes / totalBytes) * 100)}%`;
          logger.debug(
            { progress, model: config.whisperModel },
            "Downloading Whisper model",
          );
        },
      });
      // todo run the jfk command to check if everything is ok
      logger.debug("Whisper model downloaded");
    } else if (isSharedWhisper) {
      logger.info("Using shared Whisper installation at:", config.whisperInstallPath);
      logger.info("Expected model folder:", path.join(config.whisperInstallPath, "models"));
      logger.info("Looking for model:", config.whisperModel);
      
      // Check if model directory and files exist
      const modelFolder = path.join(config.whisperInstallPath, "models");
      try {
        if (fs.existsSync(modelFolder)) {
          const files = fs.readdirSync(modelFolder);
          logger.info("Available model files:", files);
        } else {
          logger.error("Model folder does not exist:", modelFolder);
        }
      } catch (error) {
        logger.error("Error checking model folder:", error);
      }
    } else {
      logger.debug("Running in Docker with pre-built Whisper installation");
    }

    return new Whisper(config);
  }

  // todo shall we extract it to a Caption class?
  async CreateCaption(audioPath: string): Promise<Caption[]> {
    logger.debug({ audioPath }, "Starting to transcribe audio");
    const { transcription } = await transcribe({
      model: this.config.whisperModel,
      whisperPath: this.config.whisperInstallPath,
      modelFolder: path.join(this.config.whisperInstallPath, "models"),
      whisperCppVersion: this.config.whisperVersion,
      inputPath: audioPath,
      tokenLevelTimestamps: true,
      printOutput: this.config.whisperVerbose,
      onProgress: (progress: any) => {
        logger.debug({ audioPath }, `Transcribing is ${progress} complete`);
      },
    });
    logger.debug({ audioPath }, "Transcription finished, creating captions");

    const captions: Caption[] = [];
    transcription.forEach((record: any) => {
      if (record.text === "") {
        return;
      }

      record.tokens.forEach((token: any) => {
        if (token.text.startsWith("[_TT")) {
          return;
        }
        // if token starts without space and the previous node didn't have space either, merge them
        if (
          captions.length > 0 &&
          !token.text.startsWith(" ") &&
          !captions[captions.length - 1].text.endsWith(" ")
        ) {
          captions[captions.length - 1].text += record.text;
          captions[captions.length - 1].endMs = record.offsets.to;
          return;
        }
        captions.push({
          text: token.text,
          startMs: record.offsets.from,
          endMs: record.offsets.to,
        });
      });
    });
    logger.debug({ audioPath, captions }, "Captions created");
    return captions;
  }
}
