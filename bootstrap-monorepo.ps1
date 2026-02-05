$ErrorActionPreference = "Stop"

function WriteFile($path, $content) {
  $dir = Split-Path $path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Set-Content -Path $path -Value $content -Encoding UTF8
  Write-Host "Wrote $path"
}

# Folders
@(
  "apps/api/src",
  "apps/desktop",
  "packages/core/src",
  "packages/types/src",
  "runelite-bridge/plugin",
  "."
) | ForEach-Object {
  if (!(Test-Path $_)) { New-Item -ItemType Directory -Path $_ | Out-Null; Write-Host "Created $_" }
}

# Workspace
WriteFile "pnpm-workspace.yaml" @"
packages:
  - "apps/*"
  - "packages/*"
  - "runelite-bridge/*"
"@

# Root configs
WriteFile ".gitignore" @"
node_modules
dist
.vite
.DS_Store
.env
.env.local
*.log
coverage
"@

WriteFile "tsconfig.base.json" @"
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
"@

WriteFile ".eslintrc.cjs" @"
module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["dist", "node_modules", "coverage"],
};
"@

WriteFile ".prettierrc" @"
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "trailingComma": "all"
}
"@

# Root package.json
WriteFile "package.json" @"
{
  "name": "rs-flip-tool",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev:api": "pnpm -C apps/api dev",
    "dev:web": "pnpm -C apps/web dev",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "prettier": "^3.2.5",
    "typescript": "^5.5.4"
  }
}
"@

# Docs (FF-002)
WriteFile "STATE.md" @"
# FlipFinder - STATE

## Repo
- dalan-heredia/rs-flip-tool

## Current Milestone
M0 - Project Setup

## What works end-to-end
- Repo scaffolding + docs + shared packages (pending first commit).

## Next tasks (ranked)
1) FF-001 - Monorepo scaffold + workspace tooling (this commit)
2) FF-002 - Docs + handoff conventions (this commit)
3) FF-003 - Shared DTOs in packages/types (this commit)
4) FF-013 - API skeleton (health + WS)
5) FF-015 - Web UI skeleton (connect WS)

## Known blockers
- None

## Last updated
- 2026-02-05 (America/Chicago)

## Handoff Protocol
- Read STATE.md first.
- Then read DECISIONS.md and API_CONTRACTS.md.
- Only work items listed under “Next tasks” unless a change request is logged.
"@

WriteFile "DECISIONS.md" @"
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
"@

WriteFile "API_CONTRACTS.md" @"
# FlipFinder - API Contracts (SchemaVersion 1)

All top-level messages include:
- schemaVersion: 1
- ts: unix epoch ms

## WebSocket Envelope
\`\`\`ts
export type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1;
  ts: number;
  type: TType;
  payload: TPayload;
};
\`\`\`

## WalletTelemetryDTO (Bridge -> API)
\`\`\`ts
export type WalletTelemetryDTO = {
  schemaVersion: 1;
  ts: number;
  sessionId: string;
  source: "runelite-bridge";
  coins: number;
  platinumTokens: number;
  cashTotal: number;
};
\`\`\`

## OfferSnapshotDTO (Bridge -> API)
\`\`\`ts
export type OfferType = "BUY" | "SELL" | "UNKNOWN";
export type OfferState =
  | "EMPTY"
  | "BUYING"
  | "BOUGHT"
  | "SELLING"
  | "SOLD"
  | "CANCELLED"
  | "UNKNOWN";

export type OfferSnapshotDTO = {
  slot: number;
  itemId: number;
  type: OfferType;
  state: OfferState;
  price: number;
  totalQuantity: number;
  filledQuantity: number;
  lastChangeTs?: number;
};
\`\`\`

## FlipRecommendationDTO (API -> UI)
\`\`\`ts
export type FlipRecommendationDTO = {
  itemId: number;
  itemName?: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  taxPerUnit: number;
  netSellPerUnit: number;
  profitPerUnit: number;
  totalProfit: number;
  estBuyMin: number;
  estSellMin: number;
  breakoutScore: number;
  score: number;
  buyLimit4h?: number;
  limitRemaining?: number;
};
\`\`\`
"@

WriteFile "RUNBOOK.md" @"
# RUNBOOK

## Prereqs
- Node LTS (20+ recommended)
- pnpm (via corepack or installed directly)

## Commands
- pnpm install
- pnpm dev:api
- pnpm dev:web
- pnpm lint
- pnpm typecheck
"@

WriteFile "RISKS.md" @"
# RISKS

1) Market data staleness / downtime
- Mitigation: caching + stale flags + fail-safe.

2) Fill-time estimation accuracy
- Mitigation: conservative defaults + calibration.

3) Limit tracking correctness
- Mitigation: only count confirmed fills; rolling 4h ledger.
"@

# packages/types (FF-003)
WriteFile "packages/types/package.json" @"
{
  "name": "@rsflip/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "echo \"(no tests)\""
  }
}
"@

WriteFile "packages/types/tsconfig.json" @"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/**/*.ts"]
}
"@

WriteFile "packages/types/src/index.ts" @"
export type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1;
  ts: number;
  type: TType;
  payload: TPayload;
};

export type WalletTelemetryDTO = {
  schemaVersion: 1;
  ts: number;
  sessionId: string;
  source: 'runelite-bridge';
  coins: number;
  platinumTokens: number;
  cashTotal: number;
};

export type OfferType = 'BUY' | 'SELL' | 'UNKNOWN';

export type OfferState =
  | 'EMPTY'
  | 'BUYING'
  | 'BOUGHT'
  | 'SELLING'
  | 'SOLD'
  | 'CANCELLED'
  | 'UNKNOWN';

export type OfferSnapshotDTO = {
  slot: number;
  itemId: number;
  type: OfferType;
  state: OfferState;
  price: number;
  totalQuantity: number;
  filledQuantity: number;
  lastChangeTs?: number;
};

export type FlipRecommendationDTO = {
  itemId: number;
  itemName?: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;

  taxPerUnit: number;
  netSellPerUnit: number;
  profitPerUnit: number;
  totalProfit: number;

  estBuyMin: number;
  estSellMin: number;

  breakoutScore: number;
  score: number;

  buyLimit4h?: number;
  limitRemaining?: number;
};
"@

# packages/core (FF-001 skeleton)
WriteFile "packages/core/package.json" @"
{
  "name": "@rsflip/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@rsflip/types": "workspace:*"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "echo \"(no tests yet)\""
  }
}
"@

WriteFile "packages/core/tsconfig.json" @"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"]
}
"@

WriteFile "packages/core/src/index.ts" @"
export const helloCore = () => 'core-ready';
"@

# apps/api skeleton (FF-001 baseline; FF-013 later)
WriteFile "apps/api/package.json" @"
{
  "name": "@rsflip/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "fastify": "^4.28.1"
  },
  "devDependencies": {
    "tsx": "^4.16.2",
    "@types/node": "^20.14.10",
    "typescript": "^5.5.4"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "echo \"(no tests)\""
  }
}
"@

WriteFile "apps/api/tsconfig.json" @"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
"@

WriteFile "apps/api/src/server.ts" @"
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
  return {
    ok: true,
    version: '0.0.0',
    uptimeSec: Math.floor(process.uptime()),
    schemaVersion: 1
  };
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
"@

Write-Host "`nBootstrap complete."
Write-Host "Next: create the web app (Vite) + install deps."
