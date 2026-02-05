param(
  [string]$Repo = ""
)

# FlipFinder issue/milestone bootstrapper (ASCII-safe, no here-strings)
# Requires: GitHub CLI (gh) authenticated and run inside the target repo (or pass -Repo OWNER/REPO)

$ErrorActionPreference = "Stop"

function Require-Gh {
  $null = Get-Command gh -ErrorAction Stop
  gh auth status | Out-Null
}

function Resolve-Repo([string]$RepoArg) {
  if ($RepoArg -and $RepoArg.Trim().Length -gt 0) { return $RepoArg.Trim() }

  $resolved = gh repo view --json nameWithOwner --jq '.nameWithOwner'
  if (-not $resolved) {
    throw "Could not resolve repo. Run inside a git repo connected to GitHub or pass -Repo OWNER/REPO."
  }
  return $resolved.Trim()
}

function Ensure-Label([string]$Repo, [string]$Name, [string]$Color, [string]$Desc) {
  Write-Host "Label: $Name"
  gh label create $Name --color $Color --description $Desc --force -R $Repo | Out-Null
}

function Get-MilestoneNumber([string]$Repo, [string]$Title) {
  $jq = ".[] | select(.title==`"$Title`") | .number"
  $num = gh api "repos/$Repo/milestones?state=all&per_page=100" --jq $jq
  if ($num) { return [int]$num }
  return $null
}

function Ensure-Milestone([string]$Repo, [string]$Title, [string]$Desc) {
  $existing = Get-MilestoneNumber -Repo $Repo -Title $Title
  if ($existing) {
    Write-Host "Milestone exists: $Title (#$existing)"
    return
  }
  Write-Host "Creating milestone: $Title"
  gh api -X POST "repos/$Repo/milestones" -f title="$Title" -f description="$Desc" | Out-Null
}

function Issue-Exists([string]$Repo, [string]$Title) {
  $results = gh issue list -R $Repo --search "in:title `"$Title`"" --json title --jq '.[].title'
  return ($results -split "`n" | Where-Object { $_ -eq $Title }).Count -gt 0
}

function New-Issue(
  [string]$Repo,
  [string]$Title,
  [string[]]$BodyLines,
  [string]$Milestone,
  [string[]]$Labels
) {
  if (Issue-Exists -Repo $Repo -Title $Title) {
    Write-Host "Skipping (exists): $Title"
    return
  }

  $body = ($BodyLines -join "`n")
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp.FullName -Value $body -Encoding UTF8

  $args = @("issue","create","-R",$Repo,"--title",$Title,"--body-file",$tmp.FullName,"--milestone",$Milestone)
  foreach ($lab in $Labels) { $args += @("--label",$lab) }

  Write-Host "Creating issue: $Title"
  gh @args | Out-Null

  Remove-Item $tmp.FullName -Force
}

# ----------------------------
# Run
# ----------------------------
Require-Gh
$Repo = Resolve-Repo $Repo
Write-Host "Target repo: $Repo"

# Labels
$labels = @(
  @{ n="core";        c="1D76DB"; d="Core engine (math, scoring, limits, advisor)" },
  @{ n="api";         c="0E8A16"; d="Local backend (Fastify, WS, ingestion, storage)" },
  @{ n="ui";          c="5319E7"; d="Web UI (React/Vite)" },
  @{ n="desktop";     c="B60205"; d="Electron wrapper / packaging" },
  @{ n="bridge";      c="FBCA04"; d="RuneLite bridge plugin (telemetry)" },
  @{ n="docs";        c="D4C5F9"; d="Documentation, runbooks, contracts" },
  @{ n="test";        c="C2E0C6"; d="Tests, harnesses, QA" },
  @{ n="infra";       c="0052CC"; d="Repo scaffolding, tooling, CI, scripts" },
  @{ n="bug";         c="D73A4A"; d="Bug fix" },
  @{ n="enhancement"; c="A2EEEF"; d="Enhancement / improvement" }
)
foreach ($l in $labels) {
  Ensure-Label -Repo $Repo -Name $l.n -Color $l.c -Desc $l.d
}

