@echo off

git fetch >output.txt 2>&1

for /f %%i in ("output.txt") do set size=%%~zi

if %size% gtr 0 git reset --hard

if %size% gtr 0 git pull origin master

if %size% gtr 0 npm ci

del output.txt

start /B node "D:\dev\Richot\PrinterServer\runner.js"