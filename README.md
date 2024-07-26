# bunaider

Bunaider is a powerful tool that combines [bun](https://github.com/oven-sh/bun) and [aider](https://aider.chat) to automatically address GitHub issues. It streamlines the process of fixing issues by leveraging AI-assisted coding.

## Features

- Automatic installation of aider and dependencies
- Fetches GitHub issues and attempts to solve them using AI
- Creates pull requests with proposed fixes
- Supports both local development and CI/CD workflows

## Installation

```bash
npm install -g bunaider
```

Or if you prefer using bun:

```bash
bun install -g bunaider
```

## Usage

```bash
# Initialize bunaider (installs aider and required dependencies)
bunaider init

# Attempt to fix a GitHub issue
bunaider fix <issue-number>
```

## Configuration

Bunaider uses the same environment variables as aider. We recommend setting the following:

- `AIDER_SONNET=1` (to use the latest model)
- `ANTHROPIC_API_KEY=<your-api-key>` (required for aider to function)

For GitHub integration, you can use either:

- GitHub CLI: Ensure `gh` is installed and authenticated
- `GITHUB_TOKEN`: Set this environment variable with your GitHub personal access token

## GitHub Actions Integration

Bunaider is designed to work seamlessly with GitHub Actions. Here's an example workflow that automatically creates a pull request for any issue labeled with 'aider':

```yaml
name: Bunaider Auto-Fix
on:
  issues:
    types: [labeled]

jobs:
  auto-fix:
    if: github.event.label.name == 'aider'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install bunaider
        run: bun install -g bunaider

      - name: Run bunaider fix
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AIDER_SONNET: 1
        run: bunaider fix ${{ github.event.issue.number }}
```

This workflow will:

1. Trigger when an issue is labeled
2. Check if the label is 'aider'
3. Set up the environment with Bun and bunaider
4. Run `bunaider fix` on the labeled issue

## Local Development

For local development, ensure you have either the GitHub CLI (`gh`) installed and authenticated, or set the `GITHUB_TOKEN` environment variable. Then you can run bunaider commands directly from your terminal.

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, or request features.

## License

Bunaider is released under the MIT License. See the [LICENSE](LICENSE) file for more details.
