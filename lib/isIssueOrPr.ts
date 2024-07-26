import { execSync } from "node:child_process"

export async function isIssueOrPr(issueNumber, repoInfo) {
  if (repoInfo.useOctokit && repoInfo.octokit) {
    try {
      const { data: pr } = await repoInfo.octokit.pulls.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: parseInt(issueNumber),
      })
      return true
    } catch (error: any) {
      return false
    }
  } else {
    try {
      execSync(`gh pr view ${issueNumber} --json id`)
      return true
    } catch (error: any) {
      return false
    }
  }
}
