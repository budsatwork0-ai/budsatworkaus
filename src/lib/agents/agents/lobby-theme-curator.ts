/**
 * Lobby Theme Curator — generates new visual themes for the agent lobby.
 *
 * Each theme is a JSON token bundle (palette, banners, fonts, per-agent
 * emoji map) that the lobby reads at render time. Themes are stored in
 * `lobby_themes` and exactly one can be `active` (a trigger enforces it).
 *
 * Run with input.brief = 'cyberpunk neon under-the-floor server farm' or
 * any free-form description; the agent will produce one matching theme.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { AGENT_LIST } from '../registry';

const SYSTEM = `You design visual themes for an AI-agent "lobby" — a
top-down view where each agent has a station. Given a brief, output a
strict JSON theme token bundle:
{
  "id": "kebab-slug",
  "name": "Display Name",
  "description": "1 sentence",
  "tokens": {
    "palette": {
      "bg_outer": "#hex", "bg_inner": "#hex",
      "stone_dark": "#hex", "stone_mid": "#hex", "stone_light": "#hex",
      "wood_dark": "#hex", "wood_mid": "#hex", "wood_light": "#hex",
      "parchment": "#hex", "ink": "#hex",
      "fire": "#hex", "ember": "#hex", "candle": "#hex",
      "gold": "#hex", "silver": "#hex"
    },
    "banners": { "sales": "#hex", "support": "#hex", "ops": "#hex",
                 "finance": "#hex", "hiring": "#hex", "compliance": "#hex" },
    "fonts": { "display": "css font-family", "body": "css font-family" },
    "emojis": { "<agent-id>": "single emoji", ... }
  }
}
Requirements:
- Use real Unicode emojis (no images).
- Pick distinct, on-brief emojis for every agent id provided.
- All colors are valid hex strings.
- Theme should be legible and not blinding.`;

export const lobbyThemeCuratorAgent: AgentDefinition = {
  id: 'lobby-theme-curator',
  name: 'Lobby Theme Curator',
  description: 'Generates visual themes (medieval, cyberpunk, retro arcade...) for the agent lobby.',
  category: 'ops',
  autonomy: 'manual',
  async run(ctx: AgentContext) {
    const brief = (ctx.input?.brief as string | undefined) ?? 'cyberpunk neon basement server farm';
    const activateOnApprove = (ctx.input?.activate as boolean | undefined) ?? false;

    const agentIds = AGENT_LIST.map((a) => a.id);

    const raw = await ctx.llm(
      `Brief: "${brief}"\nAgents needing emojis (${agentIds.length}): ${agentIds.join(', ')}\nProduce the theme JSON.`,
      { system: SYSTEM },
    );

    let theme: { id: string; name: string; description: string; tokens: Record<string, unknown> };
    try { theme = JSON.parse(raw); } catch { return { summary: 'Could not parse theme JSON.' }; }

    const { error } = await ctx.supabase.from('lobby_themes').upsert({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      tokens: theme.tokens,
      active: false,
    }, { onConflict: 'id' });

    if (error) throw new Error(`save theme: ${error.message}`);

    await ctx.proposeAction({
      action_type: 'flag_for_review',
      target_table: 'lobby_themes',
      target_id: theme.id,
      preview: `New theme: ${theme.name} — "${theme.description.slice(0, 80)}"`,
      payload: { theme_id: theme.id, activate_on_approve: activateOnApprove, brief },
    });

    return {
      summary: `Theme "${theme.name}" drafted. ${activateOnApprove ? 'Will activate on approval.' : 'Approve to keep; activate separately.'}`,
      output: { theme_id: theme.id },
    };
  },
};
