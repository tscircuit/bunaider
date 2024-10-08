#!/usr/bin/env node

import { program } from "commander"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import type { PullRequest } from "@octokit/webhooks-types"
import packageJson from "./package.json"
import { getRepoInfo } from "./lib/getRepoInfo"
import { fixIssue } from "./lib/fixIssue"
import { isIssueOrPr } from "./lib/isIssueOrPr"
import { fixPr } from "./lib/fixPr"
import { scanPullRequestComments } from "./lib/scanPullRequestComments"
import ms from "ms"
import { getContextFiles } from "./lib/getContextFiles"
import { getIssueInfo } from "./lib/getIssueInfo"

program
  .name("bunaider")
  .description("CLI to set up and manage aider")
  .version(packageJson.version)

program
  .command("get-issue-info <issue-number>")
  .description("Get information about a GitHub issue")
  .action(async (issueNumber) => {
    const repoInfo = await getRepoInfo()
    const issueInfo = await getIssueInfo(issueNumber, repoInfo)
    console.log(JSON.stringify(issueInfo, null, 2))
  })

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
  .command("fix <issue-or-pr-number>")
  .description("Load a github issue or PR and attempt to solve with aider")
  .option("-f, --no-skip", "Force fixing the issue/PR (disable skipping)")
  .action(async (issueNumber, { skip: allowSkip }) => {
    console.log(`Attempting to fix issue/pr #${issueNumber}...`)

    const repoInfo = await getRepoInfo()

    const isIssue = (await isIssueOrPr(issueNumber, repoInfo)) === "issue"
    console.log(
      `Determined #${issueNumber} is ${isIssue ? "an issue" : "a pull request"}`,
    )

    if (isIssue) {
      await fixIssue(issueNumber, repoInfo)
    } else {
      // Check if the PR has "Request Changes" with "aider: " in the comment
      const comments = await scanPullRequestComments(issueNumber, repoInfo)
      const hasRequestChanges = comments.some(
        (comment) =>
          comment.body.includes("aider:") &&
          // Less than 5 minutes old
          comment.submittedAt &&
          new Date(comment.submittedAt).valueOf() >
            Date.now() - ms(process.env.BUNAIDER_STALE_COMMENT_TIME || "5m"),
      )

      if (hasRequestChanges || allowSkip === false) {
        console.log(
          "Recent comments with 'aider:' text found. Attempting PR fix.",
        )
        await fixPr(issueNumber, repoInfo)
      } else {
        console.log(
          "No recent comments with 'aider:' text found. Skipping PR fix.",
        )
      }
    }
  })

program
  .command("list-context")
  .description("List all files that will be automatically added to the context")
  .action(async () => {
    console.log(
      "Listing files that will be automatically added to the context:",
    )
    const contextFiles = await getContextFiles()
    contextFiles.forEach((file) => console.log(file))
  })

program.parse(process.argv)
