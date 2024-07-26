import { execSync } from "child_process"

export async function getIssueInfo(issueNumber, repoInfo) {
  if (repoInfo.useOctokit) {
    const { data: issue } = await repoInfo.octokit.issues.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      issue_number: parseInt(issueNumber),
    })
    return { title: issue.title, body: issue.body }
  } else {
    const issueInfo = JSON.parse(
      execSync(`gh issue view ${issueNumber} --json title,body`).toString(),
    )
    return issueInfo
  }
}
