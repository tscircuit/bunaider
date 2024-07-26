import { execSync } from "child_process"
import { escapeShell } from "./escapeShell"

export async function createPullRequest(branchName, issueNumber, repoInfo) {
  const title = `Fix for issue #${issueNumber}`
  const body = `This pull request addresses issue #${issueNumber}.\n\nChanges were made automatically by aider. Please review the changes carefully before merging.`

  try {
    if (repoInfo.useOctokit) {
      console.log("Attempting to create pull request using Octokit...")
      try {
        const { data: pullRequest } = await repoInfo.octokit.pulls.create({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          title: title,
          head: branchName,
          base: "main",
          body: body,
        })
        console.log(`Pull request created: ${pullRequest.html_url}`)
        return pullRequest.html_url
      } catch (octoError: any) {
        console.error(
          "Error creating pull request with Octokit:",
          octoError.message,
        )
        console.log("Falling back to GitHub CLI...")
      }
    }

    // If Octokit fails or isn't used, try GitHub CLI
    console.log("Creating pull request using GitHub CLI...")
    const escapedBody = escapeShell(body)
    const shellCmd = `gh pr create --title ${escapeShell(title)} --body ${escapedBody} --base main`
    console.log("Executing:", shellCmd)
    const result = execSync(shellCmd, { stdio: "inherit", env: process.env })
    const prUrl = result.toString().trim()
    console.log(`Pull request created: ${prUrl}`)
    return prUrl
  } catch (error: any) {
    console.error("Error creating pull request:", error.message)
    if (error.response) {
      console.error("API response:", error.response.data)
    }
    console.log(
      "Unable to create pull request automatically. Please create it manually:",
    )
    console.log(`Branch name: ${branchName}`)
    console.log(`Title: ${title}`)
    console.log(`Body: ${body}`)
  }
}
