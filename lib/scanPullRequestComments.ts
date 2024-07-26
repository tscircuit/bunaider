import type { PullRequestReviewComment } from "@octokit/webhooks-types"
import { execSync } from "child_process"

export async function scanPullRequestComments(prNumber, repoInfo) {
  let comments: PullRequestReviewComment[] = []
  if (repoInfo.useOctokit) {
    const { data } = await repoInfo.octokit.pulls.listReviewComments({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      pull_number: parseInt(prNumber),
    })
    comments = data
  } else {
    const commentsJson = execSync(
      `gh pr view ${prNumber} --json comments`,
    ).toString()
    comments = JSON.parse(commentsJson).comments
  }

  return comments.filter((comment) => comment.body.startsWith("aider: "))
}
