---
name: issue-backend
description: How this project stores issues. Use whenever an issue must be created, listed, read, or closed.
---

# Issue backend

Backend: markdown files under `docs/issues/`, one file per issue, named
`NNNN-<slug>.md` (four digits, zero-padded, slug lowercase with hyphens).

Every command prints the smallest useful answer. Autonomous runs pay for every extra line.

Directories `NN-<slug>/issue.md` carrying a `Status:` line are the older form. They are
history — read them for context, never revive or update one, and never let them decide the
next id.

## Create

```bash
id=$(printf '%04d' $(( 10#$(ls docs/issues | grep -oE '^[0-9]{4}' | sort -n | tail -1) + 1 )))
f="docs/issues/$id-<slug>.md"
cat > "$f" <<EOF
---
status: backlog
branch:
pr:
---

# <title>

## Goal

<one paragraph>

## Acceptance criteria

- AC1: <criterion> | verify: <command>
- AC2: <criterion>

## Out of scope

- <what this issue deliberately does not touch>
EOF
echo "$id"
```

## List open

```bash
grep -lE '^status: (backlog|active|waiting)' docs/issues/[0-9]*.md \
  | xargs -r awk 'FNR==1{id=FILENAME; sub(/^docs\/issues\//,"",id); sub(/-.*$/,"",id)} /^# /{print id" "substr($0,3); nextfile}'
```

## Read

```bash
cat docs/issues/<id>-*.md
```

## Update status

`status` is one of `backlog`, `active`, `waiting`, `done`.

An issue is `done` as soon as its pull request exists. Opening the PR is the transition —
do not wait for the merge, and do not park the issue in `waiting` for a review.

```bash
f=$(ls docs/issues/<id>-*.md) && sed -i -E "1,6s/^status: .*/status: <status>/" "$f"
```

`branch` and `pr` live in the same frontmatter block and are set the same way:

```bash
f=$(ls docs/issues/<id>-*.md) && sed -i -E "1,6s|^branch:.*|branch: <branch>|" "$f"
```

## Close

```bash
f=$(ls docs/issues/<id>-*.md) && sed -i -E "1,6s/^status: .*/status: done/" "$f"
```

## Format

Issues follow the forge template: Goal, Acceptance criteria (`AC1`, `AC2`, … each optionally with
`| verify: <command>`), Out of scope. Preserve it exactly when writing and reading - the run parses
the criteria out of it.

The frontmatter carries the facts (`status`, `branch`, `pr`); the sections carry the progress.
One issue = one branch = one pull request. There are no child issues — a change too big to land
whole gets a task list inside its own file.
