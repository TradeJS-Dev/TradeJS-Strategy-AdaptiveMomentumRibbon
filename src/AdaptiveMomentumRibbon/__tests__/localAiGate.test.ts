import type { AiPayload, Signal } from "@tradejs/types";
import { adaptiveMomentumRibbonAiAdapter } from "../adapters/ai";

type GateInput = {
  direction?: "LONG" | "SHORT";
  volumeShare?: unknown;
  activeCount?: unknown;
  betaToBtc20?: unknown;
  mtfAlignment?: unknown;
  quality?: number;
  unrelatedContext?: Record<string, unknown>;
};

const evaluate = ({
  direction = "LONG",
  volumeShare,
  activeCount,
  betaToBtc20,
  mtfAlignment,
  quality = 5,
  unrelatedContext = {},
}: GateInput) =>
  adaptiveMomentumRibbonAiAdapter.postProcessLocalAnalysis?.({
    signal: {
      direction,
      prices: { takeProfitPrice: 110, stopLossPrice: 95 },
    } as Signal,
    payload: {
      additionalIndicators: {
        baseContext: {
          ...unrelatedContext,
          structure: {
            zones: { resistance: { volumeShare } },
            liquidityTails: { activeCount },
          },
          relative: {
            ...(unrelatedContext.relative as Record<string, unknown>),
            targetVsBtc: { betaToBtc20 },
          },
          mtf: { summary: { mtfAlignment } },
        },
      },
    } as unknown as AiPayload,
    analysis: { direction, quality },
  });

const longBoundary: GateInput = { volumeShare: 0.075, activeCount: 4 };
const shortBoundary: GateInput = {
  direction: "SHORT",
  betaToBtc20: 2,
  mtfAlignment: "aligned_bear",
};
const expectRejected = (input: GateInput) => {
  const result = evaluate(input);
  expect(result).toEqual(
    expect.objectContaining({
      direction: null,
      approved: false,
      gateDecision: "rejected",
      takeProfitPrice: null,
      stopLossPrice: null,
    }),
  );
  expect(result?.quality).toBeLessThanOrEqual(3);
};

describe("AdaptiveMomentumRibbon local AI gate", () => {
  it.each([longBoundary, shortBoundary])(
    "approves each inclusive boundary without inputs from the other side: %p",
    (input) => {
      expect(evaluate(input)).toEqual(
        expect.objectContaining({
          direction: input.direction ?? "LONG",
          quality: 4,
          approved: true,
          gateDecision: "approved",
          needRetest: false,
          retestPrice: null,
          takeProfitPrice: 110,
          stopLossPrice: 95,
        }),
      );
    },
  );

  it.each([
    { ...longBoundary, volumeShare: 0.075 - Number.EPSILON },
    { ...longBoundary, activeCount: 4 + Number.EPSILON * 4 },
    { ...shortBoundary, betaToBtc20: 2 - Number.EPSILON },
    { ...longBoundary, direction: "SHORT" as const },
    { ...shortBoundary, direction: "LONG" as const },
    {},
  ])("rejects outside the selected pocket: %p", expectRejected);

  describe.each([
    ["volumeShare", longBoundary],
    ["activeCount", longBoundary],
    ["betaToBtc20", shortBoundary],
  ] as const)("numeric type of %s", (field, boundary) => {
    it.each([
      undefined,
      null,
      "4",
      "",
      true,
      false,
      NaN,
      Infinity,
      -Infinity,
      [4],
      { value: 4 },
    ])("rejects missing or non-finite numeric input: %p", (value) => {
      expectRejected({ ...boundary, [field]: value });
    });
  });

  it.each([undefined, null, "", "aligned_bull", "ALIGNED_BEAR", 1, true, []])(
    "rejects nonmatching SHORT category: %p",
    (mtfAlignment) => expectRejected({ ...shortBoundary, mtfAlignment }),
  );

  it("matches the feature collector's whitespace normalization", () => {
    expect(
      evaluate({ ...shortBoundary, mtfAlignment: "  aligned_bear  " }),
    ).toEqual(expect.objectContaining({ approved: true }));
  });

  it.each([-1, 0, 3.5])(
    "keeps the frozen count comparison without adding an integer/domain veto: %p",
    (activeCount) => {
      expect(evaluate({ ...longBoundary, activeCount })).toEqual(
        expect.objectContaining({ approved: true }),
      );
    },
  );

  it.each([longBoundary, shortBoundary])(
    "replaces prior analysis even when its quality is low: %p",
    (input) => {
      expect(evaluate({ ...input, quality: 1 })).toEqual(
        expect.objectContaining({ approved: true, quality: 4 }),
      );
    },
  );

  it.each([longBoundary, shortBoundary])(
    "does not depend on current basket, old gate or outcome fields: %p",
    (input) => {
      for (const unchanged of [0, 10, 100]) {
        expect(
          evaluate({
            ...input,
            unrelatedContext: {
              relative: { marketBreadths: { top100: { unchanged } } },
              participation: {
                volumeStructure: { pointOfControlVolumeShare: unchanged },
              },
              engineMetadata: { approved: false },
              amrConfigSnapshot: { confirmationWindowBars: unchanged },
              profit: -99999,
              timestamp: 0,
            },
          }),
        ).toEqual(expect.objectContaining({ approved: true }));
      }
    },
  );

  it("does not let the old gate rescue a rejected selected setup", () => {
    expectRejected({
      unrelatedContext: {
        relative: { marketBreadths: { top100: { unchanged: 10 } } },
        participation: {
          volumeStructure: { pointOfControlVolumeShare: 0.166 },
        },
      },
    });
  });
});
