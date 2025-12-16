# Syncing Updates from Upstream

This guide explains how to update your fork (origin) with the latest changes from the upstream repository (`ryokun6/ryos`).

## Prerequisites

Make sure you have the upstream remote configured:
```bash
git remote -v
```

You should see:
- `origin` - Your fork (`provhatrahman/DT-Intranet`)
- `upstream` - The original repository (`ryokun6/ryos`)

If upstream is not configured, add it:
```bash
git remote add upstream https://github.com/ryokun6/ryos.git
```

## Step-by-Step Sync Process

### 1. Fetch Latest Changes
Download all updates from upstream without modifying your local code:
```bash
git fetch upstream
```

### 2. Switch to Your Branch
Make sure you're on the branch you want to update:
```bash
git checkout dt-intranet-main
```

### 3. Merge Upstream Changes
Combine upstream changes with your local branch. You have two options:

#### Option A: Merge (Recommended for most cases)
Creates a merge commit that preserves the full history:
```bash
git merge upstream/main
```

#### Option B: Rebase
Replays your commits on top of upstream for a linear history:
```bash
git rebase upstream/main
```

**Note:** Rebase rewrites commit history. Only use if you haven't pushed your branch yet, or if you're comfortable with force-pushing.

### 4. Resolve Conflicts (if any)
If there are conflicts, Git will pause and ask you to resolve them:
1. Open the conflicted files
2. Resolve the conflicts manually
3. Stage the resolved files: `git add <file>`
4. Continue the merge/rebase:
   - For merge: `git commit`
   - For rebase: `git rebase --continue`

### 5. Push to Your Fork
Push the updated branch to your origin (fork):
```bash
git push origin dt-intranet-main
```

If you used rebase and already pushed before, you may need to force-push:
```bash
git push --force-with-lease origin dt-intranet-main
```

## Complete Example

Here's a complete workflow to sync `upstream/main` into your `dt-intranet-main` branch:

```bash
# 1. Fetch latest changes
git fetch upstream

# 2. Switch to your branch
git checkout dt-intranet-main

# 3. Merge upstream changes
git merge upstream/main

# 4. Push to your fork
git push origin dt-intranet-main
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git fetch upstream` | Download updates without changing your code |
| `git merge upstream/main` | Combine upstream changes with yours (creates merge commit) |
| `git rebase upstream/main` | Replay your commits on top of upstream (linear history) |
| `git push origin <branch>` | Push to your fork |
| `git status` | Check current branch and status |

## Troubleshooting

### "Your branch is ahead of 'origin/...'"
This is normal after merging. Just push your changes:
```bash
git push origin dt-intranet-main
```

### Merge conflicts
1. Check which files have conflicts: `git status`
2. Open and resolve conflicts in those files
3. Stage resolved files: `git add <file>`
4. Complete the merge: `git commit`

### Upstream branch not found
Make sure you've fetched from upstream:
```bash
git fetch upstream
git branch -r | Select-String upstream
```

## Best Practices

1. **Always fetch first** - Check what's new before merging
2. **Commit your work** - Make sure your local changes are committed before syncing
3. **Test after merging** - Verify everything works after syncing
4. **Use merge for shared branches** - Prefer merge over rebase for branches others might be using
5. **Keep upstream in sync** - Regularly sync to avoid large merge conflicts
