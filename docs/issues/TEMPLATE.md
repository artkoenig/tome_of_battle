---
status: backlog     # backlog -> active -> done; waiting = parked on a question
branch:             # set as soon as one exists
pr:                 # set when the PR is opened — set status: done with it
---

# <title>

<!--
File this as docs/issues/NNN-slug.md — three digits, zero-padded, the next
number after the highest already filed, so the directory lists the issues in
the order they were opened.

The sections below are the interface between the agents that read and write
this file — their names and order are fixed, their content is free. They fill
in run order, so the filled sections ARE the progress: Intent only = not
started; Checkpoint 1 answered = implementing; Checkpoint 2 answered = in
review; Retro written = finished. Delete these comments when filing.
-->

## Intent

<!-- The problem and the desired observable behaviour, solution-free. -->

Acceptance criteria:

1. <!-- numbered, observable, falsifiable — "when X, then Y" -->

## Plan

<!-- Optional; the `plan` skill writes it when the change spans modules. -->

## Tasks

<!-- Optional; only when the change is too big to land whole. Mid-run work
     that serves the intent joins this list; anything else becomes a new
     issue file. -->

## Decisions

<!-- What was settled and why — one entry each, with the source it derives
     from. Defaults marked as defaults. Questions to the human and their
     answers. Nothing else: a reader arriving mid-run must reach the
     load-bearing decisions without wading through the run's process. -->

## Log

<!-- The run as it happened, newest last: observations (repetition / surprise
     / regression), review rounds and how their findings were triaged,
     attempts that failed and why. This is the section that grows; keeping it
     out of Decisions is what keeps Decisions readable. -->

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

<!-- After the PR: what got in the way, what should change. Rule-change
     proposals go to the metis repo. -->
