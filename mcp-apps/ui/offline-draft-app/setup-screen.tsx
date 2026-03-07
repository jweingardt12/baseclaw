import React, { useCallback, useEffect, useState } from "react";
import { apiPost, apiFetch } from "./main";

interface SetupScreenProps {
  onStarted: () => void;
}

var DEFAULT_TEAMS = [
  "Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6",
  "Team 7", "Team 8", "Team 9", "Team 10", "Team 11", "Team 12",
];

export function SetupScreen({ onStarted }: SetupScreenProps) {
  var [numTeams, setNumTeams] = useState(12);
  var [numRounds, setNumRounds] = useState(23);
  var [teams, setTeams] = useState<string[]>(DEFAULT_TEAMS);
  var [myTeam, setMyTeam] = useState("");
  var [snake, setSnake] = useState(true);
  var [sheetId, setSheetId] = useState("");
  var [sheetRange, setSheetRange] = useState("Sheet1");
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");
  var [autoDetected, setAutoDetected] = useState(false);

  // Try to auto-detect league settings from Yahoo
  useEffect(() => {
    (async () => {
      try {
        var res = await fetch("/api/league-context");
        if (!res.ok) return;
        var ctx = await res.json();
        if (ctx.num_teams && ctx.num_teams > 0) {
          setNumTeams(ctx.num_teams);
          setAutoDetected(true);
        }
      } catch {
        // Yahoo not connected — that's fine
      }

      // Try to get team names
      try {
        var res2 = await fetch("/api/info");
        if (!res2.ok) return;
        var info = await res2.json();
        if (info.teams && Array.isArray(info.teams) && info.teams.length > 0) {
          var names = info.teams.map(function (t: any) { return t.name || t; });
          setTeams(names);
          setNumTeams(names.length);
        }
      } catch {
        // Not available
      }
    })();
  }, []);

  // Adjust team list when numTeams changes
  useEffect(() => {
    setTeams(function (prev) {
      if (prev.length === numTeams) return prev;
      if (prev.length < numTeams) {
        var extended = [...prev];
        for (var i = prev.length; i < numTeams; i++) {
          extended.push("Team " + (i + 1));
        }
        return extended;
      }
      return prev.slice(0, numTeams);
    });
  }, [numTeams]);

  var handleTeamNameChange = useCallback(function (idx: number, name: string) {
    setTeams(function (prev) {
      var next = [...prev];
      next[idx] = name;
      return next;
    });
  }, []);

  var parseSheetId = function (input: string): string {
    // Accept full Google Sheets URLs or just the ID
    var match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return input.trim();
  };

  var handleStart = async function () {
    if (!myTeam) {
      setError("Select your team");
      return;
    }
    setLoading(true);
    setError("");
    try {
      var result: any = await apiPost("/start", {
        teams: teams,
        num_rounds: numRounds,
        my_team: myTeam,
        snake: snake,
        sheet_id: sheetId ? parseSheetId(sheetId) : null,
        sheet_range: sheetRange || "Sheet1",
      });
      if (result.error) {
        setError(result.error);
      } else {
        onStarted();
      }
    } catch (e: any) {
      setError(e.message || "Failed to start draft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Offline Draft</h1>
          <p className="text-muted-foreground">
            Set up your offline draft board. Player data powered by FanGraphs projections.
          </p>
          {autoDetected && (
            <p className="text-sm text-green-500 mt-1">League settings auto-detected from Yahoo</p>
          )}
        </div>

        <div className="space-y-6 bg-card border border-border rounded-lg p-6">
          {/* Draft format */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Teams</label>
              <input
                type="number"
                min={4}
                max={20}
                value={numTeams}
                onChange={function (e) { setNumTeams(Number(e.target.value)); }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rounds</label>
              <input
                type="number"
                min={1}
                max={40}
                value={numRounds}
                onChange={function (e) { setNumRounds(Number(e.target.value)); }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="snake"
              checked={snake}
              onChange={function (e) { setSnake(e.target.checked); }}
              className="rounded"
            />
            <label htmlFor="snake" className="text-sm">Snake draft (order reverses each round)</label>
          </div>

          {/* Team names */}
          <div>
            <label className="block text-sm font-medium mb-2">Team Names</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {teams.map(function (name, idx) {
                return (
                  <input
                    key={idx}
                    value={name}
                    onChange={function (e) { handleTeamNameChange(idx, e.target.value); }}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                );
              })}
            </div>
          </div>

          {/* Your team */}
          <div>
            <label className="block text-sm font-medium mb-1">Your Team</label>
            <select
              value={myTeam}
              onChange={function (e) { setMyTeam(e.target.value); }}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select your team...</option>
              {teams.map(function (name) {
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          {/* Google Sheet */}
          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium mb-1">
              Google Sheet (optional)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Paste the Sheet URL or ID. Picks will auto-sync from the sheet via <code>gws</code> CLI.
              Expected format: one row per pick with columns for Round, Pick, Team, Player.
            </p>
            <input
              value={sheetId}
              onChange={function (e) { setSheetId(e.target.value); }}
              placeholder="https://docs.google.com/spreadsheets/d/... or sheet ID"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm mb-2"
            />
            <input
              value={sheetRange}
              onChange={function (e) { setSheetRange(e.target.value); }}
              placeholder="Sheet tab name (default: Sheet1)"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded p-2">{error}</div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3 rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
