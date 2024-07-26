import { execSync } from "node:child_process"

export async function isIssueOrPr(
  issueNumber,
  repoInfo,
): Promise<"issue" | "pr"> {
  if (repoInfo.useOctokit && repoInfo.octokit) {
    try {
      const { data: pr } = await repoInfo.octokit.pulls.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: parseInt(issueNumber),
      })
      return "pr"
    } catch (error: any) {
      console.log("Error fetching PR:", error.message)
      return "issue"
    }
  } else {
    try {
      execSync(`gh pr view ${issueNumber} --json id`)
      return "pr"
    } catch (error: any) {
      console.log("Error fetching PR:", error.message)
      return "issue"
    }
  }
}
