# FlipFinder - DECISIONS (Project Invariants)

## Core Invariants
- Output recommendation must include: buyPrice, sellPrice, qty.
- GE Tax: 2% sell-side tax (floor) with 5,000,000 gp per-item cap.
- Time windows are per-leg and strict by default:
  - Buy fill time in [5,45] minutes
  - Sell fill time in [5,45] minutes
- Avoid low-volume bag-holding: liquidity filters + size caps are mandatory.
- Account for GE buy limits: mapping limit + rolling 4-hour filled-buy ledger.
- No in-game automation. Telemetry + recommendations only.

## Tech Stack
- Monorepo: pnpm workspaces
- Language: TypeScript
- UI: React + Vite
- API: Node + Fastify + WebSocket
- Desktop: Electron (later milestone)
- Storage: SQLite
- Shared logic: packages/core
- Shared DTOs: packages/types

## Defaults (initial)
- allocPct: 0.20
- maxPerItemExposure: 0.25
- minV5 thinner-side volume: 200
- minV60 thinner-side volume: 3000
- maxSpreadPct: 0.06
- qtyLiqFraction: 0.10
- offerAdviceCooldownMin: 2
