import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiPost } from "./main";

interface PickEntryProps {
  teams: string[];
  currentTeam: string;
  onPickMade: () => void;
}

interface PlayerMatch {
  name: string;
  team: string;
  position: string;
  z_score: number;
  drafted: boolean;
}

export function PickEntry({ teams, currentTeam, onPickMade }: PickEntryProps) {
  var [query, setQuery] = useState("");
  var [results, setResults] = useState<PlayerMatch[]>([]);
  var [showDropdown, setShowDropdown] = useState(false);
  var [selectedIdx, setSelectedIdx] = useState(0);
  var [teamOverride, setTeamOverride] = useState("");
  var [submitting, setSubmitting] = useState(false);
  var [error, setError] = useState("");
  var inputRef = useRef<HTMLInputElement>(null);
  var debounceRef = useRef<any>(null);

  var search = useCallback(async function (q: string) {
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    try {
      var data: any = await apiFetch("/players?q=" + encodeURIComponent(q) + "&limit=10");
      setResults(data.players || []);
      setShowDropdown(true);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    }
  }, []);

  var handleInputChange = useCallback(function (e: React.ChangeEvent<HTMLInputElement>) {
    var val = e.target.value;
    setQuery(val);
    setError("");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function () { search(val); }, 150);
  }, [search]);

  var submitPick = useCallback(async function (playerName: string) {
    if (!playerName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      var body: any = { player_name: playerName };
      if (teamOverride) body.team_name = teamOverride;
      var result: any = await apiPost("/pick", body);
      if (result.error) {
        setError(result.error);
      } else {
        setQuery("");
        setResults([]);
        setShowDropdown(false);
        setTeamOverride("");
        onPickMade();
      }
    } catch (e: any) {
      setError(e.message || "Failed to record pick");
    } finally {
      setSubmitting(false);
    }
  }, [teamOverride, onPickMade]);

  var handleKeyDown = useCallback(function (e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(function (prev) { return Math.min(prev + 1, results.length - 1); });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(function (prev) { return Math.max(prev - 1, 0); });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && showDropdown) {
        var player = results[selectedIdx];
        if (player && !player.drafted) {
          submitPick(player.name);
        }
      } else if (query.trim()) {
        submitPick(query.trim());
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }, [results, selectedIdx, showDropdown, query, submitPick]);

  // Close dropdown on outside click
  useEffect(function () {
    var handler = function (e: MouseEvent) {
      var target = e.target as HTMLElement;
      if (!target.closest(".pick-entry-wrapper")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return function () { document.removeEventListener("mousedown", handler); };
  }, []);

  return (
    <div className="pick-entry-wrapper flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[280px]">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={function () { if (results.length > 0) setShowDropdown(true); }}
          placeholder="Search player name to log a pick..."
          disabled={submitting}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoComplete="off"
        />

        {/* Autocomplete dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded border border-border bg-card shadow-lg max-h-80 overflow-y-auto">
            {results.map(function (p, idx) {
              return (
                <button
                  key={p.name + idx}
                  onClick={function () {
                    if (!p.drafted) submitPick(p.name);
                  }}
                  onMouseEnter={function () { setSelectedIdx(idx); }}
                  disabled={p.drafted}
                  className={
                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors "
                    + (p.drafted ? "opacity-40 cursor-not-allowed " : "cursor-pointer ")
                    + (idx === selectedIdx ? "bg-muted " : "hover:bg-muted/50 ")
                  }
                >
                  <span className="font-medium flex-1">
                    {p.name}
                    {p.drafted && <span className="ml-2 text-xs text-muted-foreground">(drafted)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.team}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{p.position}</span>
                  <span className={"text-xs font-mono w-10 text-right " + (p.z_score > 0 ? "text-green-500" : "text-muted-foreground")}>
                    {p.z_score != null ? p.z_score.toFixed(1) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Team override */}
      <select
        value={teamOverride}
        onChange={function (e) { setTeamOverride(e.target.value); }}
        className="rounded border border-border bg-background px-2 py-2 text-sm min-w-[120px]"
      >
        <option value="">On clock: {currentTeam}</option>
        {teams.map(function (t) {
          return <option key={t} value={t}>{t}</option>;
        })}
      </select>

      {/* Manual submit */}
      <button
        onClick={function () { if (query.trim()) submitPick(query.trim()); }}
        disabled={submitting || !query.trim()}
        className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "..." : "Pick"}
      </button>

      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
