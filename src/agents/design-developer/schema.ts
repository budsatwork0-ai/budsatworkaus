import { z } from 'zod';

export const DesignDeveloperInputSchema = z.object({
  componentName: z.string().min(1),
  description: z.string().min(1),
  requirements: z.array(z.string()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type DesignDeveloperInput = z.infer<typeof DesignDeveloperInputSchema>;
