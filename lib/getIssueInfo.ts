import { execSync } from "child_process"

export async function getIssueInfo(issueNumber: string, repoInfo: any) {
  if (repoInfo.useOctokit) {
    const { data: issue } = await repoInfo.octokit.issues.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      issue_number: parseInt(issueNumber),
    })
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      labels: issue.labels.map((label: any) => label.name),
    }
  } else {
    const issueInfo = JSON.parse(
      execSync(
        `gh issue view ${issueNumber} --json number,title,body,state,createdAt,updatedAt,labels`,
      ).toString(),
    )
    return {
      ...issueInfo,
      created_at: issueInfo.createdAt,
      updated_at: issueInfo.updatedAt,
      labels: issueInfo.labels.map((label: any) => label.name),
    }
  }
}
