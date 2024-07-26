#!/usr/bin/env node

import { program } from "commander"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { Octokit } from "@octokit/rest"

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
      repoUrl.match(/github\.com[:/](.+)\/(.+)\.git$/) ?? []
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

async function createPullRequest(branchName, issueNumber, repoInfo) {
  const title = `Fix for issue #${issueNumber}`
  const body = `This pull request addresses issue #${issueNumber}.\n\nChanges were made automatically by aider. Please review the changes carefully before merging.`

  if (repoInfo.useOctokit) {
    const { data: pullRequest } = await repoInfo.octokit.pulls.create({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      title: title,
      head: branchName,
      base: "main",
      body: body,
    })
    console.log(`Pull request created: ${pullRequest.html_url}`)
  } else {
    execSync(`gh pr create --title "${title}" --body "${body}" --base main`, {
      stdio: "inherit",
    })
    console.log("Pull request created. Please check your GitHub repository.")
  }
}

program
  .name("bunaider")
  .description("CLI to set up and manage aider")
  .version("1.0.0")

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
      execSync(`git checkout -b ${branchName}`)
      execSync("git add .")
      execSync(`git commit -m "Fix issue #${issueNumber}"`)
      execSync(`git push origin ${branchName}`)

      await createPullRequest(branchName, issueNumber, repoInfo)

      console.log("Please review the changes and merge if they look good.")
    } catch (error: any) {
      console.error("Error while attempting to fix the issue:", error.message)
      process.exit(1)
    }
  })

program.parse(process.argv)