# Milestones (ASCII-safe names)
$ms = @(
  @{ t="M0 - Project Setup";              d="Repo scaffold, docs, DTOs, initial skeletons" },
  @{ t="M1 - Engine MVP (No Bridge)";     d="Price ingestion, core engine, ranked flips, basic UI" },
  @{ t="M2 - Bridge + Stack-Aware";       d="Wallet telemetry, cashFree sizing, bridge connectivity UX" },
  @{ t="M3 - Limits + Offer Manager";     d="Rolling buy limits, active GE offers, keep/reprice/abort advice" },
  @{ t="M4 - Calibration + Packaging";    d="Journaling/calibration, alerts, desktop packaging + runbook" }
)
foreach ($m in $ms) {
  Ensure-Milestone -Repo $Repo -Title $m.t -Desc $m.d
}

# Issues
$issues = @(
  @{
    t="FF-001 - Create monorepo scaffold + workspace tooling"; m="M0 - Project Setup"; l=@("infra");
    b=@(
      "## Description",
      "Set up the repository as a TS monorepo with apps + packages, shared configs, scripts, and a deterministic build pipeline.",
      "",
      "## Deliverables",
      "- Folder structure:",
      "  - apps/api, apps/web, apps/desktop",
      "  - packages/core, packages/types",
      "  - runelite-bridge/plugin",
      "- pnpm workspaces",
      "- Shared TS config + ESLint + Prettier",
      "- Test runner for packages/core",
      "",
      "## Acceptance Criteria",
      "- pnpm i works from root",
      "- pnpm -w lint, pnpm -w test, pnpm -w build all succeed",
      "- apps/web runs via dev server (blank page ok)",
      "",
      "## Dependencies",
      "None"
    )
  },
  @{
    t="FF-002 - Add required docs + handoff conventions"; m="M0 - Project Setup"; l=@("docs");
    b=@(
      "## Description",
      "Add project docs that every LLM/human can follow to continue work.",
      "",
      "## Deliverables",
      "- STATE.md, DECISIONS.md, API_CONTRACTS.md, RUNBOOK.md, RISKS.md",
      "- Definition of Done + Handoff Protocol included",
      "",
      "## Acceptance Criteria",
      "- Docs exist and match the agreed templates",
      "- STATE.md lists next 3-7 tasks clearly",
      "",
      "## Dependencies",
      "None"
    )
  },
  @{
    t="FF-003 - Define shared DTOs and schema versioning in packages/types"; m="M0 - Project Setup"; l=@("infra");
    b=@(
      "## Description",
      "Create TypeScript DTOs for Bridge->API telemetry and API->UI data, plus WebSocket envelopes.",
      "",
      "## Deliverables",
      "- WalletTelemetryDTO, OfferSnapshotDTO, OffersTelemetryDTO",
      "- PriceSnapshotDTO, FlipRecommendationDTO, OfferAdviceDTO",
      "- WsEnvelope<TType,TPayload>",
      "- schemaVersion included in top-level messages",
      "",
      "## Acceptance Criteria",
      "- Types compile and are imported by both apps/api and apps/web",
      "",
      "## Dependencies",
      "FF-001"
    )
  },
  @{
    t="FF-004 - Implement core tax math + helpers (packages/core/tax.ts)"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Implement GE sell-side tax logic:",
      "- taxRate=0.02",
      "- floor rounding",
      "- cap at 5,000,000 per item",
      "Expose helpers: geTax(), netSell(), profitPerUnit().",
      "",
      "## Acceptance Criteria",
      "- Unit tests cover rounding edge cases and cap",
      "- Functions are pure/deterministic",
      "",
      "## Dependencies",
      "FF-001, FF-003"
    )
  },
  @{
    t="FF-005 - Build price ingestion service in API (poll latest/5m/1h/mapping)"; m="M1 - Engine MVP (No Bridge)"; l=@("api");
    b=@(
      "## Description",
      "Implement polling of OSRS Wiki endpoints and caching.",
      "",
      "## Deliverables",
      "- Polling schedule per endpoint",
      "- In-memory cache (MVP) + staleness flags",
      "- Basic logging + error handling",
      "",
      "## Acceptance Criteria",
      "- GET /api/market/snapshot returns data for >=100 items",
      "- Stale indicator flips if polling fails or data ages beyond threshold",
      "",
      "## Dependencies",
      "FF-001, FF-003"
    )
  },
  @{
    t="FF-006 - Add SQLite storage + schema for snapshots"; m="M1 - Engine MVP (No Bridge)"; l=@("api");
    b=@(
      "## Description",
      "Persist snapshot history locally (per-item, per-minute) to support breakout metrics.",
      "",
      "## Acceptance Criteria",
      "- At least last 60 minutes retained per item",
      "- Prune job runs periodically",
      "- API can query last N minutes for an itemId",
      "",
      "## Dependencies",
      "FF-005"
    )
  },
  @{
    t="FF-007 - Implement liquidity filters + bag-hold prevention rules (packages/core/liquidity.ts)"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Hard filters:",
      "- min 5m thinner-side volume",
      "- min 1h thinner-side volume",
      "- max spreadPct",
      "Plus qty caps based on short-window volume.",
      "Return structured rejection reasons.",
      "",
      "## Acceptance Criteria",
      "- Unit tests cover low-volume exclusion",
      "- Rejection reasons are stable strings/enums",
      "",
      "## Dependencies",
      "FF-003"
    )
  },
  @{
    t="FF-008 - Implement per-leg fill-time estimator (packages/core/fillTime.ts)"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Estimate buy and sell fill times separately using 5m volumes and competitiveness factors.",
      "",
      "## Acceptance Criteria",
      "- Deterministic outputs with unit tests",
      "- Returns estBuyMin and estSellMin given snapshot + qty + aggressiveness",
      "",
      "## Dependencies",
      "FF-003, FF-007"
    )
  },
  @{
    t="FF-009 - Implement limit tracker (rolling 4h ledger) (packages/core/limits.ts)"; m="M3 - Limits + Offer Manager"; l=@("core","test");
    b=@(
      "## Description",
      "Track remaining GE buy limits using mapping limit and rolling 4-hour filled-buys ledger.",
      "",
      "## Acceptance Criteria",
      "- limitRemaining(itemId, now) correct for synthetic streams",
      "- Prunes entries older than 4h",
      "- Handles unknown limits gracefully",
      "",
      "## Dependencies",
      "FF-003, FF-019, FF-020"
    )
  },
  @{
    t="FF-010 - Implement breakout scoring + signal store (packages/core/signals.ts)"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Compute breakout score from stored minute snapshots:",
      "- short return (5m)",
      "- volume spike",
      "- spread regime checks",
      "Return breakoutScore plus components.",
      "",
      "## Acceptance Criteria",
      "- Works for items with enough history",
      "- Unit tests on synthetic sequences (breakout vs chop vs thin spike)",
      "",
      "## Dependencies",
      "FF-006"
    )
  },
  @{
    t="FF-011 - Implement chooseTradeParams solver (buy/sell/qty) with per-leg 5-45 constraints"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Solver that chooses buyPrice, sellPrice, qty such that:",
      "- Buy fill time in [5,45] minutes",
      "- Sell fill time in [5,45] minutes",
      "- Respects cash cap, liquidity cap, and later limitRemaining cap",
      "Uses small grid search over aggressiveness.",
      "",
      "## Acceptance Criteria",
      "- Returns valid recommendation OR stable rejection reasons",
      "- Tests include hyper-liquid item, slow item rejected, tax flips profitability",
      "",
      "## Dependencies",
      "FF-004, FF-007, FF-008, FF-003"
    )
  },
  @{
    t="FF-012 - Implement ranking score (profit/min after-tax + risk penalties) (packages/core/score.ts)"; m="M1 - Engine MVP (No Bridge)"; l=@("core","test");
    b=@(
      "## Description",
      "Compute final score from after-tax profit, profit per minute, breakout weight, and risk penalties.",
      "",
      "## Acceptance Criteria",
      "- Deterministic ranking for fixed input set",
      "- Exposes score breakdown for UI explainability",
      "",
      "## Dependencies",
      "FF-011, FF-010"
    )
  },
  @{
    t="FF-013 - Create API server (Fastify) + endpoints + WebSocket"; m="M1 - Engine MVP (No Bridge)"; l=@("api");
    b=@(
      "## Description",
      "Set up API with REST + WebSocket broadcast framework.",
      "",
      "## Acceptance Criteria",
      "- /api/health returns ok + version + uptime + schemaVersion",
      "- WS accepts connections and can broadcast flips:update",
      "",
      "## Dependencies",
      "FF-001, FF-003"
    )
  },
  @{
    t="FF-014 - API: endpoint to serve ranked flips (GET /api/flips)"; m="M1 - Engine MVP (No Bridge)"; l=@("api");
    b=@(
      "## Description",
      "Compute and return ranked flip recommendations using latest cache + snapshot history.",
      "",
      "## Acceptance Criteria",
      "- Response includes buyPrice, sellPrice, qty, after-tax profit, estBuyMin/estSellMin, breakoutScore, score",
      "- Items failing constraints are excluded (or optionally returned with rejections behind a debug flag)",
      "",
      "## Dependencies",
      "FF-013, FF-011, FF-012"
    )
  },
  @{
    t="FF-015 - Web UI: Top Flips page (Vite/React)"; m="M1 - Engine MVP (No Bridge)"; l=@("ui");
    b=@(
      "## Description",
      "Build UI table for recommended flips with live updates via WS and basic filters.",
      "",
      "## Acceptance Criteria",
      "- Displays Buy/Sell/Qty, after-tax profit, estBuyMin and estSellMin separately",
      "- Updates without page refresh",
      "",
      "## Dependencies",
      "FF-014"
    )
  },
  @{
    t="FF-016 - Desktop wrapper: Electron app that loads the same UI"; m="M1 - Engine MVP (No Bridge)"; l=@("desktop");
    b=@(
      "## Description",
      "Electron shell that loads the web UI. In desktop mode, optionally starts the API automatically.",
      "",
      "## Acceptance Criteria",
      "- pnpm dev:desktop opens window showing Top Flips",
      "- Can run as a single desktop app without manual API start (desktop mode)",
      "",
      "## Dependencies",
      "FF-015, FF-013"
    )
  },
  @{
    t="FF-017 - RuneLite Bridge plugin skeleton + local token auth"; m="M2 - Bridge + Stack-Aware"; l=@("bridge");
    b=@(
      "## Description",
      "Create RuneLite plugin that can POST telemetry to 127.0.0.1 with shared secret token.",
      "",
      "## Acceptance Criteria",
      "- Plugin builds and loads",
      "- Sends heartbeat payload every 10-30s to API",
      "",
      "## Dependencies",
      "FF-013, FF-003"
    )
  },
  @{
    t="FF-018 - Bridge: Wallet telemetry (coins + platinum tokens)"; m="M2 - Bridge + Stack-Aware"; l=@("bridge");
    b=@(
      "## Description",
      "Compute wallet from coins (995) and platinum tokens (13204)*1000 across inventory/bank when available. Report cashTotal.",
      "",
      "## Acceptance Criteria",
      "- Telemetry updates when wallet changes",
      "- Backend stores latest wallet per session",
      "",
      "## Dependencies",
      "FF-017"
    )
  },
  @{
    t="FF-019 - Bridge: Active GE offer telemetry (8 slots)"; m="M3 - Limits + Offer Manager"; l=@("bridge");
    b=@(
      "## Description",
      "Send snapshot of active GE offers (8 slots) including slot, itemId, type, state, price, totalQty, filledQty, lastChange.",
      "",
      "## Acceptance Criteria",
      "- Backend receives and stores offers",
      "- UI can display slots with correct progress/state",
      "",
      "## Dependencies",
      "FF-017"
    )
  },
  @{
    t="FF-020 - API: telemetry endpoints + session state"; m="M2 - Bridge + Stack-Aware"; l=@("api");
    b=@(
      "## Description",
      "Add endpoints:",
      "- POST /api/telemetry/wallet",
      "- POST /api/telemetry/offers",
      "Maintain per-session state and broadcast telemetry:update.",
      "",
      "## Acceptance Criteria",
      "- Rejects missing/bad token",
      "- UI receives telemetry updates via WS",
      "",
      "## Dependencies",
      "FF-013, FF-017"
    )
  },
  @{
    t="FF-021 - Update engine to use cashFree (subtract reserved GP in buy offers)"; m="M3 - Limits + Offer Manager"; l=@("core","api");
    b=@(
      "## Description",
      "Compute cashFree = cashTotal - reservedGpInBuyOffers where reserved is sum(remainingQty * price) for BUY offers. Use cashFree for sizing.",
      "",
      "## Acceptance Criteria",
      "- Recommendations shrink when active buy offers reserve cash",
      "- UI shows cashTotal vs cashFree",
      "",
      "## Dependencies",
      "FF-019, FF-020, FF-011"
    )
  },
  @{
    t="FF-022 - Offer Advisor module (keep/reprice/abort) (packages/core/offerAdvisor.ts)"; m="M3 - Limits + Offer Manager"; l=@("core","test");
    b=@(
      "## Description",
      "For each active offer, compute projected remaining time, within-window flag (5-45), and action KEEP/REPRICE/ABORT with suggested price + rationale codes.",
      "",
      "## Acceptance Criteria",
      "- If projected remaining > 45, suggests viable reprice or abort",
      "- Rationale codes are stable and tested",
      "",
      "## Dependencies",
      "FF-019, FF-008, FF-004"
    )
  },
  @{
    t="FF-023 - Web UI: My GE Offers page"; m="M3 - Limits + Offer Manager"; l=@("ui");
    b=@(
      "## Description",
      "Show 8 GE slots with progress, projected remaining time, action badge, and suggested new price.",
      "",
      "## Acceptance Criteria",
      "- Live updates via WS",
      "- Clear BUY vs SELL leg handling and 5-45 enforcement for the correct leg",
      "",
      "## Dependencies",
      "FF-022, FF-020"
    )
  },
  @{
    t="FF-024 - Limit tracker integration + limit remaining UI"; m="M3 - Limits + Offer Manager"; l=@("core","ui");
    b=@(
      "## Description",
      "Wire mapping limits + rolling ledger into recommendations and UI: show limitRemaining + recovery ETA.",
      "",
      "## Acceptance Criteria",
      "- Recommendations never exceed remaining limit",
      "- UI shows remaining + recovery",
      "",
      "## Dependencies",
      "FF-009, FF-014, FF-015"
    )
  },
  @{
    t="FF-025 - Settings system (API + UI) persistence"; m="M4 - Calibration + Packaging"; l=@("api","ui");
    b=@(
      "## Description",
      "Persist settings in SQLite and apply live: allocation %, strictness, min volumes, max spread%, execution mode, alert thresholds.",
      "",
      "## Acceptance Criteria",
      "- Settings persist across restarts",
      "- Changing settings refreshes recommendations immediately",
      "",
      "## Dependencies",
      "FF-013, FF-015"
    )
  },
  @{
    t="FF-026 - Journal + Calibration (fill-time multipliers)"; m="M4 - Calibration + Packaging"; l=@("core","api","ui");
    b=@(
      "## Description",
      "Record realized fills and update per-user multipliers (effBuyMult/effSellMult) to improve fill estimates.",
      "",
      "## Acceptance Criteria",
      "- Calibration influences fill-time estimates after enough observations",
      "- UI shows calibration confidence (basic)",
      "",
      "## Dependencies",
      "FF-022, FF-020, FF-008"
    )
  },
  @{
    t="FF-027 - Alerts (desktop notifications + optional webhook)"; m="M4 - Calibration + Packaging"; l=@("ui","desktop");
    b=@(
      "## Description",
      "Alerts for: offer stalled, offer predicted to exceed 45 minutes, high-confidence breakout enters top N.",
      "",
      "## Acceptance Criteria",
      "- Alerts are rate-limited",
      "- User can toggle alert types",
      "",
      "## Dependencies",
      "FF-023, FF-026"
    )
  },
  @{
    t="FF-028 - Packaging + release runbook"; m="M4 - Calibration + Packaging"; l=@("desktop","docs");
    b=@(
      "## Description",
      "Package Electron app for Windows and write a release checklist.",
      "",
      "## Acceptance Criteria",
      "- Build artifact created",
      "- Runbook includes install/run/troubleshoot steps",
      "",
      "## Dependencies",
      "FF-016"
    )
  }
)

foreach ($i in $issues) {
  New-Issue -Repo $Repo -Title $i.t -BodyLines $i.b -Milestone $i.m -Labels $i.l
}

Write-Host ""
Write-Host "Done. Created milestones, labels, and issues (skipping existing)."
