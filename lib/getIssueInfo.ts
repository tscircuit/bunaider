import { execSync } from "child_process"

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getIssueInfo(issueNumber: string, repoInfo: any) {
  let retries = 0
  while (retries < MAX_RETRIES) {
    try {
      if (repoInfo.useOctokit) {
        console.log(`Getting issue #${issueNumber} info with Octokit`)
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
        console.log(`Getting issue #${issueNumber} info with GitHub CLI`)
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
    } catch (error: any) {
      console.error(
        `Error fetching issue info (attempt ${retries + 1}):`,
        error.message,
      )
      if (retries === MAX_RETRIES - 1) {
        throw error // Throw the error if we've exhausted all retries
      }
      await sleep(RETRY_DELAY * (retries + 1)) // Exponential backoff
      retries++
    }
  }
  throw new Error("Failed to fetch issue info after multiple attempts")
}
