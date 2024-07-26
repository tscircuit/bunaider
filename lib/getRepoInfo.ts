import { Octokit } from "@octokit/rest"
import { execSync } from "child_process"

export async function getRepoInfo() {
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
