# Repository Instructions

This repository contains many independent web-based tools. Each top-level
folder is its own tool and should be treated as an isolated project unless the
user explicitly says otherwise.

## Scope

- Do not assume code, styles, dependencies, or behavior are shared between
  tools.
- Keep changes limited to the requested tool or folder whenever possible.
- Avoid repo-wide refactors unless specifically requested.
- Check for a tool-specific `AGENTS.md` inside the target folder and follow it
  in addition to this file.

## Editing Guidelines

- Preserve each tool's existing style, structure, and dependency approach.
- Prefer small, local changes over introducing shared abstractions.
- Do not move files between tools unless the task explicitly requires it.
- Avoid changing root files such as `index.html`, `README.md`, or shared
  metadata unless the task concerns the repo listing, navigation, or
  documentation.

## Git / Commits

- Each top-level folder is an independent tool.
- When working on a specific tool, stage and commit only files from that tool's
  folder unless the user explicitly requests otherwise.
- Do not use broad staging commands like `git add -A` or `git add .` from the
  repo root for tool-specific work.
- Before staging, check `git status` and distinguish files related to the
  current task from unrelated WIP.
- Leave unrelated modified, untracked, or staged files alone.
- Root files such as `index.html`, `README.md`, or repo metadata should only be
  included when the task explicitly requires repo-level changes.

## Verification

- For static tools, verify by opening the relevant HTML file or running the
  tool's existing local server or build flow if one exists.
- If a tool has package scripts, use that tool's local scripts rather than
  inventing new commands.
- When making UI changes, test the affected tool in a browser at desktop and
  mobile-ish widths when practical.

## Dependencies

- Do not add dependencies at the repo root unless the repo already uses
  root-level tooling for that purpose.
- If a tool has its own dependency manifest, keep dependency changes scoped to
  that tool.
