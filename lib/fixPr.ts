export async function fixPr(prNumber, repoInfo) {
  // TODO implement fixPr
  // Needs to...
  // 1. fetch the PR
  // 2. Get all the review comments that start with "aider: "
  // 3. Get the original issue the pr is fixing (parse the PR body for "#<issue number>")
  // 4. Construct a message for aider including the original issue title and body, the PR diff, and the review comments
  // 5. Run aider with the message
  // 6. Push the branch to the remote (we want to use the same branch as the PR)
}
