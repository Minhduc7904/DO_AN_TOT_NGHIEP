---
name: graduation-workspace
description: "Organize and maintain this graduation-thesis workspace: assign work to Duc or Bach, create dated weekly task folders, prepare Vietnamese task input/output reports, and manage raw versus processed documents. Use whenever creating, updating, reviewing, or reorganizing project tasks, weekly plans, work reports, or thesis documentation."
---

# Graduation Workspace

Follow the shared work standard in [references/workspace-standard.md](references/workspace-standard.md) before creating or changing a task, work report, weekly folder, or documentation folder.

## Required workflow

1. Identify the item type. For a personal task, identify the owner: `duc` or `bach`. For shared weekly planning and task assignment, use `docs/processed/plan/weekly/` and read the `weekly-task-planning` skill. For a group or advisor meeting, use `meetings/` instead of a personal folder.
2. Find or create the dated week folder in `workspace/<owner>/` using the required naming format.
3. Number the task sequentially within that week. Create its `input/` and `output/` folders from `workspace/_templates/task/`.
4. Complete the input before work starts. Do not mark a task complete from a plan alone.
5. Complete the output after work ends. Mark every Definition of Done item with evidence, time, and a product link or repository path.
6. Store original documents under `docs/raw/`; store Vietnamese Markdown summaries, extracted content, plans, and reports under `docs/processed/`.
7. Store each meeting summary in its dated `meetings/week-.../` folder; name it with the meeting start time and record meeting type, participants, decisions, and follow-up tasks.

For a user-reported completed weekly task, read `task-completion-recording` before changing its status. That workflow collects products and verifies every DoD before updating the shared task card and personal record to `Chờ review`. For a code review request, read `task-code-review`; it alone may move a task from `Chờ review` to `Hoàn thành`.

Before creating a branch, changing code or opening a pull request, read `docs/processed/rules/naming-rules.md` and `docs/processed/rules/git-and-pull-request-rules.md`. Follow `docs/processed/guides/git-workflow.md` for the execution sequence.

## Non-negotiable checks

- Write explanatory content in Vietnamese. Use lowercase English kebab-case for new folder and file names.
- Keep raw source files unchanged. Do not silently overwrite another member's task or output.
- A task is complete only when every agreed Definition of Done item is checked, its product is linked, and the completion time is recorded.
- Use the templates; keep their headings unless there is a concrete reason to add detail.
