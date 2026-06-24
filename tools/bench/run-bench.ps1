# run-bench.ps1 — Windows wrapper for tools/bench/run-bench.mjs.
# Runs the scene200 perf benchmark on the Native Layer app (and Cedric's DawnTest /
# BN Playground if built on this machine), then opens an HTML report.
#
#   pwsh tools\bench\run-bench.ps1 --frames 600
#   pwsh tools\bench\run-bench.ps1 --frames 200 --no-open
param([Parameter(ValueFromRemainingArguments = $true)] $Rest)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $here "run-bench.mjs") @Rest
