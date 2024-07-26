import type { PullRequestReviewComment } from "@octokit/webhooks-types"
import { execSync } from "child_process"

export async function scanPullRequestComments(prNumber, repoInfo) {
  let comments: Array<{
    body: string
    submittedAt: string
    state: "COMMENTED" | "DISMISSED" | "CHANGES_REQUESTED"
    author: { login: string }
    id: string
  }> = []
  if (repoInfo.useOctokit) {
    const { data } = await repoInfo.octokit.pulls.listReviewComments({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      pull_number: parseInt(prNumber),
    })
    comments = data
  } else {
    const prResRaw = execSync(
      `gh pr view ${prNumber} --json comments,reviews`,
    ).toString()
    const prRes = JSON.parse(prResRaw)
    comments = prRes.comments.concat(prRes.reviews)
  }

  return comments
    .filter((comment) => comment.body.startsWith("aider: "))
    .map((comment) => ({
      ...comment,
      body: `${comment.path}: ${comment.body}`,
    }))
}
