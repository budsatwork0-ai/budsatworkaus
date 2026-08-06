import { z } from 'zod';

/**
 * Input schema for the design-developer agent.
 * Rejects null/malformed design-insight payloads before any processing begins.
 */
export const DesignInsightPayloadSchema = z.object({
  proposalId: z.string().min(1, 'proposalId is required'),
  insight: z.string().min(1, 'insight must be a non-empty string'),
  targetFiles: z.array(z.string().min(1)).min(1, 'at least one target file is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DesignInsightPayload = z.infer<typeof DesignInsightPayloadSchema>;
