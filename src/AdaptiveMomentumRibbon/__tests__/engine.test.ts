import { createHash } from "node:crypto";
import { config as DEFAULT_CONFIG } from "../config";
import {
  createAdaptiveMomentumRibbonEngine,
  evaluateAdaptiveMomentumRibbon,
} from "../engine";

const makeCandle = (timestamp: number, close: number) => ({
  timestamp,
  dt: new Date(timestamp).toISOString(),
  open: close - 0.2,
  close,
  high: close + 0.8,
  low: close - 0.8,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeCandles = () => {
  const start = 1_700_000_000_000;
  return Array.from({ length: 80 }, (_, index) => {
    const wave = Math.sin(index / 4) * 3;
    const trend = index * 0.04;
    return makeCandle(start + index * 900_000, 100 + trend + wave);
  });
};

describe("createAdaptiveMomentumRibbonEngine", () => {
  it("rebuilds runtime state from initialCandles like a full evaluation pass", () => {
    const candles = makeCandles();
    const config = {
      ...DEFAULT_CONFIG,
      AMR_MOMENTUM_PERIOD: 8,
      AMR_BUTTERWORTH_SMOOTHING: 3,
      AMR_KC_LENGTH: 8,
      AMR_ATR_LENGTH: 5,
      AMR_MIN_SIGNAL_OSC_ABS: 0.1,
      AMR_REQUIRE_KC_BIAS: false,
      AMR_CONFIRM_ON_NEXT_BAR: true,
      AMR_WAIT_CLOSE: true,
      AMR_MIN_BARS_BETWEEN_SIGNALS: 2,
    } as any;
    const linePlots = [
      "signalOsc",
      "kcMidline",
      "kcUpper",
      "kcLower",
      "invalidationLevel",
    ];

    const fullEvaluation = evaluateAdaptiveMomentumRibbon({
      candles,
      config,
      linePlots,
    });
    const engine = createAdaptiveMomentumRibbonEngine({
      config,
      linePlots,
      initialCandles: candles.slice(0, -1),
    });
    const runtimeEvaluation = engine.next(candles[candles.length - 1]);

    expect(runtimeEvaluation).toEqual(fullEvaluation);
  });
});

const windowConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    AMR_CONFIRMATION_WINDOW_BARS: 4,
    AMR_MOMENTUM_PERIOD: 8,
    AMR_BUTTERWORTH_SMOOTHING: 3,
    AMR_KC_LENGTH: 8,
    AMR_ATR_LENGTH: 5,
    AMR_MIN_SIGNAL_OSC_ABS_LONG: 1.75,
    AMR_MIN_SIGNAL_OSC_ABS_SHORT: 1.25,
    AMR_REQUIRE_KC_BIAS: false,
    AMR_CONFIRM_ON_NEXT_BAR: true,
    AMR_WAIT_CLOSE: false,
    AMR_MIN_BARS_BETWEEN_SIGNALS: 2,
    ...overrides,
  }) as any;

const replay = (
  overrides: Record<string, unknown> = {},
  candles = makeCandles(),
) => {
  const engine = createAdaptiveMomentumRibbonEngine({
    config: windowConfig(overrides),
    linePlots: ["signalOsc", "invalidationLevel"],
  });
  return candles.map((candle) => engine.next(candle).snapshot);
};

const entryIndexes = (snapshots: ReturnType<typeof replay>) =>
  snapshots.flatMap((snapshot, index) =>
    snapshot.entryLong || snapshot.entryShort ? [index] : [],
  );

