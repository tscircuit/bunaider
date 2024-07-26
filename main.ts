#!/usr/bin/env node

import { program } from "commander"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { Octokit } from "@octokit/rest"
import packageJson from "./package.json"
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

function escapeShell(cmd) {
  return '"' + cmd.replace(/(["$`\\])/g, "\\$1") + '"'
}

async function getRepoInfo() {
  if (process.env.GITHUB_TOKEN) {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const repoUrl = execSync("git config --get remote.origin.url")
      .toString()
      .trim()
    const [, owner, repo] =
      repoUrl.match(/github\.com[:/](.+)\/(.+)(\.git)?$/) ?? []
    if (!owner || !repo) {
      console.error(`Could not parse GitHub repository URL. "${repoUrl}"`)
      process.exit(1)
    }
    return { owner, repo, useOctokit: true, octokit }
  }
  try {
    execSync("gh --version", { stdio: "ignore" })
    const repoInfo = JSON.parse(
      execSync("gh repo view --json owner,name").toString(),
    )
    return { owner: repoInfo.owner, repo: repoInfo.name, useOctokit: false }
  } catch (error) {
    console.error(
      "Neither GITHUB_TOKEN nor GitHub CLI (gh) is available. Please set up one of them to use this feature.",
    )
    process.exit(1)
  }
}

async function getIssueInfo(issueNumber, repoInfo) {
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

async function commentOnIssue(issueNumber: number, pullRequestUrl: string, repoInfo: any) {
  const commentBody = `A pull request has been created to address this issue: ${pullRequestUrl}`;

  try {
    if (repoInfo.useOctokit) {
      console.log("Attempting to comment on issue using Octokit...");
      const { data: comments } = await repoInfo.octokit.issues.listComments({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: issueNumber,
      });

      const existingComment = comments.find(comment => 
        comment.body.includes("A pull request has been created to address this issue:")
      );

      if (existingComment) {
        await repoInfo.octokit.issues.updateComment({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          comment_id: existingComment.id,
          body: commentBody,
        });
        console.log("Existing comment updated on the issue.");
      } else {
        await repoInfo.octokit.issues.createComment({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          issue_number: issueNumber,
          body: commentBody,
        });
        console.log("New comment added to the issue.");
      }
    } else {
      console.log("Commenting on issue using GitHub CLI...");
      const existingComments = JSON.parse(
        execSync(`gh issue view ${issueNumber} --json comments`).toString()
      ).comments;

      const existingComment = existingComments.find((comment: any) => 
        comment.body.includes("A pull request has been created to address this issue:")
      );

      if (existingComment) {
        execSync(`gh issue comment ${issueNumber} --edit-last "${commentBody}"`);
        console.log("Existing comment updated on the issue.");
      } else {
        execSync(`gh issue comment ${issueNumber} --body "${commentBody}"`);
        console.log("New comment added to the issue.");
      }
    }
  } catch (error: any) {
    console.error("Error commenting on issue:", error.message);
  }
}

async function createPullRequest(branchName: string, issueNumber: number, repoInfo: any) {
  const title = `Fix for issue #${issueNumber}`
  const body = `This pull request addresses issue #${issueNumber}.\n\nChanges were made automatically by aider. Please review the changes carefully before merging.`

  try {
    let pullRequestUrl: string;
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
        pullRequestUrl = pullRequest.html_url;
        console.log(`Pull request created: ${pullRequestUrl}`)
      } catch (octoError: any) {
        console.error(
          "Error creating pull request with Octokit:",
          octoError.message,
        )
        console.log("Falling back to GitHub CLI...")
        throw octoError;
      }
    } else {
      // If Octokit fails or isn't used, try GitHub CLI
      console.log("Creating pull request using GitHub CLI...")
      const escapedBody = escapeShell(body)
      const shellCmd = `gh pr create --title ${escapeShell(title)} --body ${escapedBody} --base main`
      console.log("Executing:", shellCmd)
      pullRequestUrl = execSync(shellCmd, { encoding: 'utf8' }).trim();
      console.log("Pull request created. Please check your GitHub repository.")
      console.log(pullRequestUrl)
    }

    // Comment on the original issue with the pull request link
    await commentOnIssue(issueNumber, pullRequestUrl, repoInfo);

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

program
  .name("bunaider")
  .description("CLI to set up and manage aider")
  .version(packageJson.version)

program
  .command("init")
  .description("Initialize aider")
  .action(() => {
    console.log("Initializing aider...")

    try {
      execSync("aider --version", { stdio: "ignore" })
      console.log("aider is already installed and available on the PATH.")
    } catch (error) {
      console.log("aider is not found on the PATH. Installing...")

      try {
        console.log("Installing pipx...")
        execSync("python3 -m pip install --user pipx")
        execSync("python3 -m pipx ensurepath")

        console.log("Installing aider via pipx...")
        execSync("pipx install aider-chat")

        console.log("aider has been successfully installed.")
      } catch (installError: any) {
        console.error("Error installing aider:", installError.message)
        process.exit(1)
      }
    }
  })

program
  .command("fix <issue-number>")
  .description("Load a github issue and attempt to solve with aider")
  .action(async (issueNumber) => {
    console.log(`Attempting to fix issue #${issueNumber}...`)

    try {
      const repoInfo = await getRepoInfo()

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

      await createPullRequest(branchName, issueNumber, repoInfo)

      console.log("Please review the changes and merge if they look good.")
    } catch (error: any) {
      console.error("Error while attempting to fix the issue:", error.message)
      process.exit(1)
    }
  })

program.parse(process.argv)
