import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.ts";

/**
 * Category rules: regex on app name, window title, and/or URL.
 * First matching rule wins; no match → "uncategorized".
 *
 * Rules live in categories.json next to the database and are applied at
 * READ time (in reports), not at write time. Raw intervals stay untouched,
 * so editing a rule re-categorizes your entire history for free.
 */
export interface Rule {
  category: string;
  /** Case-insensitive regex tested against the app name. */
  app?: string;
  /** Case-insensitive regex tested against the window title. */
  title?: string;
  /** Case-insensitive regex tested against the URL (browsers only). */
  url?: string;
}

export const UNCATEGORIZED = "uncategorized";

const DEFAULT_RULES: Rule[] = [
  // Job hunt beats everything — seeing this number daily is the point.
  { category: "job-hunt", url: "linkedin\\.com|indeed\\.|glassdoor|otta\\.com|welcometothejungle" },
  { category: "job-hunt", title: "vacature|sollicitatie|cover letter|\\bcv\\b|resume" },

  { category: "dev", app: "^(Code|Cursor|iTerm2?|Terminal|WezTerm|Ghostty)$" },
  { category: "dev", url: "github\\.com|stackoverflow\\.com|localhost|developer\\.mozilla" },

  { category: "design", app: "^(Figma|Photoshop|Adobe)" },

  { category: "learning", app: "^Anki$" },
  { category: "learning", url: "claude\\.ai|chatgpt\\.com|udemy|coursera|exercism|typingclub|keybr\\.com|monkeytype" },
  { category: "learning", title: "langua|fluently|duolingo|nederlands|dutch" },

  { category: "communication", app: "^(Slack|Discord|Mail|Telegram|WhatsApp|Signal|Messages)$" },
  { category: "communication", url: "mail\\.google\\.com|outlook\\." },

  { category: "distraction", url: "youtube\\.com/(?!.*(tutorial|course))|twitter\\.com|x\\.com/|reddit\\.com|instagram\\.com|netflix|twitch\\.tv" },
  { category: "distraction", app: "^(TV|Music|Spotify)$" },
];

export function rulesPath(): string {
  return join(dirname(config.dbPath), "categories.json");
}

/** Load rules from categories.json, creating it with defaults on first run. */
export function loadRules(): Rule[] {
  const path = rulesPath();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(DEFAULT_RULES, null, 2) + "\n");
    return DEFAULT_RULES;
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${path}: expected a JSON array of rules`);
  }
  return parsed as Rule[];
}

export type Categorizer = (app: string, title: string, url: string | null) => string;

/** Compile rules once; returns a matcher. First match wins. */
export function makeCategorizer(rules: Rule[]): Categorizer {
  const compiled = rules.map((rule, i) => {
    try {
      return {
        category: rule.category,
        app: rule.app ? new RegExp(rule.app, "i") : null,
        title: rule.title ? new RegExp(rule.title, "i") : null,
        url: rule.url ? new RegExp(rule.url, "i") : null,
      };
    } catch (err) {
      throw new Error(`categories.json rule #${i + 1} (${rule.category}): bad regex — ${String(err)}`);
    }
  });

  return (app, title, url) => {
    for (const r of compiled) {
      if (r.app && !r.app.test(app)) continue;
      if (r.title && !r.title.test(title)) continue;
      if (r.url && !(url !== null && r.url.test(url))) continue;
      if (!r.app && !r.title && !r.url) continue; // empty rule matches nothing
      return r.category;
    }
    return UNCATEGORIZED;
  };
}
