/**
 * Public API for the agent workspace system.
 *
 * Workspaces are vault-native structured folders that agents write to
 * automatically at runtime. They provide:
 *   - Findings, Tasks, Decisions, Issues logs
 *   - LLM-generated periodic reports
 *   - Full audit history backlinkable from anywhere in the vault
 */

// Types
export type {
  WorkspaceConfig,
  AgentFinding,
  AgentTask,
  AgentDecision,
  AgentIssue,
  AgentReport,
  AgentRunLog,
  FindingSeverity,
  TaskStatus,
  TaskPriority,
  DecisionStatus,
  DecisionImpact,
  IssueSeverity,
  ReportPeriod,
  WorkspaceSubfolder,
} from './types';

export {
  WORKSPACES,
  WORKSPACE_SUBFOLDERS,
  AGENT_WORKSPACE_MAP,
} from './types';

// Workspace operations (Node.js only)
export {
  getWorkspace,
  getWorkspaceForAgent,
  scaffoldWorkspace,
  scaffoldAllWorkspaces,
  logFinding,
  logTask,
  logDecision,
  openIssue,
  resolveIssue,
  writeReport,
  logAgentRun,
  getRecentFindings,
  getActiveIssues,
  getLatestReportPath,
  readFile,
} from './workspace';

// Report generation (Node.js only — requires ANTHROPIC_API_KEY)
export { generateReport, generateAllReports } from './report';
export type { GenerateReportOpts } from './report';
