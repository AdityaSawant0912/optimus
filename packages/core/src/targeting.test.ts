import { describe, expect, it } from "vitest";
import { evaluateRules, matchRule } from "./targeting";
import type { EvaluationContext, TargetingRule } from "./types";

const flagKey = "flag-a";

describe("matchRule", () => {
  it("attributeEquals", () => {
    const rule: TargetingRule = { type: "attributeEquals", attribute: "plan", value: "pro" };
    expect(matchRule(rule, { attributes: { plan: "pro" } }, flagKey)).toBe(true);
    expect(matchRule(rule, { attributes: { plan: "free" } }, flagKey)).toBe(false);
    expect(matchRule(rule, {}, flagKey)).toBe(false);
  });

  it("attributeIn", () => {
    const rule: TargetingRule = { type: "attributeIn", attribute: "region", values: ["us", "eu"] };
    expect(matchRule(rule, { attributes: { region: "us" } }, flagKey)).toBe(true);
    expect(matchRule(rule, { attributes: { region: "apac" } }, flagKey)).toBe(false);
  });

  it("percentageRollout delegates to bucketing and requires a resolvable key", () => {
    const rule: TargetingRule = { type: "percentageRollout", percentage: 100 };
    expect(matchRule(rule, { userId: "u1" }, flagKey)).toBe(true);
    expect(matchRule({ ...rule, percentage: 0 }, { userId: "u1" }, flagKey)).toBe(false);
    expect(matchRule(rule, {}, flagKey)).toBe(false);
  });

  it("semverRange", () => {
    const rule: TargetingRule = { type: "semverRange", attribute: "appVersion", range: ">=1.2.0 <2.0.0" };
    expect(matchRule(rule, { attributes: { appVersion: "1.5.0" } }, flagKey)).toBe(true);
    expect(matchRule(rule, { attributes: { appVersion: "2.0.0" } }, flagKey)).toBe(false);
    expect(matchRule(rule, { attributes: { appVersion: "1.0.0" } }, flagKey)).toBe(false);
  });

  it("dateRange", () => {
    const rule: TargetingRule = { type: "dateRange", startAt: "2020-01-01", endAt: "2099-01-01" };
    expect(matchRule(rule, {}, flagKey)).toBe(true);
    expect(matchRule({ type: "dateRange", startAt: "2099-01-01" }, {}, flagKey)).toBe(false);
    expect(matchRule({ type: "dateRange", endAt: "2020-01-01" }, {}, flagKey)).toBe(false);
  });

  it("and composes rules with all-must-match", () => {
    const rule: TargetingRule = {
      type: "and",
      rules: [
        { type: "attributeEquals", attribute: "plan", value: "pro" },
        { type: "attributeEquals", attribute: "region", value: "us" },
      ],
    };
    expect(matchRule(rule, { attributes: { plan: "pro", region: "us" } }, flagKey)).toBe(true);
    expect(matchRule(rule, { attributes: { plan: "pro", region: "eu" } }, flagKey)).toBe(false);
  });

  it("or composes rules with any-must-match", () => {
    const rule: TargetingRule = {
      type: "or",
      rules: [
        { type: "attributeEquals", attribute: "plan", value: "pro" },
        { type: "attributeEquals", attribute: "plan", value: "enterprise" },
      ],
    };
    expect(matchRule(rule, { attributes: { plan: "enterprise" } }, flagKey)).toBe(true);
    expect(matchRule(rule, { attributes: { plan: "free" } }, flagKey)).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("returns the first matching rule (first-match-wins)", () => {
    const rules: TargetingRule[] = [
      { type: "attributeEquals", attribute: "plan", value: "enterprise" },
      { type: "attributeEquals", attribute: "plan", value: "pro" },
    ];
    const context: EvaluationContext = { attributes: { plan: "pro" } };
    const result = evaluateRules(rules, context, flagKey);
    expect(result.matched).toBe(true);
    expect(result.rule).toEqual(rules[1]);
  });

  it("returns matched: false when nothing matches", () => {
    const rules: TargetingRule[] = [{ type: "attributeEquals", attribute: "plan", value: "pro" }];
    const result = evaluateRules(rules, { attributes: { plan: "free" } }, flagKey);
    expect(result).toEqual({ matched: false });
  });
});
