import { execSync } from "node:child_process"
import { getIssueInfo } from "./getIssueInfo"
import { escapeShell } from "./escapeShell"
import { createPullRequest } from "./createPullRequest"
import { commentOnIssue } from "./commentOnIssue"
import { getContextFiles } from "./getContextFiles"

export const fixIssue = async (issueNumber, repoInfo) => {
  try {
    console.log(`Fetching issue #${issueNumber} from GitHub...`)
    const { title, body } = await getIssueInfo(issueNumber, repoInfo)

    const issueContent = `Issue #${issueNumber}: ${title}\n\n${body}`
    console.log("Issue content:", issueContent)

    console.log("Getting context files...")
    const contextFiles = await getContextFiles()
    console.log(`Found ${contextFiles.length} context files`)

    console.log("Running aider to attempt a fix...")
    const escapedIssueContent = escapeShell(issueContent)
    const aiderCommand = `aider --yes --message ${escapedIssueContent} ${contextFiles.map(file => escapeShell(file)).join(' ')}`

    execSync(aiderCommand, {
      stdio: "inherit",
      env: process.env,
    })

    console.log("Aider has completed its attempt to fix the issue.")

    const branchName = `aider-fix-issue-${issueNumber}`
    console.log(`Attempting to create and switch to branch: ${branchName}`)
    
    try {
      execSync(`git branch -D ${branchName}`, { stdio: 'pipe' })
      console.log(`Deleted existing branch ${branchName}`)
    } catch (error: any) {
      console.log(`Branch ${branchName} did not exist, creating new`)
    }

    try {
      execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' })
      console.log(`Successfully created and switched to branch ${branchName}`)
    } catch (error: any) {
      console.error(`Error creating branch ${branchName}:`, error.message)
      console.log("Attempting to switch to existing branch")
      try {
        execSync(`git checkout ${branchName}`, { stdio: 'pipe' })
        console.log(`Successfully switched to existing branch ${branchName}`)
      } catch (switchError: any) {
        console.error(`Error switching to branch ${branchName}:`, switchError.message)
        throw new Error(`Failed to create or switch to branch ${branchName}`)
      }
    }

    // Ensure that we're on the branchName by asking git what branch we're on
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: 'pipe' })
      .toString()
      .trim()
    if (currentBranch !== branchName) {
      throw new Error(`Failed to switch to branch ${branchName}. Current branch is ${currentBranch}`)
    }

    console.log(`Pushing branch ${branchName} to remote`)
    try {
      execSync(`git push -f origin ${branchName}`, { stdio: 'pipe' })
      console.log(`Successfully pushed branch ${branchName} to remote`)
    } catch (pushError: any) {
      console.error(`Error pushing branch ${branchName} to remote:`, pushError.message)
      throw new Error(`Failed to push branch ${branchName} to remote`)
    }

    // If we are fixing an issue, create a PR, if we're fixing a pull request, push the commit

    const pullRequestUrl = await createPullRequest(branchName, issueNumber, repoInfo)

    // Comment on the original issue with the workflow link
    await commentOnIssue(issueNumber, pullRequestUrl, repoInfo)

    console.log("Please review the changes and merge if they look good.")
  } catch (error: any) {
    console.error("Error while attempting to fix the issue:", error.message)
    if (error.stack) {
      console.error("Stack trace:", error.stack)
    }
    if (error.stderr) {
      console.error("Standard error output:", error.stderr.toString())
    }
    process.exit(1)
  }
}
