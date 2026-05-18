/**
 * Minimal GitHub webhook payload types.
 *
 * Only the fields we actually read are typed — the real payloads are much
 * larger. Use `unknown` casts where you need fields not listed here.
 */

// ── Shared primitives ─────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  full_name: string;       // e.g. "owner/budsatwork"
  name: string;
  html_url: string;
  default_branch: string;
}

export interface GitHubCommit {
  id: string;
  message: string;
  author: { name: string; email: string };
  url: string;
  added: string[];
  removed: string[];
  modified: string[];
  timestamp: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

// ── Pull request ──────────────────────────────────────────────────────────────

export type PullRequestAction =
  | 'opened' | 'closed' | 'reopened' | 'edited'
  | 'synchronize' | 'labeled' | 'unlabeled';

export interface PullRequestPayload {
  action: PullRequestAction;
  number: number;
  pull_request: {
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    draft: boolean;
    user: GitHubUser;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
    labels: GitHubLabel[];
    additions: number;
    deletions: number;
    changed_files: number;
    commits: number;
  };
  repository: GitHubRepo;
  sender: GitHubUser;
}

// ── Push ──────────────────────────────────────────────────────────────────────

export interface PushPayload {
  ref: string;             // e.g. "refs/heads/main"
  before: string;          // previous HEAD sha
  after: string;           // new HEAD sha
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
  repository: GitHubRepo;
  pusher: { name: string; email: string };
  compare: string;         // diff URL
}

// ── Deployment status ─────────────────────────────────────────────────────────

export type DeploymentState = 'pending' | 'in_progress' | 'success' | 'failure' | 'error';

export interface DeploymentStatusPayload {
  deployment_status: {
    state: DeploymentState;
    description: string;
    environment: string;   // e.g. "production", "preview"
    target_url: string;    // Vercel deployment URL
    created_at: string;
    updated_at: string;
    deployment_url: string;
  };
  deployment: {
    id: number;
    sha: string;
    ref: string;           // branch name
    description: string;
    environment: string;
    created_at: string;
  };
  repository: GitHubRepo;
  sender: GitHubUser;
}

// ── Release ───────────────────────────────────────────────────────────────────

export interface ReleasePayload {
  action: 'published' | 'created' | 'edited' | 'deleted';
  release: {
    tag_name: string;
    name: string | null;
    body: string | null;
    draft: boolean;
    prerelease: boolean;
    html_url: string;
    published_at: string;
    author: GitHubUser;
  };
  repository: GitHubRepo;
}

// ── Classification output ─────────────────────────────────────────────────────

export type ChangeType =
  | 'feature'
  | 'bug-fix'
  | 'architecture'
  | 'database'
  | 'agent'
  | 'ui'
  | 'config'
  | 'docs'
  | 'chore'
  | 'breaking';

export interface ChangeClassification {
  primary: ChangeType;
  secondary: ChangeType[];
  isBreaking: boolean;
  isArchitectural: boolean;
  affectedSystems: string[];  // e.g. ['agents', 'memory', 'stripe', 'dashboard']
}

// ── Processed event shapes ────────────────────────────────────────────────────

export interface ProcessedPR {
  number: number;
  title: string;
  url: string;
  author: string;
  branch: string;
  base: string;
  state: 'opened' | 'merged' | 'closed';
  classification: ChangeClassification;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  labels: string[];
  body: string;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  repo: string;
}

export interface ProcessedDeployment {
  environment: string;
  state: DeploymentState;
  sha: string;
  branch: string;
  url: string;
  description: string;
  timestamp: string;
  repo: string;
  durationMs?: number;
}

export interface ProcessedPush {
  branch: string;
  sha: string;
  compareUrl: string;
  commitCount: number;
  commits: GitHubCommit[];
  classification: ChangeClassification;
  author: string;
  repo: string;
  timestamp: string;
}
