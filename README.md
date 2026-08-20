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

## Signal on an example chart

The schematic shows a bullish momentum flip, price alignment above the Keltner bias, and the confirming closed candle that releases a LONG signal.

![AdaptiveMomentumRibbon signal on an illustrative ticker chart](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-AdaptiveMomentumRibbon/main/docs/signal-example.svg)

The illustration is schematic, not market data. Exact thresholds, confirmation
rules, and risk parameters come from the active TradeJS strategy config.

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

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS Project owns their exact installed versions and package manifest, so this package never loads a hidden nested engine, types package, indicator package, or Strategy Kit. Repository builds use matching dev dependencies only.
