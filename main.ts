#!/usr/bin/env node

import { program } from "commander"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { Octokit } from "@octokit/rest"
import packageJson from "./package.json"
import { PullRequest, PullRequestComment } from "@octokit/webhooks-types"

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

async function getIssueOrPullRequestInfo(number, repoInfo) {
  try {
    return await getIssueInfo(number, repoInfo)
  } catch (error) {
    return await getPullRequestInfo(number, repoInfo)
  }
}

async function getPullRequestInfo(prNumber, repoInfo) {
  if (repoInfo.useOctokit) {
    const { data: pr } = await repoInfo.octokit.pulls.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      pull_number: parseInt(prNumber),
    })
    return { title: pr.title, body: pr.body, number: pr.number }
  } else {
    const prInfo = JSON.parse(
      execSync(`gh pr view ${prNumber} --json title,body,number`).toString(),
    )
    return prInfo
  }
}

async function scanPullRequestComments(prNumber, repoInfo) {
  let comments: PullRequestComment[] = []
  if (repoInfo.useOctokit) {
    const { data } = await repoInfo.octokit.pulls.listReviewComments({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      pull_number: parseInt(prNumber),
    })
    comments = data
  } else {
    const commentsJson = execSync(
      `gh pr view ${prNumber} --json comments`,
    ).toString()
    comments = JSON.parse(commentsJson).comments
  }

  return comments.filter((comment) => comment.body.startsWith("aider: "))
}

async function createPullRequest(branchName, issueNumber, repoInfo) {
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
        return
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
    console.log("Pull request created. Please check your GitHub repository.")
    console.log(result.toString())
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
  .command("fix <number>")
  .description("Load a GitHub issue or pull request and attempt to solve with aider")
  .action(async (number) => {
    console.log(`Attempting to fix issue/PR #${number}...`)

    try {
      const repoInfo = await getRepoInfo()

      console.log(`Fetching issue/PR #${number} from GitHub...`)
      const { title, body } = await getIssueOrPullRequestInfo(number, repoInfo)

      let content = `Issue/PR #${number}: ${title}\n\n${body}`

      // Check if it's a pull request and scan for comments
      try {
        const prComments = await scanPullRequestComments(number, repoInfo)
        if (prComments.length > 0) {
          content += "\n\nPull Request Comments:\n"
          prComments.forEach((comment) => {
            content += `${comment.path ? `File: ${comment.path}\n` : ''}${comment.body}\n\n`
          })
        }
      } catch (error) {
        // If this fails, it's likely because it's an issue, not a PR
        console.log("No pull request comments found or this is an issue.")
      }

      console.log("Content:", content)

      console.log("Running aider to attempt a fix...")
      const escapedContent = escapeShell(content)
      const aiderCommand = `aider --yes --message ${escapedContent}`

      execSync(aiderCommand, {
        stdio: "inherit",
        env: process.env,
      })

      console.log("Aider has completed its attempt to fix the issue/PR.")

      const branchName = `aider-fix-${number}`
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
