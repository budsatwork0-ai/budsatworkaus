export const TABLE_ALIASES: Record<string, string[]> = {
  expenses: ['payables'],
  feedback: ['site_feedback'],
  fundraising_campaigns: ['fundraising_items'],
  induction_progress: ['applicants'],
  users: ['profiles'],
};

export function physicalTableCandidates(table: string): string[] {
  return [table, ...(TABLE_ALIASES[table] ?? [])];
}

export function logicalAliasesForPhysicalTable(table: string): string[] {
  return Object.entries(TABLE_ALIASES)
    .filter(([, physicalTables]) => physicalTables.includes(table))
    .map(([logicalTable]) => logicalTable);
}
