# Sync script for GitHub and Hugging Face
$ErrorActionPreference = "Stop"

Write-Host "Syncing to GitHub and Hugging Face..." -ForegroundColor Cyan

# Get current branch
$branch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $branch" -ForegroundColor Yellow

# Stage all changes
Write-Host "Staging changes..." -ForegroundColor Yellow
git add -A

# Check if there are changes to commit
$changes = git status --porcelain
if ($changes) {
    # Commit with timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-sync: $timestamp"
    Write-Host "Changes committed" -ForegroundColor Green
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}

# Push to GitHub (origin)
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin $branch
Write-Host "GitHub push complete" -ForegroundColor Green

# Push to Hugging Face (space)
Write-Host "Pushing to Hugging Face..." -ForegroundColor Yellow
git push space $branch
Write-Host "Hugging Face push complete" -ForegroundColor Green

Write-Host "Sync complete!" -ForegroundColor Green
