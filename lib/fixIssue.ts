import { execSync } from "node:child_process"
import { getIssueInfo } from "./getIssueInfo"
import { escapeShell } from "./escapeShell"
import { createPullRequest } from "./createPullRequest"

export const fixIssue = async (issueNumber, repoInfo) => {
  try {
    console.log(`Fetching issue #${issueNumber} from GitHub...`)
    const { title, body } = await getIssueInfo(issueNumber, repoInfo)

    const issueContent = `Issue #${issueNumber}: ${title}\n\n${body}`
    console.log("Issue content:", issueContent)

    console.log("Running aider to attempt a fix...")
    const escapedIssueContent = escapeShell(issueContent)
    const aiderCommand = `aider --yes --message ${escapedIssueContent}`

    execSync(aiderCommand, {
      stdio: "inherit",
      env: process.env,
    })

    console.log("Aider has completed its attempt to fix the issue.")

    const branchName = `aider-fix-issue-${issueNumber}`
    try {
      execSync(`git branch -D ${branchName}`)
    } catch (error: any) {}
    try {
      execSync(`git checkout -b ${branchName}`)
    } catch (error: any) {}
    // Ensure that we're on the branchName by asking git what branch we're on

    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
      .toString()
      .trim()
    if (currentBranch !== branchName) {
      console.error(
        `Error: Could not switch to branch ${branchName}. Please check your Git configuration and try again.`,
      )
      process.exit(1)
    }

    // Push the branch to the remote at branchName
    execSync(`git push -f origin ${branchName}`)

    // If we are fixing an issue, create a PR, if we're fixing a pull request, push the commit

    await createPullRequest(branchName, issueNumber, repoInfo)

    console.log("Please review the changes and merge if they look good.")
  } catch (error: any) {
    console.error("Error while attempting to fix the issue:", error.message)
    process.exit(1)
  }
}
