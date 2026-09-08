import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import {
  AdaptiveMomentumRibbonConfig,
  config as DEFAULT_CONFIG,
} from "./config";
import { createAdaptiveMomentumRibbonCore } from "./core";
import { adaptiveMomentumRibbonManifest } from "./manifest";

export const AdaptiveMomentumRibbonStrategyDefinition: ValidatedStrategyRegistryEntry<AdaptiveMomentumRibbonConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "AdaptiveMomentumRibbon",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createAdaptiveMomentumRibbonCore,
    manifest: adaptiveMomentumRibbonManifest,
  };
