import { defineStrategyPlugin } from "@tradejs/core/config";
import type { StrategyConfig, StrategyRegistryEntry } from "@tradejs/types";
import { config as adaptiveMomentumRibbonDefaultConfig } from "./AdaptiveMomentumRibbon/config";
import { AdaptiveMomentumRibbonStrategyDefinition } from "./AdaptiveMomentumRibbon/strategy";

export const strategyEntries: StrategyRegistryEntry[] = [
  AdaptiveMomentumRibbonStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  AdaptiveMomentumRibbon: adaptiveMomentumRibbonDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { AdaptiveMomentumRibbonStrategyDefinition } from "./AdaptiveMomentumRibbon/strategy";
export { adaptiveMomentumRibbonDefaultConfig };
export { adaptiveMomentumRibbonManifest } from "./AdaptiveMomentumRibbon/manifest";
export { adaptiveMomentumRibbonAiAdapter } from "./AdaptiveMomentumRibbon/adapters/ai";
export { adaptiveMomentumRibbonMlAdapter } from "./AdaptiveMomentumRibbon/adapters/ml";

export default defineStrategyPlugin({ strategyEntries });
