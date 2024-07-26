# bunaider

Use [bun](https://github.com/oven-sh/bun) and [aider](https://aider.chat) to
automatically complete github issues!

## Usage

```bash
# Installs aider and any required dependencies (if they're not already installed)
bunaider init

# Loads a github issue and attempts to solve with aider
bunaider fix <issue-number>
```

## Configuration

`bunaider` will use all the environment variables that `aider` uses. We recommend:

- `AIDER_SONNET=1`
- `ANTHROPIC_API_KEY=<your-api-key>`

## Github Actions

`bunaider` was mostly built to be used with Github Actions
