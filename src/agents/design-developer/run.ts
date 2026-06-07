import { DesignDeveloperInputSchema } from './schema';

export async function run(input: unknown): Promise<string> {
  const parsed = DesignDeveloperInputSchema.parse(input);

  const { componentName, description, requirements = [], context = {} } = parsed;

  // Build prompt from validated input
  const requirementLines =
    requirements.length > 0
      ? requirements.map((r) => `- ${r}`).join('\n')
      : '- No specific requirements provided';

  const contextStr =
    Object.keys(context).length > 0
      ? JSON.stringify(context, null, 2)
      : 'No additional context';

  const prompt = [
    `Component: ${componentName}`,
    `Description: ${description}`,
    `Requirements:\n${requirementLines}`,
    `Context:\n${contextStr}`,
  ].join('\n\n');

  return prompt;
}
