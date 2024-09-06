# bunaider - quickly fix github issues w/ ai

![image](https://github.com/user-attachments/assets/b11a43ac-6e28-4aea-9e3c-ff41f1dbce8a)

`bunaider` combines [bun](https://github.com/oven-sh/bun) and [aider](https://aider.chat) to automatically fix GitHub issues. It streamlines the process of fixing issues by leveraging AI-assisted coding.

You can use `bunaider` to automatically fix github issues.

## Features

- Automatic installation of aider and dependencies
- Fetches GitHub issues and attempts to solve them using AI
- Creates pull requests with proposed fixes
- Supports both local development and CI/CD workflows

## Installation

```bash
npm install -g bunaider
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

### Automatic Context Addition

Bunaider automatically adds the following to the context:

- All TypeScript files in the project, unless they are listed in `.aiderignore`
- The `README.md` file

To exclude specific TypeScript files or directories from being added to the context, create a `.aiderignore` file in your project root and list the files or directories you want to ignore.

## GitHub Actions Integration

Bunaider is designed to work seamlessly with GitHub Actions. Here are two example workflows: one for automatically creating a pull request for any issue labeled with 'aider', and another for responding to pull request review comments.

### Auto-Fix Issues

```yaml
name: Bunaider Auto-Fix Issue
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

      - run: bunaider init

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

### Respond to PR Review Comments

```yaml
name: Bunaider PR Review Response
on:
  pull_request_review:
    types: [submitted]

jobs:
  respond-to-review:
    if: github.event.review.state == 'changes_requested' && contains(github.event.review.body, 'aider:')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install bunaider
        run: bun install -g bunaider

      - run: bunaider init

      - name: Run bunaider fix on PR
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AIDER_SONNET: 1
        run: bunaider fix ${{ github.event.pull_request.number }}
```

This workflow will:

1. Trigger when a pull request review is submitted
2. Check if the review requests changes and contains 'aider:' in the comment
3. Set up the environment with Bun and bunaider
4. Run `bunaider fix` on the pull request number

These workflows demonstrate how bunaider can be used to automatically fix issues and respond to pull request review comments in your GitHub repository.

## Local Development

For local development, ensure you have either the GitHub CLI (`gh`) installed and authenticated, or set the `GITHUB_TOKEN` environment variable. Then you can run bunaider commands directly from your terminal.

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, or request features.

## License

Bunaider is released under the MIT License. See the [LICENSE](LICENSE) file for more details.
