import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { basename, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { parseArgs as parseNodeArgs } from "node:util";
import {
  DEFAULT_TEMPLATE_DIR,
  scaffold,
  validateProjectName,
  type ScaffoldOptions,
} from "./scaffold.js";

export const VERSION = "0.1.0";

export interface CliArgs {
  destination?: string;
  name?: string;
  install?: boolean;
  yes?: boolean;
  help?: boolean;
  version?: boolean;
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

/**
 * Parse the small public CLI surface. `node:util` owns option parsing; the
 * tiny normalization step only provides the conventional `--no-install`,
 * `-h`, `-v`, and `-y` spellings that parseArgs does not expand itself.
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const normalizedArgv = normalizeAliases(argv);
  const parsed = parseNodeArgs({
    args: normalizedArgv,
    options: {
      help: { type: "boolean" },
      install: { type: "boolean" },
      name: { type: "string" },
      noInstall: { type: "boolean" },
      version: { type: "boolean" },
      yes: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (parsed.positionals.length > 1) {
    throw new CliUsageError(
      `Expected at most one project directory, received ${parsed.positionals.length}`,
    );
  }

  const values = parsed.values;
  const args: CliArgs = {};
  const [destination] = parsed.positionals;
  if (destination !== undefined) args.destination = destination;
  if (typeof values.name === "string") args.name = values.name;
  if (values.help === true) args.help = true;
  if (values.version === true) args.version = true;
  if (values.yes === true) args.yes = true;

  // Keep the last install spelling when both are supplied. This mirrors the
  // way most command-line tools handle repeated switches and makes the
  // explicit `--no-install` contract unambiguous.
  let install: boolean | undefined;
  let afterTerminator = false;
  for (const arg of argv) {
    if (arg === "--") {
      afterTerminator = true;
      continue;
    }
    if (afterTerminator) continue;
    if (arg === "--install") install = true;
    if (arg === "--no-install") install = false;
  }
  if (install !== undefined) args.install = install;

  return args;
}

function normalizeAliases(argv: string[]): string[] {
  let afterTerminator = false;
  return argv.map((arg) => {
    if (arg === "--") {
      afterTerminator = true;
      return arg;
    }
    if (afterTerminator) return arg;
    if (arg === "--no-install") return "--noInstall";
    if (arg === "-h") return "--help";
    if (arg === "-v") return "--version";
    if (arg === "-y") return "--yes";
    return arg;
  });
}

export function formatNextSteps(projectDir: string): string {
  return [
    `cd ${shellEscapePath(projectDir)}`,
    "pnpm install",
    "pnpm gen-registry",
    "pnpm gen-token-manifest",
    "pnpm dev",
  ].join("\n");
}

function shellEscapePath(projectDir: string): string {
  if (!/[\s'"`$\\]/.test(projectDir)) return projectDir;
  return `'${projectDir.replaceAll("'", "'\\''")}'`;
}

export function printNextSteps(
  projectDir: string,
  output: (message: string) => void = console.log,
): void {
  output(formatNextSteps(projectDir));
}

export function printHelp(output: (message: string) => void = console.log): void {
  output(`Usage: create-zudo-sg [project-dir] [options]

Create a new pnpm-based zudo-sg styleguide project.

Options:
  --name <pkg-name>  Package name written to package.json
  --install          Run pnpm install after scaffolding
  --no-install       Do not install dependencies (the default)
  --yes              Do not prompt for a missing project directory
  --help             Show this help message
  --version          Show the package version
`);
}

export function validateArgs(args: CliArgs): string | null {
  if (args.name !== undefined) return validateProjectName(args.name);
  return null;
}

export interface RunOptions {
  argv?: string[];
  /** Override the template for tests or another embedded template. */
  templateDir?: string;
  /** Resolve relative project paths from this directory. */
  cwd?: string;
  /** Output callback, kept injectable for unit tests. */
  output?: (message: string) => void;
  /** Input/output streams used by the missing-directory prompt. */
  input?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WritableStream;
  /** Tests may explicitly enable the prompt without relying on TTY state. */
  interactive?: boolean;
  /** Override installation for tests. */
  install?: (targetDir: string) => void | Promise<void>;
}

/** Execute the initializer and return the absolute generated directory. */
export async function run(options: RunOptions = {}): Promise<string | undefined> {
  const args = parseArgs(options.argv);
  const output = options.output ?? console.log;

  if (args.help) {
    printHelp(output);
    return undefined;
  }
  if (args.version) {
    output(VERSION);
    return undefined;
  }

  const input = options.input ?? stdin;
  const outputStream = options.outputStream ?? stdout;
  let displayDestination = args.destination?.trim();
  if (!displayDestination) {
    const interactive =
      options.interactive ?? Boolean(hasTTY(input) && hasTTY(outputStream));
    if (args.yes) {
      throw new CliUsageError(
        "A project directory is required when --yes is provided",
      );
    }
    if (!interactive) {
      throw new CliUsageError(
        "A project directory is required in non-interactive mode",
      );
    }
    displayDestination = await promptForProjectDirectory(input, outputStream);
    if (!displayDestination) {
      throw new CliUsageError("A project directory is required");
    }
  }

  const targetDir = resolve(options.cwd ?? process.cwd(), displayDestination);
  const projectName = args.name ?? basename(targetDir);
  const nameError = validateArgs({ ...args, name: projectName });
  if (nameError) throw new CliUsageError(`Invalid project name: ${nameError}`);

  const scaffoldOptions: ScaffoldOptions = {
    targetDir,
    projectName,
    templateDir: options.templateDir ?? DEFAULT_TEMPLATE_DIR,
  };
  await scaffold(scaffoldOptions);

  if (args.install === true) {
    if (options.install) {
      await options.install(targetDir);
    } else {
      installDependencies(targetDir);
    }
  }

  output(`Created ${displayDestination}`);
  printNextSteps(displayDestination, output);
  return targetDir;
}

export async function promptForProjectDirectory(
  input: NodeJS.ReadableStream = stdin,
  outputStream: NodeJS.WritableStream = stdout,
): Promise<string> {
  const readline = createInterface({ input, output: outputStream });
  try {
    return (await readline.question("Project directory: ")).trim();
  } finally {
    readline.close();
  }
}

export function installDependencies(targetDir: string): void {
  execFileSync("pnpm", ["install"], {
    cwd: targetDir,
    stdio: "inherit",
  });
}

function hasTTY(stream: NodeJS.ReadableStream | NodeJS.WritableStream): boolean {
  return "isTTY" in stream && stream.isTTY === true;
}

/** CLI entry point used by bin/create-zudo-sg.js. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    await run({ argv });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}
