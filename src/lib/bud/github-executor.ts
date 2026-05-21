import { Octokit } from '@octokit/rest';

const OWNER = process.env.GITHUB_REPO_OWNER ?? '';
const REPO = process.env.GITHUB_REPO_NAME ?? '';

function client(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is not set');
  return new Octokit({ auth: token });
}

export type WorkflowRunConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'timed_out'
  | 'skipped'
  | 'neutral'
  | 'action_required'
  | null;

export type WorkflowRunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';

export interface WorkflowRunResult {
  runId: number;
  name: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion;
  url: string;
  startedAt: string | null;
}

export async function createIssue(
  title: string,
  body: string,
  labels?: string[],
): Promise<{ url: string; number: number }> {
  const octokit = client();
  const res = await octokit.issues.create({
    owner: OWNER,
    repo: REPO,
    title,
    body,
    labels: labels ?? ['bud', 'automated'],
  });
  return { url: res.data.html_url, number: res.data.number };
}

export async function createBranch(
  name: string,
  fromBranch = 'main',
): Promise<void> {
  const octokit = client();
  const { data: ref } = await octokit.git.getRef({
    owner: OWNER,
    repo: REPO,
    ref: `heads/${fromBranch}`,
  });
  await octokit.git.createRef({
    owner: OWNER,
    repo: REPO,
    ref: `refs/heads/${name}`,
    sha: ref.object.sha,
  });
}

export async function createPR(
  title: string,
  body: string,
  head: string,
  base = 'main',
  draft = false,
): Promise<{ url: string; number: number }> {
  if (base === 'main' && head === 'main') {
    throw new Error('Cannot create PR from main to main');
  }
  const octokit = client();
  const res = await octokit.pulls.create({
    owner: OWNER,
    repo: REPO,
    title,
    body,
    head,
    base,
    draft,
  });
  return { url: res.data.html_url, number: res.data.number };
}

/**
 * Delete a branch. Used to roll back a repair branch when CI fails.
 * Silently returns if the branch does not exist.
 */
export async function deleteBranch(name: string): Promise<void> {
  const octokit = client();
  try {
    await octokit.git.deleteRef({
      owner: OWNER,
      repo: REPO,
      ref: `heads/${name}`,
    });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 422) return; // already gone
    throw err;
  }
}

/**
 * Fetch the most recent workflow run on a branch that started after `afterTimestamp`.
 * Returns null if no matching run exists or if GitHub Actions is not configured.
 */
export async function getLatestWorkflowRun(
  branch: string,
  afterTimestamp?: string,
): Promise<WorkflowRunResult | null> {
  if (!OWNER || !REPO) return null;
  const octokit = client();
  try {
    const res = await octokit.actions.listWorkflowRunsForRepo({
      owner: OWNER,
      repo: REPO,
      branch,
      per_page: 5,
      event: 'push',
    });
    const runs = res.data.workflow_runs;
    const candidates = afterTimestamp
      ? runs.filter((r) => r.run_started_at != null && r.run_started_at >= afterTimestamp)
      : runs;
    if (candidates.length === 0) return null;
    const run = candidates[0];
    return {
      runId: run.id,
      name: run.name ?? 'CI',
      status: run.status as WorkflowRunStatus,
      conclusion: (run.conclusion ?? null) as WorkflowRunConclusion,
      url: run.html_url,
      startedAt: run.run_started_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Poll GitHub Actions every `intervalMs` until a workflow run on `branch` completes
 * or `timeoutMs` elapses. Returns the last known run result and whether it timed out.
 *
 * - If no run is found within the first half of the timeout, assumes CI is not configured
 *   and returns `{ result: null, timedOut: false }` so callers can proceed normally.
 * - If a run exists but is still in progress at timeout, returns
 *   `{ result, timedOut: true }` so callers can open a draft PR.
 */
export async function pollWorkflowUntilComplete(
  branch: string,
  timeoutMs = 30_000,
  afterTimestamp?: string,
  intervalMs = 5_000,
): Promise<{ result: WorkflowRunResult | null; timedOut: boolean }> {
  const deadline = Date.now() + timeoutMs;
  const noRunDeadline = Date.now() + Math.floor(timeoutMs / 2); // give up on "no CI" faster
  let lastResult: WorkflowRunResult | null = null;

  while (Date.now() < deadline) {
    const run = await getLatestWorkflowRun(branch, afterTimestamp);
    if (run) {
      lastResult = run;
      if (run.status === 'completed') {
        return { result: run, timedOut: false };
      }
    } else if (Date.now() > noRunDeadline) {
      // No workflow run found within half the timeout — CI is probably not configured.
      return { result: null, timedOut: false };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Deadline reached with an in-progress run
  return { result: lastResult, timedOut: lastResult !== null };
}

export async function getIssueStatus(number: number): Promise<'open' | 'closed'> {
  const octokit = client();
  const res = await octokit.issues.get({ owner: OWNER, repo: REPO, issue_number: number });
  return res.data.state as 'open' | 'closed';
}

export async function getPRStatus(number: number): Promise<'open' | 'closed' | 'merged'> {
  const octokit = client();
  const res = await octokit.pulls.get({ owner: OWNER, repo: REPO, pull_number: number });
  if (res.data.merged) return 'merged';
  return res.data.state as 'open' | 'closed';
}

export async function branchExists(name: string): Promise<boolean> {
  if (!OWNER || !REPO) return false;
  const octokit = client();
  try {
    await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${name}` });
    return true;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return false;
    throw err;
  }
}

export function budBranchName(agentId: string): string {
  const ts = Date.now();
  const safe = agentId.replace(/[^a-z0-9-]/g, '-');
  return `bud/fix-${safe}-${ts}`;
}

/**
 * Read a file from a specific branch. Returns the file content as a UTF-8
 * string plus the blob SHA needed for subsequent writes.
 * Returns null if the file does not exist on that branch.
 */
export async function getFileContent(
  filePath: string,
  branch: string,
): Promise<{ content: string; sha: string } | null> {
  const octokit = client();
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      ref: branch,
    });
    if (!('content' in data) || typeof data.content !== 'string') return null;
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/**
 * Search GitHub issues and PRs in this repo.
 * Returns an empty array if GitHub is not configured or the search fails.
 */
export async function searchIssues(
  query: string,
  maxResults = 5,
): Promise<Array<{ title: string; url: string; state: string; createdAt: string; body: string | null }>> {
  if (!OWNER || !REPO) return [];
  const octokit = client();
  try {
    const res = await octokit.search.issuesAndPullRequests({
      q: `repo:${OWNER}/${REPO} ${query}`,
      per_page: maxResults,
      sort: 'updated',
      order: 'desc',
    });
    return res.data.items.map((item) => ({
      title: item.title,
      url: item.html_url,
      state: item.state,
      createdAt: item.created_at,
      body: item.body ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Write (create or update) a file on a branch.
 * Pass the SHA from `getFileContent` when updating; omit for new files.
 */
export async function writeFileToBranch(
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string,
  sha?: string,
): Promise<void> {
  const octokit = client();
  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: filePath,
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    sha,
  });
}
