import semver from "semver";
import { computeBucket, isInRollout, resolveBucketingKey } from "./bucketing";
import type { EvaluationContext, TargetingRule } from "./types";

export function matchRule(rule: TargetingRule, context: EvaluationContext, flagKey: string): boolean {
  switch (rule.type) {
    case "attributeEquals":
      return context.attributes?.[rule.attribute] === rule.value;

    case "attributeIn": {
      const value = context.attributes?.[rule.attribute];
      return typeof value === "string" || typeof value === "number"
        ? rule.values.includes(value)
        : false;
    }

    case "percentageRollout": {
      const bucketingKey = resolveBucketingKey(context);
      if (bucketingKey === undefined) return false;
      const bucket = computeBucket(bucketingKey, flagKey, rule.bucketingSeed);
      return isInRollout(bucket, rule.percentage);
    }

    case "semverRange": {
      const value = context.attributes?.[rule.attribute];
      return typeof value === "string" ? semver.satisfies(value, rule.range) : false;
    }

    case "dateRange": {
      const now = Date.now();
      if (rule.startAt && now < Date.parse(rule.startAt)) return false;
      if (rule.endAt && now > Date.parse(rule.endAt)) return false;
      return true;
    }

    case "and":
      return rule.rules.every((r) => matchRule(r, context, flagKey));

    case "or":
      return rule.rules.some((r) => matchRule(r, context, flagKey));
  }
}

export interface RuleEvaluationResult {
  matched: boolean;
  rule?: TargetingRule;
}

/** First-match-wins over the rule list (PLAN.md §6). */
export function evaluateRules(
  rules: TargetingRule[],
  context: EvaluationContext,
  flagKey: string,
): RuleEvaluationResult {
  for (const rule of rules) {
    if (matchRule(rule, context, flagKey)) {
      return { matched: true, rule };
    }
  }
  return { matched: false };
}
