import { escapeShell } from "./escapeShell"
import { execSync } from "child_process"

export async function commentOnIssue(issueNumber: string, pullRequestUrl: string, repoInfo: any) {
  const commentBody = `Aider has created a pull request to address this issue: ${pullRequestUrl}\n\nPlease review the changes and provide feedback.`

  try {
    if (repoInfo.useOctokit) {
      console.log("Attempting to comment on the issue using Octokit...")
      try {
        const { data: comments } = await repoInfo.octokit.issues.listComments({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          issue_number: parseInt(issueNumber),
        })

        const existingComment = comments.find(comment => 
          comment.body.includes("Aider has created a pull request to address this issue")
        )

        if (existingComment) {
          await repoInfo.octokit.issues.updateComment({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            comment_id: existingComment.id,
            body: commentBody,
          })
          console.log("Updated existing comment on the issue.")
        } else {
          await repoInfo.octokit.issues.createComment({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            issue_number: parseInt(issueNumber),
            body: commentBody,
          })
          console.log("Created new comment on the issue.")
        }
        return
      } catch (octoError: any) {
        console.error("Error commenting on the issue with Octokit:", octoError.message)
        console.log("Falling back to GitHub CLI...")
      }
    }

    // If Octokit fails or isn't used, try GitHub CLI
    console.log("Commenting on the issue using GitHub CLI...")
    const escapedBody = escapeShell(commentBody)
    const shellCmd = `gh issue comment ${issueNumber} --body ${escapedBody}`
    console.log("Executing:", shellCmd)
    execSync(shellCmd, { stdio: "inherit", env: process.env })
    console.log("Comment added to the issue.")
  } catch (error: any) {
    console.error("Error commenting on the issue:", error.message)
    if (error.response) {
      console.error("API response:", error.response.data)
    }
    console.log("Unable to comment on the issue automatically. Please add the comment manually:")
    console.log(`Issue number: ${issueNumber}`)
    console.log(`Comment body: ${commentBody}`)
  }
}
