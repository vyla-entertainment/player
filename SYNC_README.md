# Repository Sync Setup

This repository is configured to automatically sync to both GitHub and Hugging Face Space.

## Remotes

- **origin**: https://github.com/vyla-entertainment/player.git (GitHub)
- **space**: https://huggingface.co/spaces/JonathanGalindo/Vyla-Player (Hugging Face)

## Automatic Sync

### Post-Commit Hook (Automatic)

After every commit, the repository automatically pushes to both GitHub and Hugging Face in the background.

**No action required** - just commit normally:
```bash
git add .
git commit -m "Your message"
```

The hook will handle pushing to both remotes automatically.

## Manual Sync Scripts

If you need to manually sync or prefer explicit control:

### Windows Batch Script
```bash
sync.bat
```

### PowerShell Script (Recommended)
```powershell
.\sync.ps1
```

The PowerShell script provides:
- Dynamic branch detection
- Change detection (only commits if there are changes)
- Colored output for better visibility
- Error handling

## Troubleshooting

### If the hook doesn't run
Make sure the hook is executable:
```bash
chmod +x .git/hooks/post-commit
```

### To disable automatic sync
Remove or rename the post-commit hook:
```bash
mv .git/hooks/post-commit .git/hooks/post-commit.disabled
```

### To sync manually
```bash
git push origin main
git push space main
```
