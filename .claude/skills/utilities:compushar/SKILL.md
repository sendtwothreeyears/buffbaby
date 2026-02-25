---
name: utilities:compushar
description: "Compushar (Commit-Push-PR): Quick workflow to commit all changes, push to remote, and open a PR"
disable-model-invocation: true
---

# Compushar (Commit-Push-PR)

Quick workflow to commit all changes, push to remote, and open a PR if one doesn't exist.

**Usage:** `/utilities:compushar [optional commit message]`

---

## Step 1: Check Current State

```bash
git status
git branch --show-current
```

Verify there are changes to commit. If working tree is clean, report "Nothing to commit" and exit.

---

## Step 2: Commit Changes

1. Stage all changes: `git add -A`

2. Generate commit message (or use `$ARGUMENTS` if provided):
   - Use conventional commit format: `fix|feat|refactor|chore(scope): description`
   - Keep it concise (50 chars for title)
   - Add Co-Authored-By footer

3. Commit:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <description>

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

---

## Step 3: Push to Remote

1. Check if branch has upstream:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
   ```

2. Push (with upstream if needed):
   ```bash
   git push -u origin HEAD
   ```

---

## Step 4: Check for Existing PR

```bash
gh pr view --json number,url,state 2>/dev/null
```

- If PR exists and is OPEN: Report PR URL and exit
- If PR exists and is CLOSED/MERGED: Create new PR
- If no PR exists: Create new PR

---

## Step 5: Create PR (if needed)

1. Detect default branch dynamically:
   ```bash
   default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
   if [ -z "$default_branch" ]; then
     default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
   fi
   ```

2. Create PR:
   ```bash
   gh pr create --base "$default_branch" --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
   ## Summary
   - <bullet points of changes>

   ## Test Plan
   - [ ] Typecheck passes
   - [ ] Lint passes
   - [ ] Tests pass

   🤖 Generated with Claude Code
   EOF
   )"
   ```

---

## Step 6: Output

```
═══════════════════════════════════════
COMPUSHAR COMPLETE
═══════════════════════════════════════

Commit: <hash> <message>
Branch: <branch-name>
PR: <url> (NEW|EXISTING)

═══════════════════════════════════════
```

---

## Error Handling

- **No changes:** Report and exit cleanly
- **Push fails:** Check if branch exists on remote, suggest `git pull --rebase`
- **PR creation fails:** Report error, provide manual command

---

Now execute.
