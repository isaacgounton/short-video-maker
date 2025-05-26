import type { Caption } from "../../types/shorts";

export interface IWhisper {
  CreateCaption(audioPath: string): Promise<Caption[]>;
}
