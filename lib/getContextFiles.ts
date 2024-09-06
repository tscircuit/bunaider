import { Glob } from "bun";
import fs from "fs";

export async function getContextFiles(): Promise<string[]> {
  const files: string[] = [];

  // Read .gitignore and .aiderignore
  const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8').split('\n') : [];
  const aiderignore = fs.existsSync('.aiderignore') ? fs.readFileSync('.aiderignore', 'utf-8').split('\n') : [];
  const ignorePatterns = [...gitignore, ...aiderignore].filter(Boolean);

  // Function to check if a file should be ignored
  const shouldIgnore = (file: string) => {
    return ignorePatterns.some(pattern => {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}$`).test(file);
    });
  };

  // Scan for TypeScript files
  const tsFiles = new Glob("**/*.ts");
  for await (const file of tsFiles) {
    if (!shouldIgnore(file)) {
      files.push(file);
    }
  }

  // Add README.md if it exists
  if (fs.existsSync('README.md') && !shouldIgnore('README.md')) {
    files.push('README.md');
  }

  return files;
}
