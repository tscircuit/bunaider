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
  .command("fix <issue-or-pr-number>")
  .description("Load a github issue and attempt to solve with aider")
  .action(async (issueNumber) => {
    console.log(`Attempting to fix issue/pr #${issueNumber}...`)

    const repoInfo = await getRepoInfo()

    const isIssue = await isIssueOrPr(issueNumber, repoInfo)

    if (isIssue) {
      await fixIssue(issueNumber, repoInfo)
    }
  })

program.parse(process.argv)
