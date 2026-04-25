@echo off
echo Syncing to GitHub and Hugging Face...

git add -A
git commit -m "Auto-sync: %date% %time%"
git push origin main
git push space main

echo Sync complete!
pause
