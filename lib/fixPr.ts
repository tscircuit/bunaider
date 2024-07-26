import { execSync } from "child_process"
import { escapeShell } from "./escapeShell"
import { getIssueInfo } from "./getIssueInfo"
import { scanPullRequestComments } from "./scanPullRequestComments"

export async function fixPr(prNumber, repoInfo) {
  try {
    console.log(`Fetching PR #${prNumber} from GitHub...`)

    // 1. Fetch the PR
    let pr: { headRefName: string; body: string; title: string }
    if (repoInfo.useOctokit) {
      const { data } = await repoInfo.octokit.pulls.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: parseInt(prNumber),
      })
      pr = {
        headRefName: data.head.ref,
        body: data.body,
        title: data.title,
      }
    } else {
      pr = JSON.parse(
        execSync(
          `gh pr view ${prNumber} --json number,title,body,headRefName`,
        ).toString(),
      )
    }

    // Make sure we're on the PR branch
    try {
      execSync(`git checkout ${pr.headRefName}`)
    } catch (error: any) {
      console.error("Error checking out the PR branch:", error.message)
      console.log("assuming we're already on the branch...")
    }

    // 2. Get all the review comments that start with "aider: "
    const comments = await scanPullRequestComments(prNumber, repoInfo)
    const aiderComments = comments
      .filter((comment) => comment.body.includes("aider: "))
      .map((comment) => {
        // Add filename to to the comment
        const filename = (comment as any).path ?? ""
        return `${filename ? `${filename}: ` : ""}${comment.body.substring(7)}`
      }) // Remove "aider: " prefix

    // 3. Get the original issue the PR is fixing
    const issueNumberMatch = pr.body.match(/#(\d+)/)
    let issueInfo: any = null
    let issueNumber: number | null = null
    if (issueNumberMatch) {
      issueNumber = parseInt(issueNumberMatch[1])
      issueInfo = await getIssueInfo(issueNumber, repoInfo)
    }

    // 4. Construct a message for aider
    let aiderMessage = `Fixing PR #${prNumber}: ${pr.title}\n\n`
    if (issueInfo) {
      aiderMessage += `Original Issue #${issueNumber}: ${issueInfo.title}\n${issueInfo.body}\n\n`
    }
    aiderMessage += `PR Description:\n${pr.body}\n\n`
    if (aiderComments.length > 0) {
      aiderMessage += `Review Comments:\n${aiderComments.join("\n")}\n\n`
    }
    aiderMessage +=
      "Please make the necessary changes to address the PR and review comments."

    // Get the PR diff
    const diff = execSync(`gh pr diff ${prNumber}`).toString()
    aiderMessage += `\n\nPR Diff:\n${diff}`

    console.log("Running aider to attempt a fix...")
    const escapedAiderMessage = escapeShell(aiderMessage)
    const aiderCommand = `aider --yes --message ${escapedAiderMessage}`

    execSync(aiderCommand, {
      stdio: "inherit",
      env: process.env,
    })

    console.log("Aider has completed its attempt to fix the PR.")

    // 6. Push the branch to the remote
    const branchName = pr.headRefName
    execSync(`git push origin ${branchName}`)

    console.log(`Changes have been pushed to the branch '${branchName}'.`)
    console.log("Please review the changes and update the PR if necessary.")
  } catch (error: any) {
    console.error("Error while attempting to fix the PR:", error.message)
    process.exit(1)
  }
}
