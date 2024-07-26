import type { PullRequestReviewComment } from "@octokit/webhooks-types"
import { execSync } from "child_process"
import type { Endpoints } from "@octokit/types"

export async function scanPullRequestComments(prNumber, repoInfo) {
  let comments: Array<{
    body: string
    submittedAt?: string
    state?: "COMMENTED" | "DISMISSED" | "CHANGES_REQUESTED"
    author: { login?: string }
    path?: string
    id: string
  }> = []
  if (repoInfo.useOctokit) {
    const { data: commentData } =
      (await repoInfo.octokit.pulls.listReviewComments({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: parseInt(prNumber),
      })) as Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"]["response"]
    comments.push(
      ...commentData.map((c) => ({
        author: { login: c.user.login },
        body: c.body,
        id: c.id.toString(),
        path: c.path,
        submittedAt: c.created_at,
      })),
    )
    // Pull in the reviews
    const { data: reviewData } = (await repoInfo.octokit.pulls.listReviews({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      pull_number: parseInt(prNumber),
    })) as Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"]["response"]
    comments.push(
      ...reviewData.map((c) => ({
        author: { login: c.user?.login },
        body: c.body,
        id: c.id.toString(),
        submittedAt: c.submitted_at,
        state: c.state as
          | "COMMENTED"
          | "DISMISSED"
          | "CHANGES_REQUESTED"
          | undefined,
      })),
    )
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
