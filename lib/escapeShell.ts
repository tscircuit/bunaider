export function escapeShell(cmd) {
  return '"' + cmd.replace(/(["$`\\])/g, "\\$1") + '"'
}
