import { Octokit } from '@octokit/rest';

const OWNER = process.env.GITHUB_REPO_OWNER ?? '';
const REPO = process.env.GITHUB_REPO_NAME ?? '';

function client(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is not set');
  return new Octokit({ auth: token });
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
  });
  return { url: res.data.html_url, number: res.data.number };
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

export function budBranchName(agentId: string): string {
  const ts = Date.now();
  const safe = agentId.replace(/[^a-z0-9-]/g, '-');
  return `bud/fix-${safe}-${ts}`;
}
