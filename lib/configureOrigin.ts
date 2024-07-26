export const configureOrigin = async (git: any) => {
  if (process.env.GITHUB_TOKEN) {
    // This doesn't work- it's possible the checkout command needs to use the
    // github token (in the workflow yaml)
    const remote_url = await git.remote(["get-url", "origin"])

    // if the remote is in the form of git@github.com:foo/bar.git, convert it to
    // https://github.com/foo/bar.git
    if (remote_url.includes("git@")) {
      const new_url = remote_url!.replace("git@", "https://")
      await git.removeRemote("origin")
      await git.addRemote("origin", new_url)
    }

    if (!remote_url.includes("oauth2:")) {
      const new_url = remote_url!
        .replace(
          "https://",
          `https://oauth2:${process.env.GITHUB_TOKEN.trim()}@`,
        )
        .replace(/\n/g, "")
      await git.removeRemote("origin")
      await git.addRemote("origin", new_url)
    }
  }
}
