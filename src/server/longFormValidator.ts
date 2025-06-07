import { createLongFormInput, type CreateLongFormInput } from "../types/longform";

export function validateCreateLongFormInput(input: unknown): CreateLongFormInput {
  try {
    return createLongFormInput.parse(input);
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Parse Zod validation error and create a more user-friendly message
      let message = "Validation failed";
      let missingFields: string[] = [];
      
      try {
        const zodError = JSON.parse(error.message);
        if (zodError.issues) {
          message = zodError.issues.map((issue: any) => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join('; ');
          
          missingFields = zodError.issues.map((issue: any) => issue.path.join('.'));
        }
      } catch {
        message = error.message;
      }
      
      throw new Error(JSON.stringify({
        message,
        missingFields,
        originalError: error.message
      }));
    }
    throw error;
  }
}