describe("causal crossing confirmation window", () => {
  it("accepts delayed directional amplitude once per crossing and retains crossing stops", () => {
    const candles = makeCandles();
    const snapshots = replay({}, candles);
    expect(snapshots[20].signalOsc).toBeLessThan(0);
    expect(snapshots[21].signalOsc).toBeGreaterThan(0);
    expect(snapshots[21].signalOsc).toBeLessThan(1.75);
    expect(snapshots[24].entryLong).toBe(true);
    expect(snapshots[24].invalidationLevel).toBe(candles[21].low);
    expect(snapshots[38].entryShort).toBe(true);
    expect(snapshots[38].invalidationLevel).toBe(candles[34].high);
    expect(entryIndexes(snapshots)).toEqual([24, 38, 49, 63, 75]);
  });

  it("includes the fourth bar after crossing but expires before the fifth", () => {
    const onBoundary = replay({ AMR_MIN_SIGNAL_OSC_ABS_LONG: 2.2 });
    expect(onBoundary[25].entryLong).toBe(true);
    const afterBoundary = replay({ AMR_MIN_SIGNAL_OSC_ABS_LONG: 2.5 });
    expect(afterBoundary[26].signalOsc).toBeGreaterThan(2.5);
    expect(afterBoundary.slice(21, 34).some((s) => s.entryLong)).toBe(false);
  });

  it.each(["LONG", "SHORT"])(
    "cancels %s on a broken crossing stop even when amplitude later recovers",
    (direction) => {
      const candles = makeCandles();
      const crossing = direction === "LONG" ? 21 : 34;
      const confirmation = direction === "LONG" ? 24 : 38;
      const property = direction === "LONG" ? "low" : "high";
      const level = candles[crossing][property];
      const touched = candles.map((candle) => ({ ...candle }));
      touched[crossing + 1][property] = level;
      expect(entryIndexes(replay({}, touched))).toContain(confirmation);
      const broken = candles.map((candle) => ({ ...candle }));
      broken[crossing + 1][property] =
        level + (direction === "LONG" ? -0.01 : 0.01);
      const snapshots = replay({}, broken);
      expect(entryIndexes(snapshots)).not.toContain(confirmation);
      expect(snapshots[confirmation].signalOsc).toBe(
        replay({}, candles)[confirmation].signalOsc,
      );
    },
  );

  it("checks spacing on acceptance and cannot revive an expired crossing", () => {
    const snapshots = replay({ AMR_MIN_BARS_BETWEEN_SIGNALS: 16 });
    expect(snapshots[24].entryLong).toBe(true);
    expect(snapshots[38].signalOsc).toBeLessThan(-1.25);
    expect(snapshots[40].signalOsc).toBeLessThan(-1.25);
    expect(snapshots.slice(34, 46).some((s) => s.entryShort)).toBe(false);
    expect(snapshots[49].entryLong).toBe(true);
  });

  it("retains the KC predicate when oscillator amplitude qualifies", () => {
    const snapshots = replay({
      AMR_REQUIRE_KC_BIAS: true,
      AMR_KC_MA_TYPE: "EMA",
      AMR_KC_LENGTH: 1,
    });
    expect(snapshots[24].signalOsc).toBeGreaterThan(1.75);
    expect(snapshots[24].kcMidline).toBe(makeCandles()[24].close);
    expect(entryIndexes(snapshots)).toEqual([]);
  });

  it.each([true, false])(
    "replays every prefix with identical state when waitClose=%s",
    (waitClose) => {
      const candles = makeCandles();
      const config = windowConfig({ AMR_WAIT_CLOSE: waitClose });
      const linePlots = ["signalOsc", "invalidationLevel"];
      const engine = createAdaptiveMomentumRibbonEngine({ config, linePlots });
      for (let length = 1; length <= candles.length; length += 1) {
        const incremental = engine.next(candles[length - 1]);
        expect(incremental).toEqual(
          evaluateAdaptiveMomentumRibbon({
            candles: candles.slice(0, length),
            config,
            linePlots,
          }),
        );
        const restored = createAdaptiveMomentumRibbonEngine({
          config,
          linePlots,
          initialCandles: candles.slice(0, length - 1),
        });
        expect(restored.next(candles[length - 1])).toEqual(incremental);
      }
    },
  );

  it("replaces a pending crossing after a recross and uses the new crossing stop", () => {
    const candles = makeCandles().map((candle, index) => ({
      ...candle,
      close: index === 22 ? 94 : candle.close,
      low: index <= 21 ? 0 : 1,
      high: 200,
    }));
    const snapshots = replay({ AMR_MIN_SIGNAL_OSC_ABS_SHORT: 99 }, candles);
    expect(snapshots[21].signalOsc).toBeGreaterThan(0);
    expect(snapshots[22].signalOsc).toBeLessThan(0);
    expect(snapshots[23].signalOsc).toBeGreaterThan(0);
    expect(snapshots[25].entryLong).toBe(true);
    expect(snapshots[25].invalidationLevel).toBe(candles[23].low);
    expect(snapshots[25].invalidationLevel).not.toBe(candles[21].low);
  });

  it("honors next-bar confirmation even when amplitude already qualifies on the crossing", () => {
    const overrides = { AMR_MIN_SIGNAL_OSC_ABS_LONG: 0.1 };
    const confirmed = replay(overrides);
    const immediate = replay({ ...overrides, AMR_CONFIRM_ON_NEXT_BAR: false });
    expect(confirmed[21].entryLong).toBe(false);
    expect(confirmed[22].entryLong).toBe(true);
    expect(immediate[21].entryLong).toBe(true);
    expect(immediate[22].entryLong).toBe(false);
  });
});

// Frozen against peeled v3.0.3 (7fddddea), before the window implementation.
describe("zero-window legacy compatibility", () => {
  it.each([
    [
      true,
      true,
      "138af6a6c8ac71952706f53c0b6d8e3043cfe617dcde34fcacbf08b32033e530",
    ],
    [
      true,
      false,
      "29b9be7f360f0fef61052f4078af42b91353f49c0572f2b39b70669d1487264e",
    ],
    [
      false,
      true,
      "9994a0d7ddcf545213ce656a6f22b96661ca3e1fe966e641299ff8361603bdb9",
    ],
    [
      false,
      false,
      "d754e77396efe375139540ea8c34fc522b93dfdd0d360ba7f306de96972f6170",
    ],
  ])(
    "matches the original complete snapshot stream for waitClose=%s confirm=%s",
    (waitClose, confirm, expectedHash) => {
      const candles = Array.from({ length: 160 }, (_, index) =>
        makeCandle(
          1_700_000_000_000 + index * 900_000,
          100 + Math.sin(index / 4) * 3 + index * 0.04,
        ),
      );
      for (const window of [0, undefined]) {
        const snapshots = replay(
          {
            AMR_CONFIRMATION_WINDOW_BARS: window,
            AMR_WAIT_CLOSE: waitClose,
            AMR_CONFIRM_ON_NEXT_BAR: confirm,
            AMR_MIN_SIGNAL_OSC_ABS_LONG: 0.1,
            AMR_MIN_SIGNAL_OSC_ABS_SHORT: 0.1,
          },
          candles,
        );
        expect(entryIndexes(snapshots)).toHaveLength(3);
        expect(
          createHash("sha256").update(JSON.stringify(snapshots)).digest("hex"),
        ).toBe(expectedHash);
      }
    },
  );
});
