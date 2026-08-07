import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "../setup-doc-skill.sh");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    timeout: 30_000,
    ...options,
  });
}

function createFixture() {
  const repo = mkdtempSync(join(tmpdir(), "zudosg-doc-skill-repo-"));
  const home = mkdtempSync(join(tmpdir(), "zudosg-doc-skill-home-"));
  const project = join(repo, "doc");

  run("git", ["init", "-q", repo]);
  mkdirSync(join(project, "scripts"), { recursive: true });
  mkdirSync(join(project, "src/content/docs/getting-started"), { recursive: true });
  cpSync(SCRIPT, join(project, "scripts/setup-doc-skill.sh"));
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({
      name: "@zudo-sg/doc",
      scripts: { "format:mdx": "prettier --write .", build: "zfb build" },
    }),
  );
  writeFileSync(
    join(project, "src/content/docs/getting-started/index.mdx"),
    "---\ntitle: Test\n---\n",
  );

  const env = { ...process.env, HOME: home };
  delete env.SKILL_NAME;

  return {
    repo,
    home,
    project,
    env,
    cleanup() {
      rmSync(repo, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
}

function addTrackedSkill(fixture, target, name, body = `# ${name}\n`) {
  const dir = join(fixture.repo, `.${target}/skills`, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), body);
  return dir;
}

function runSetup(fixture, args = [], script = join(fixture.project, "scripts/setup-doc-skill.sh")) {
  return run("bash", [script, ...args], {
    cwd: fixture.project,
    env: fixture.env,
  });
}

function commitFixture(fixture) {
  run("git", ["-C", fixture.repo, "add", "-A"]);
  run("git", [
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=Test",
    "-C",
    fixture.repo,
    "commit",
    "-q",
    "-m",
    "fixture",
  ]);
}

test("nested doc project preserves doc-wisdom and supports Claude, Codex, both, and auto", () => {
  const fixture = createFixture();
  try {
    const cases = [
      { args: ["--target", "claude"], targets: ["claude"] },
      { args: ["--target=codex"], targets: ["codex"] },
      { args: ["--target", "both"], targets: ["claude", "codex"] },
    ];

    for (const { args, targets } of cases) {
      rmSync(fixture.home, { recursive: true, force: true });
      mkdirSync(fixture.home, { recursive: true });
      runSetup(fixture, args);
      for (const target of targets) {
        const globalLink = join(fixture.home, `.${target}/skills/doc-wisdom`);
        assert.equal(lstatSync(globalLink).isSymbolicLink(), true);
        const skill = readFileSync(join(globalLink, "SKILL.md"), "utf8");
        assert.match(skill, /^name: doc-wisdom$/m);
        assert.match(skill, /pnpm format:mdx/);
        assert.match(skill, new RegExp(`pnpm build.*${fixture.project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        assert.equal(
          realpathSync(join(globalLink, "docs")),
          realpathSync(join(fixture.project, "src/content/docs")),
        );
      }
    }

    rmSync(fixture.home, { recursive: true, force: true });
    mkdirSync(join(fixture.home, ".codex"), { recursive: true });
    const output = runSetup(fixture);
    assert.match(output, /Target: auto -> codex/);
    assert.equal(existsSync(join(fixture.home, ".codex/skills/doc-wisdom")), true);
    assert.equal(existsSync(join(fixture.home, ".claude/skills/doc-wisdom")), false);
  } finally {
    fixture.cleanup();
  }
});

test("repo-root tracked skills use physical comparison and never replace foreign entries", () => {
  const fixture = createFixture();
  let repoAlias;
  try {
    const correct = addTrackedSkill(fixture, "claude", "correct");
    const dangling = addTrackedSkill(fixture, "claude", "dangling");
    addTrackedSkill(fixture, "claude", "foreign");
    addTrackedSkill(fixture, "claude", "real-entry");

    const globalRoot = join(fixture.home, ".claude/skills");
    mkdirSync(globalRoot, { recursive: true });

    repoAlias = join(dirname(fixture.repo), `${fixture.repo.split("/").pop()}-alias`);
    symlinkSync(fixture.repo, repoAlias);
    symlinkSync(join(repoAlias, ".claude/skills/correct"), join(globalRoot, "correct"));
    symlinkSync(join(fixture.repo, "missing"), join(globalRoot, "dangling"));

    const other = mkdtempSync(join(tmpdir(), "zudosg-doc-skill-foreign-"));
    symlinkSync(other, join(globalRoot, "foreign"));
    mkdirSync(join(globalRoot, "real-entry"));
    writeFileSync(join(globalRoot, "real-entry/sentinel"), "keep");

    // Invoke through a symlinked parent as well as storing an existing target
    // through that alias. The script must compare physical destinations, not
    // literal path strings.
    const aliasProject = join(repoAlias, "doc");
    const first = run(
      "bash",
      [join(aliasProject, "scripts/setup-doc-skill.sh"), "--target", "claude"],
      { cwd: aliasProject, env: fixture.env },
    );
    assert.equal(realpathSync(join(globalRoot, "correct")), realpathSync(correct));
    assert.equal(realpathSync(join(globalRoot, "dangling")), realpathSync(dangling));
    assert.equal(readlinkSync(join(globalRoot, "foreign")), other);
    assert.equal(readFileSync(join(globalRoot, "real-entry/sentinel"), "utf8"), "keep");
    assert.match(first, /skipping tracked skill 'foreign'/);
    assert.match(first, /skipping tracked skill 'real-entry'/);

    const second = runSetup(fixture, ["--target", "claude"]);
    assert.equal(realpathSync(join(globalRoot, "correct")), realpathSync(correct));
    assert.equal(realpathSync(join(globalRoot, "dangling")), realpathSync(dangling));
    assert.equal(readlinkSync(join(globalRoot, "foreign")), other);
    assert.match(second, /skipping tracked skill 'foreign'/);

    rmSync(other, { recursive: true, force: true });
  } finally {
    if (repoAlias) rmSync(repoAlias, { force: true });
    fixture.cleanup();
  }
});

test("repo-root tracked links created from a linked worktree survive its removal", () => {
  const fixture = createFixture();
  const worktree = mkdtempSync(join(tmpdir(), "zudosg-doc-skill-wt-"));
  rmSync(worktree, { recursive: true });
  try {
    const tracked = addTrackedSkill(fixture, "claude", "repo-skill", "# survives\n");
    commitFixture(fixture);
    run("git", ["-C", fixture.repo, "worktree", "add", "-q", "-b", "fixture-wt", worktree]);

    const worktreeProject = join(worktree, "doc");
    run("bash", [join(worktreeProject, "scripts/setup-doc-skill.sh"), "--target", "claude"], {
      cwd: worktreeProject,
      env: fixture.env,
    });

    const trackedLink = join(fixture.home, ".claude/skills/repo-skill");
    assert.equal(realpathSync(trackedLink), realpathSync(tracked));
    const generatedDocs = join(worktreeProject, ".claude/skills/doc-wisdom/docs");
    assert.equal(
      realpathSync(generatedDocs),
      realpathSync(join(fixture.project, "src/content/docs")),
    );

    run("git", ["-C", fixture.repo, "worktree", "remove", "--force", worktree]);
    assert.equal(readFileSync(join(trackedLink, "SKILL.md"), "utf8"), "# survives\n");
  } finally {
    if (existsSync(worktree)) {
      run("git", ["-C", fixture.repo, "worktree", "remove", "--force", worktree]);
    }
    fixture.cleanup();
  }
});
