import axios from "axios";
import fs from "fs";
import path from "path";

import { Config } from "../../config";
import type { Caption } from "../../types/shorts";
import { IWhisper } from "./IWhisper";
import { logger } from "../../logger";

export const ErrorDahopeviWhisper = new Error("There was an error with Dahopevi Whisper API");

export class DahopeviWhisper implements IWhisper {
  private baseUrl: string;
  private apiKey: string;

  constructor(private config: Config) {
    // For Whisper, always use local dahopevi container since external API can't access container files
    // TTS can continue using external API since it doesn't need file uploads
    this.baseUrl = process.env.DAHOPEVI_BASE_URL || "http://api:8080";
    // Use API_KEY for local dahopevi container (matches config.py)
    this.apiKey = process.env.API_KEY || process.env.DAHOPEVI_API_KEY || "";
  }

  static async init(config: Config): Promise<DahopeviWhisper> {
    logger.info("Initializing Dahopevi Whisper API client");
    return new DahopeviWhisper(config);
  }

  async CreateCaption(audioPath: string): Promise<Caption[]> {
    logger.debug({ audioPath }, "Starting to transcribe audio using Dahopevi API");
    
    try {
      // Upload the audio file and get transcription with word-level timestamps
      const transcriptionResult = await this.transcribeAudio(audioPath);
      
      // Parse the ASS format response to extract captions
      const captions = this.parseAssToCaption(transcriptionResult);
      
      logger.debug({ audioPath, captionCount: captions.length }, "Captions created from Dahopevi API");
      return captions;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ audioPath, error: errorMessage }, "Failed to transcribe audio using Dahopevi API");
      throw new Error(`Dahopevi transcription failed: ${errorMessage}`);
    }
  }

  private async transcribeAudio(audioPath: string): Promise<string> {
    try {
      // First, upload the audio file to get a URL
      const uploadUrl = await this.uploadAudioFile(audioPath);
      
      // Then request transcription with ASS format for word-level timestamps
      const response = await axios.post(
        `${this.baseUrl}/transcribe-media`,
        {
          media_url: uploadUrl,
          output: "ass", // Use ASS format to get word-level timestamps
          max_chars: 56
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey && { "x-api-key": this.apiKey })
          },
          timeout: 300000 // 5 minutes timeout
        }
      );

      // Handle both synchronous (200) and asynchronous (202) responses
      if (response.status === 202) {
        // Asynchronous processing - need to poll for results
        const jobInfo = response.data;
        logger.debug({ jobInfo }, "Received 202 response for transcription");
        
        // The job_id might be directly in the response or nested
        const jobId = jobInfo.job_id || jobInfo.id || jobInfo.jobId;
        if (jobId) {
          logger.info({ jobId }, "Transcription job submitted, polling for results");
          const assContent = await this.pollForTranscriptionResult(jobId);
          return assContent;
        } else {
          throw new Error(`Received 202 but no job_id found in response: ${JSON.stringify(jobInfo)}`);
        }
      } else if (response.status !== 200) {
        throw new Error(`Transcription request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      // Synchronous response (200) - process immediately
      let assContent = response.data;
      
      // Handle different response formats from dahopevi API
      if (typeof assContent === 'object' && assContent !== null) {
        // If response is an object, look for common fields
        if (assContent.response) {
          assContent = assContent.response;
        } else if (assContent.result) {
          assContent = assContent.result;
        } else if (assContent.data) {
          assContent = assContent.data;
        }
      }
      
      // If it's a URL, download the content
      if (typeof assContent === 'string' && assContent.startsWith('http')) {
        const downloadResponse = await axios.get(assContent);
        assContent = downloadResponse.data;
      }
      
      // Ensure we have a string for parsing
      if (typeof assContent !== 'string') {
        throw new Error(`Expected string response but got ${typeof assContent}: ${JSON.stringify(assContent)}`);
      }

      return assContent;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Error during Dahopevi transcription");
      throw error;
    }
  }

  private async pollForTranscriptionResult(jobId: string, maxAttempts: number = 60): Promise<string> {
    // Poll the job status endpoint until completion (max 5 minutes with 5s intervals)
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statusResponse = await axios.post(
          `${this.baseUrl}/v1/toolkit/job/status`,
          {
            job_id: jobId
          },
          {
            headers: {
              "Content-Type": "application/json",
              ...(this.apiKey && { "x-api-key": this.apiKey })
            },
            timeout: 10000 // 10 second timeout for status checks
          }
        );

        const jobStatus = statusResponse.data;
        logger.debug({ jobId, attempt, jobStatus }, "Polling transcription job status");

        // Check if job is completed based on the response structure
        if (jobStatus.job_status === 'done' && jobStatus.response) {
          logger.info({ jobId, attempts: attempt }, "Transcription job completed successfully");
          
          // The result should be in jobStatus.response.response
          let result = jobStatus.response.response;
          if (typeof result === 'string' && result.startsWith('http')) {
            // It's a URL, download the content
            const downloadResponse = await axios.get(result);
            result = downloadResponse.data;
          }
          
          return typeof result === 'string' ? result : JSON.stringify(result);
        } else if (jobStatus.job_status === 'failed') {
          throw new Error(`Transcription job failed: ${jobStatus.error || 'Unknown error'}`);
        }

        // Still processing, wait before next poll
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn({ jobId, attempt, error: errorMessage }, "Error polling transcription job status");
        
        if (attempt >= maxAttempts) {
          throw new Error(`Failed to get transcription result after ${maxAttempts} attempts: ${errorMessage}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`Transcription job polling timed out after ${maxAttempts} attempts (${maxAttempts * 5} seconds)`);
  }

  private async uploadAudioFile(audioPath: string): Promise<string> {
    // For external dahopevi API, we need to upload the file via multipart/form-data
    // or provide a publicly accessible URL. Since we're using external API,
    // we'll use a simple approach - serve the file via the short-video-maker's HTTP server
    
    const fileName = path.basename(audioPath);
    
    // Check if we're using local dahopevi (container network) or external API
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('api:')) {
      // Local container network - use the correct service name
      const fileUrl = `http://short-creator:3123/api/tmp/${fileName}`;
      logger.debug({ audioPath, fileUrl }, "Audio file accessible via local container network");
      return fileUrl;
    } else {
      // External API - need to provide a publicly accessible URL
      // For now, we'll try the container approach and let the API handle it
      // In production, you might want to upload to a cloud storage service
      const fileUrl = `http://short-creator:3123/api/tmp/${fileName}`;
      logger.debug({ audioPath, fileUrl }, "Audio file URL for external API (may need public access)");
      return fileUrl;
    }
  }

  private parseAssToCaption(assContent: string): Caption[] {
    const captions: Caption[] = [];
    
    // Parse ASS format to extract word-level timestamps
    const lines = assContent.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        try {
          // Parse ASS dialogue line format:
          // Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
          const parts = line.split(',');
          if (parts.length < 10) continue;
          
          const startTime = this.parseAssTime(parts[1]);
          const endTime = this.parseAssTime(parts[2]);
          
          // Extract text and remove ASS formatting
          const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').trim();
          
          if (text && startTime !== null && endTime !== null) {
            captions.push({
              text: text,
              startMs: startTime,
              endMs: endTime
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn({ line, error: errorMessage }, "Failed to parse ASS line");
        }
      }
    }
    
    return captions;
  }

  private parseAssTime(timeStr: string): number | null {
    try {
      // ASS time format: H:MM:SS.CC (hours:minutes:seconds.centiseconds)
      const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
      if (!match) return null;
      
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const centiseconds = parseInt(match[4]);
      
      return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ timeStr, error: errorMessage }, "Failed to parse ASS time");
      return null;
    }
  }
}
