/**
 * End-to-end data pipeline verification.
 *
 * Tests that Python API responses match the shape the TS tool code expects,
 * using real fixtures captured from a live server. Each test group covers
 * a different external data source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

var FIXTURES = join(__dirname, "fixtures");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf-8"));
}

// ── 1. Yahoo Fantasy API ──────────────────────────────────────────

describe("Yahoo Fantasy API fixtures", function () {
  it("roster has players array with expected fields", function () {
    var d = loadFixture("roster.json");
    expect(d.players).toBeDefined();
    expect(Array.isArray(d.players)).toBe(true);
    expect(d.players.length).toBeGreaterThan(0);

    var p = d.players[0];
    expect(p.name).toBeDefined();
    expect(p.eligible_positions).toBeDefined();
    expect(p.player_id).toBeDefined();
  });

  it("standings has teams array with names and ranks", function () {
    var d = loadFixture("standings.json");
    expect(d.standings).toBeDefined();
    expect(Array.isArray(d.standings)).toBe(true);
    expect(d.standings.length).toBeGreaterThan(0);

    var t = d.standings[0];
    expect(t.name).toBeDefined();
    expect(t.rank).toBeDefined();
  });
});

// ── 2. Baseball Savant (Statcast) ──────────────────────────────────

describe("Baseball Savant fixtures", function () {
  it("player report has nested statcast structure (Bug 2 fix)", function () {
    var d = loadFixture("player-report-batter.json");
    expect(d.name).toBeDefined();
    expect(d.statcast).toBeDefined();

    var sc = d.statcast;
    // Must have nested structure, not flat
    expect(sc.expected).toBeDefined();
    expect(sc.expected.xwoba).toBeDefined();
    expect(sc.expected.xwoba_tier).toBeDefined();

    expect(sc.batted_ball).toBeDefined();
    expect(sc.batted_ball.avg_exit_velo).toBeDefined();

    expect(sc.speed).toBeDefined();

    // data_season should be present (preseason uses prior year)
    expect(sc.data_season).toBeDefined();
  });

  it("player report trends has status field (Bug 2 fix)", function () {
    var d = loadFixture("player-report-batter.json");
    expect(d.trends).toBeDefined();
    // Must have 'status' not just 'hot_cold'
    expect(d.trends.status).toBeDefined();
  });

  it("breakout candidates have expected fields", function () {
    var d = loadFixture("breakouts.json");
    expect(d.candidates).toBeDefined();
    expect(Array.isArray(d.candidates)).toBe(true);

    if (d.candidates.length > 0) {
      var c = d.candidates[0];
      expect(c.name).toBeDefined();
      expect(typeof c.diff).toBe("number");
    }
  });
});

// ── 3. FanGraphs / Projections ─────────────────────────────────────

describe("FanGraphs projection fixtures", function () {
  it("rankings has players with z-scores", function () {
    var d = loadFixture("rankings.json");
    expect(d.players).toBeDefined();
    expect(d.players.length).toBeGreaterThan(0);

    var p = d.players[0];
    expect(p.name).toBeDefined();
    expect(p.z_score).toBeDefined();
    expect(typeof p.z_score).toBe("number");
    expect(p.rank).toBeDefined();
  });

  it("accent-insensitive value lookup resolves (Bug 1 fix)", function () {
    var d = loadFixture("value-garcia.json");
    expect(d.players).toBeDefined();
    expect(d.players.length).toBeGreaterThan(0);

    // "Adolis Garcia" should match "Adolis García"
    var p = d.players[0];
    expect(p.name).toContain("García");
  });
});

// ── 4. MLB Stats API ───────────────────────────────────────────────

describe("MLB Stats API fixtures", function () {
  it("teams has 30 MLB teams", function () {
    var d = loadFixture("mlb-teams.json");
    expect(d.teams).toBeDefined();
    expect(d.teams.length).toBe(30);

    var t = d.teams[0];
    expect(t.name).toBeDefined();
    expect(t.abbreviation).toBeDefined();
  });

  it("injuries has injuries array", function () {
    var d = loadFixture("mlb-injuries.json");
    expect(d.injuries).toBeDefined();
    expect(Array.isArray(d.injuries)).toBe(true);
    // May be empty preseason — just verify structure
  });
});

// ── 5. Reddit ──────────────────────────────────────────────────────

describe("Reddit fixtures", function () {
  it("reddit buzz has posts array", function () {
    var d = loadFixture("reddit-buzz.json");
    expect(d.posts).toBeDefined();
    expect(Array.isArray(d.posts)).toBe(true);
    expect(d.posts.length).toBeGreaterThan(0);

    var p = d.posts[0];
    expect(p.title).toBeDefined();
    expect(typeof p.score).toBe("number");
  });
});

// ── 6. News Feeds ──────────────────────────────────────────────────

describe("News feed fixtures", function () {
  it("news feed has entries array", function () {
    var d = loadFixture("news-feed.json");
    expect(d.entries).toBeDefined();
    expect(Array.isArray(d.entries)).toBe(true);
    expect(d.entries.length).toBeGreaterThan(0);

    var e = d.entries[0];
    expect(e.headline || e.title || e.raw_title).toBeDefined();
    expect(e.source).toBeDefined();
  });

  it("news sources lists available sources", function () {
    var d = loadFixture("news-sources.json");
    expect(d.sources).toBeDefined();
    expect(Array.isArray(d.sources)).toBe(true);
    expect(d.sources.length).toBeGreaterThan(0);

    var s = d.sources[0];
    expect(s.id).toBeDefined();
    expect(s.name).toBeDefined();
  });
});

// ── 7. Preseason Fallbacks (Bugs 3 & 4) ───────────────────────────

describe("Preseason fallback fixtures", function () {
  it("category simulate uses z-score projections preseason (Bug 3)", function () {
    var d = loadFixture("category-simulate.json");
    // Should have z_score_impact from projection fallback
    if (d.source === "projections") {
      expect(d.z_score_impact).toBeDefined();
      expect(d.z_score_impact.category_impact).toBeDefined();
    } else {
      // In-season mode — should have current/simulated ranks
      expect(d.current_ranks).toBeDefined();
      expect(d.simulated_ranks).toBeDefined();
    }
  });

  it("punt advisor uses projection fallback preseason (Bug 4)", function () {
    var d = loadFixture("punt-advisor.json");
    // Should NOT have error
    expect(d.error).toBeUndefined();
    // Should have categories from projections
    expect(d.categories).toBeDefined();
    expect(d.categories.length).toBeGreaterThan(0);
    expect(d.source).toBe("projections");
  });
});

// ── 8. Closer Monitor (Bug 5) ─────────────────────────────────────

describe("Closer monitor fixture (Bug 5)", function () {
  it("my closers have ownership=my_team without percent_owned", function () {
    var d = loadFixture("closer-monitor.json");
    expect(d.my_closers).toBeDefined();

    for (var closer of d.my_closers) {
      expect(closer.ownership).toBe("my_team");
      expect(closer).not.toHaveProperty("percent_owned");
      expect(closer.name).toBeDefined();
    }
  });
});

// ── 9. Workflow Tools ──────────────────────────────────────────────

describe("Workflow fixtures", function () {
  it("morning briefing has expected sections", function () {
    var d = loadFixture("morning-briefing.json");
    // Should have multiple sections from combined API calls
    expect(d.roster || d.lineup || d.injuries || d.matchup || d.summary).toBeDefined();
  });
});
