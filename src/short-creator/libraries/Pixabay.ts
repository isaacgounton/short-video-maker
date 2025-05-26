/* eslint-disable @remotion/deterministic-randomness */
import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PixabayAPI {
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }

    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pixabay API",
    );

    const response = await fetch(
      `https://pixabay.com/api/videos/?key=${this.API_KEY}&q=${encodeURIComponent(searchTerm)}&per_page=100`,
      {
        method: "GET",
        signal: AbortSignal.timeout(timeout),
      }
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "Invalid Pixabay API key - please make sure you get a valid key from https://pixabay.com/api/docs/ and set it in the environment variable PIXABAY_API_KEY",
            );
          }
          throw new Error(`Pixabay API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pixabay API");
        throw error;
      });

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

    if (!response.hits || response.hits.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pixabay API",
      );
      throw new Error("No videos found");
    }

    // Filter videos based on criteria
    const filteredVideos = response.hits
      .map((video: any) => {
        if (excludeIds.includes(video.id.toString())) {
          return;
        }

        // Get the appropriate video size based on orientation
        const videoFile = orientation === OrientationEnum.portrait
          ? video.videos.large // Portrait mode
          : video.videos.large; // Landscape mode

        // Pixabay doesn't provide duration in API, so we'll have to rely on size/quality
        if (videoFile) {
          const width = orientation === OrientationEnum.portrait ? 864 : 1920;
          const height = orientation === OrientationEnum.portrait ? 1080 : 1080;
          
          return {
            id: video.id.toString(),
            url: videoFile.url,
            width,
            height,
          };
        }
      })
      .filter(Boolean);

    if (!filteredVideos.length) {
      logger.error({ searchTerm }, "No videos found in Pixabay API");
      throw new Error("No videos found");
    }

    const video = filteredVideos[
      Math.floor(Math.random() * filteredVideos.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pixabay API",
    );

    return video;
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
  ): Promise<Video> {
    // shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = searchTerms.sort(() => Math.random() - 0.5);

    for (const searchTerm of [...shuffledSearchTerms, ...shuffledJokerTerms]) {
      try {
        return await this._findVideo(
          searchTerm,
          minDurationSeconds,
          excludeIds,
          orientation,
          timeout,
        );
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error instanceof DOMException &&
          error.name === "TimeoutError"
        ) {
          if (retryCounter < retryTimes) {
            logger.warn(
              { searchTerm, retryCounter },
              "Timeout error, retrying...",
            );
            return await this.findVideo(
              searchTerms,
              minDurationSeconds,
              excludeIds,
              orientation,
              timeout,
              retryCounter + 1,
            );
          }
          logger.error(
            { searchTerm, retryCounter },
            "Timeout error, retry limit reached",
          );
          throw error;
        }

        logger.error(error, "Error finding video in Pixabay API for term");
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pixabay API for the given terms",
    );
    throw new Error("No videos found in Pixabay API");
  }
}
