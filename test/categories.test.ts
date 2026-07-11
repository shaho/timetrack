import { describe, expect, test } from "bun:test";
import { makeCategorizer, UNCATEGORIZED, type Rule } from "../src/categories.ts";

const rules: Rule[] = [
  { category: "job-hunt", url: "linkedin\\.com|indeed\\." },
  { category: "dev", app: "^(Code|iTerm2?)$" },
  { category: "dev", url: "github\\.com|localhost" },
  { category: "distraction", url: "youtube\\.com|reddit\\.com" },
  { category: "learning", title: "dutch|nederlands" },
];

const cat = makeCategorizer(rules);

describe("categorizer", () => {
  test("matches by app name", () => {
    expect(cat("Code", "tracker.ts — timetrack", null)).toBe("dev");
    expect(cat("iTerm2", "zsh", null)).toBe("dev");
  });

  test("matches by URL", () => {
    expect(cat("Chrome", "Pull requests", "https://github.com/x/y")).toBe("dev");
    expect(cat("Chrome", "Feed", "https://www.linkedin.com/feed/")).toBe("job-hunt");
  });

  test("first match wins (linkedin beats generic browser rules)", () => {
    // linkedin rule is before distraction; a linkedin URL never counts as distraction
    expect(cat("Chrome", "LinkedIn", "https://linkedin.com/jobs")).toBe("job-hunt");
  });

  test("url rule cannot match when url is null", () => {
    expect(cat("Chrome", "New Tab", null)).toBe(UNCATEGORIZED);
  });

  test("matches by title, case-insensitive", () => {
    expect(cat("Safari", "Learn DUTCH fast", null)).toBe("learning");
  });

  test("no match falls back to uncategorized", () => {
    expect(cat("Finder", "Downloads", null)).toBe(UNCATEGORIZED);
  });

  test("rule with multiple fields requires all to match", () => {
    const strict = makeCategorizer([{ category: "x", app: "^Chrome$", title: "docs" }]);
    expect(strict("Chrome", "docs — spec", null)).toBe("x");
    expect(strict("Chrome", "news", null)).toBe(UNCATEGORIZED);
    expect(strict("Safari", "docs", null)).toBe(UNCATEGORIZED);
  });

  test("empty rule matches nothing", () => {
    const empty = makeCategorizer([{ category: "x" }]);
    expect(empty("Code", "anything", null)).toBe(UNCATEGORIZED);
  });

  test("bad regex fails loudly with rule number", () => {
    expect(() => makeCategorizer([{ category: "x", app: "(" }])).toThrow(/rule #1/);
  });
});
