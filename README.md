# @tradejs/strategy-adaptive-momentum-ribbon

TradeJS strategy plugin providing `AdaptiveMomentumRibbon`.

## Strategy overview

`AdaptiveMomentumRibbon` follows momentum regime changes from a smoothed
oscillator, confirms them against a Keltner Channel bias, and can wait for the
next closed candle before entering. ATR-based invalidation and configurable
risk/reward targets keep long and short decisions deterministic in backtests,
replay, and live evaluation.

## Logic at a glance

![AdaptiveMomentumRibbon strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-AdaptiveMomentumRibbon/main/docs/strategy-logic.svg)

## Install

```bash
yarn add @tradejs/strategy-adaptive-momentum-ribbon
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-adaptive-momentum-ribbon"],
});
```

The package exports `strategyEntries` for the TradeJS plugin loader together
with its strategy definitions, manifests, default configs, and public AI/ML
adapters. Strategy implementation changes are released from this repository,
independently of the TradeJS engine.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow. A relevant push publishes a unique
prerelease and moves the npm `beta` tag only after the production-like Project
image passes. The current verified beta is promoted to one stable `latest`
release by the weekly automation; production never consumes prereleases.

Keywords: ai, claude, codex.
