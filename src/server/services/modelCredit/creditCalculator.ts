import type { ChatStreamPayload } from '@lobechat/types';
import type { Pricing, PricingUnit } from 'model-bank';

import type { ModelUsage } from '@/types/message';

const DEFAULT_TEXT_CREDITS = 1;
const DEFAULT_IMAGE_CREDITS = 5;
const DEFAULT_THREED_CREDITS = 10;
const TOKENS_PER_CHARACTER = 4;

type UnitQuantityMap = Record<string, number>;

const resolveUnitDivisor = (unit: string | undefined) => {
  switch (unit) {
    case 'millionTokens': {
      return 1_000_000;
    }
    case 'thousandTokens': {
      return 1000;
    }
    case 'token':
    case 'image':
    case 'request':
    case 'item':
    case undefined: {
      return 1;
    }
    default: {
      return 1;
    }
  }
};

const resolveUnitRate = (unit: PricingUnit): number | undefined => {
  if (unit.strategy === 'fixed') return unit.rate;

  if (unit.strategy === 'tiered') {
    const firstTier = unit.tiers?.[0];
    return firstTier?.rate;
  }

  // Lookup strategies require runtime params, skip them for now.
  return undefined;
};

const computeCreditsWithUnits = (pricing: Pricing | undefined, quantities: UnitQuantityMap) => {
  if (!pricing?.units) return 0;

  let credits = 0;

  for (const unit of pricing.units) {
    const quantity = quantities[unit.name];
    if (!quantity || quantity <= 0) continue;

    const rate = resolveUnitRate(unit);
    if (typeof rate !== 'number') continue;

    const divisor = resolveUnitDivisor(unit.unit);
    credits += (quantity / divisor) * rate;
  }

  return Math.ceil(credits);
};

const estimateTokensFromMessages = (payload: ChatStreamPayload): number => {
  const baseOverhead = payload.messages.length * 4;

  const characters = payload.messages.reduce((sum, message) => {
    if (typeof message.content === 'string') return sum + message.content.length;

    if (Array.isArray(message.content)) {
      return (
        sum +
        message.content.reduce((inner, part) => {
          if (part.type === 'text') return inner + part.text.length;
          return inner;
        }, 0)
      );
    }

    return sum;
  }, 0);

  return Math.ceil(characters / TOKENS_PER_CHARACTER) + baseOverhead;
};

export const estimateTextCredits = (payload: ChatStreamPayload, pricing?: Pricing) => {
  const inputTokens = estimateTokensFromMessages(payload);
  const outputTokens = payload.max_tokens ?? 1024;

  const credits = computeCreditsWithUnits(pricing, {
    textInput: inputTokens,
    textOutput: outputTokens,
  });

  return credits > 0 ? credits : DEFAULT_TEXT_CREDITS;
};

export const calculateTextCreditsFromUsage = (usage: Partial<ModelUsage>, pricing?: Pricing) => {
  const inputCachedTokens = usage.inputCachedTokens ?? 0;
  const inputWriteCacheTokens = usage.inputWriteCacheTokens ?? 0;
  const inputCacheMissTokens =
    usage.inputCacheMissTokens ??
    Math.max(0, (usage.totalInputTokens ?? usage.inputTextTokens ?? 0) - inputCachedTokens);

  const outputTokens =
    usage.totalOutputTokens ??
    usage.outputTextTokens ??
    (usage.totalTokens ? Math.max(0, usage.totalTokens - (usage.totalInputTokens ?? 0)) : 0);

  const credits = computeCreditsWithUnits(pricing, {
    textInput: inputCacheMissTokens,
    textInput_cacheRead: inputCachedTokens,
    textInput_cacheWrite: inputWriteCacheTokens,
    textOutput: outputTokens,
  });

  return credits > 0 ? credits : DEFAULT_TEXT_CREDITS;
};

export const calculateImageCredits = (count: number, pricing?: Pricing) => {
  const credits = computeCreditsWithUnits(pricing, {
    imageGeneration: count,
    imageOutput: count,
    request: count,
  });

  return credits > 0 ? credits : Math.max(count, 1) * DEFAULT_IMAGE_CREDITS;
};

export const calculateThreeDCredits = (count: number, pricing?: Pricing) => {
  const credits = computeCreditsWithUnits(pricing, {
    request: count,
    threeDGeneration: count,
  });

  return credits > 0 ? credits : Math.max(count, 1) * DEFAULT_THREED_CREDITS;
};
