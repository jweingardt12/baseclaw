#!/usr/bin/env python3
"""Backtest Replay Engine — measure decision quality against historical snapshots."""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")


class BacktestResult:
    """Results from backtesting a single week."""

    def __init__(self, year, week):
        self.year = year
        self.week = week
        self.lineup_efficiency = None  # 0-1 ratio of actual vs optimal value
        self.roster_value = None
        self.optimal_value = None
        self.players_started = 0
        self.players_benched_with_value = 0
        self.errors = []

    def to_dict(self):
        return {
            "year": self.year,
            "week": self.week,
            "lineup_efficiency": round(self.lineup_efficiency, 3) if self.lineup_efficiency is not None else None,
            "roster_value": round(self.roster_value, 2) if self.roster_value is not None else None,
            "optimal_value": round(self.optimal_value, 2) if self.optimal_value is not None else None,
            "players_started": self.players_started,
            "players_benched_with_value": self.players_benched_with_value,
            "errors": self.errors,
        }


def _load_snapshot(snapshot_dir):
    """Load snapshot data from a directory."""
    result = {}

    # Load metadata
    meta_path = os.path.join(snapshot_dir, "metadata.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as fh:
                result["metadata"] = json.load(fh)
        except Exception as e:
            result["metadata"] = {"error": str(e)}
    else:
        return None  # No valid snapshot

    # Load roster
    roster_path = os.path.join(snapshot_dir, "roster.json")
    if os.path.exists(roster_path):
        try:
            with open(roster_path, "r") as fh:
                result["roster"] = json.load(fh)
        except Exception as e:
            result["roster"] = []

    # Load projections
    for proj_file in ("projections_hitters.csv", "projections_pitchers.csv"):
        proj_path = os.path.join(snapshot_dir, proj_file)
        if os.path.exists(proj_path):
            try:
                with open(proj_path, "r") as fh:
                    reader = csv.DictReader(fh)
                    result[proj_file.replace(".csv", "")] = list(reader)
            except Exception as e:
                result[proj_file.replace(".csv", "")] = []

    # Load category standings
    standings_path = os.path.join(snapshot_dir, "category_standings.json")
    if os.path.exists(standings_path):
        try:
            with open(standings_path, "r") as fh:
                result["category_standings"] = json.load(fh)
        except Exception as e:
            result["category_standings"] = []

    return result


def _load_actuals(year):
    """Fetch actual batting and pitching stats for a season from pybaseball."""
    actuals = {"batting": {}, "pitching": {}}

    try:
        from pybaseball import batting_stats, pitching_stats

        # Fetch season batting stats (we'll use full season for simplicity)
        bat_df = batting_stats(year, qual=0)
        if bat_df is not None:
            for _, row in bat_df.iterrows():
                name = row.get("Name", "")
                if name:
                    actuals["batting"][name.lower()] = {
                        "hr": row.get("HR", 0),
                        "r": row.get("R", 0),
                        "rbi": row.get("RBI", 0),
                        "sb": row.get("SB", 0),
                        "avg": row.get("AVG", 0),
                        "obp": row.get("OBP", 0),
                        "h": row.get("H", 0),
                        "pa": row.get("PA", 0),
                    }

        pit_df = pitching_stats(year, qual=0)
        if pit_df is not None:
            for _, row in pit_df.iterrows():
                name = row.get("Name", "")
                if name:
                    actuals["pitching"][name.lower()] = {
                        "era": row.get("ERA", 0),
                        "whip": row.get("WHIP", 0),
                        "k": row.get("SO", 0),
                        "w": row.get("W", 0),
                        "ip": row.get("IP", 0),
                        "qs": row.get("QS", 0),
                    }
    except Exception as e:
        print("Warning: Could not fetch actuals from pybaseball: " + str(e))

    return actuals


def _compute_player_value(name, actuals):
    """Simple value metric from actual stats — HR + R + RBI + SB for batters."""
    name_lower = name.lower() if name else ""
    bat = actuals.get("batting", {}).get(name_lower)
    if bat:
        return (
            float(bat.get("hr", 0)) * 4
            + float(bat.get("r", 0))
            + float(bat.get("rbi", 0))
            + float(bat.get("sb", 0)) * 2
            + float(bat.get("h", 0)) * 0.5
        )
    pit = actuals.get("pitching", {}).get(name_lower)
    if pit:
        ip = float(pit.get("ip", 0))
        era = float(pit.get("era", 99))
        k = float(pit.get("k", 0))
        # Higher IP, lower ERA, more K = more value
        era_value = max(0, (4.50 - era) * ip / 9) if ip > 0 else 0
        return era_value + k * 0.5
    return 0


def replay_week(year, week, verbose=False, actuals=None):
    """Replay a single week's snapshot against actual results."""
    week_str = "week_" + str(week).zfill(2)
    snapshot_dir = os.path.join(SNAPSHOTS_DIR, str(year), week_str)

    result = BacktestResult(year, week)

    if not os.path.exists(snapshot_dir):
        result.errors.append("Snapshot directory not found: " + snapshot_dir)
        return result

    snapshot = _load_snapshot(snapshot_dir)
    if snapshot is None:
        result.errors.append("Invalid snapshot (no metadata)")
        return result

    roster = snapshot.get("roster", [])
    if not roster:
        result.errors.append("No roster data in snapshot")
        return result

    # Load actual stats for the year (use passed-in actuals if available)
    if actuals is None:
        actuals = _load_actuals(year)

    # Compute lineup efficiency
    # Active players = those not on BN/IL/NA/DL
    bench_positions = {"BN", "IL", "IL+", "NA", "DL"}
    active_value = 0
    bench_value = 0
    all_values = []

    for player in roster:
        name = player.get("name", "")
        pos = ""
        selected_pos = player.get("selected_position")
        if isinstance(selected_pos, dict):
            pos = selected_pos.get("position", "")
        elif isinstance(selected_pos, list) and selected_pos:
            pos = selected_pos[0].get("position", "") if isinstance(selected_pos[0], dict) else str(selected_pos[0])
        elif isinstance(selected_pos, str):
            pos = selected_pos

        value = _compute_player_value(name, actuals)
        all_values.append({"name": name, "position": pos, "value": value})

        if pos in bench_positions:
            bench_value += value
            if value > 0:
                result.players_benched_with_value += 1
        else:
            active_value += value
            result.players_started += 1

    # Optimal value = sum of top N values where N = number of active slots
    all_values.sort(key=lambda x: x.get("value", 0), reverse=True)
    n_active = result.players_started
    optimal_value = sum(v.get("value", 0) for v in all_values[:n_active])

    result.roster_value = active_value
    result.optimal_value = optimal_value
    result.lineup_efficiency = active_value / optimal_value if optimal_value > 0 else 1.0

    if verbose:
        print("Week " + str(week) + ": efficiency=" + str(round(result.lineup_efficiency, 3))
              + " actual=" + str(round(active_value, 1))
              + " optimal=" + str(round(optimal_value, 1))
              + " benched_with_value=" + str(result.players_benched_with_value))

    return result


def replay_season(year, week_range=None, verbose=False):
    """Replay a full season or range of weeks."""
    year_dir = os.path.join(SNAPSHOTS_DIR, str(year))
    if not os.path.exists(year_dir):
        print("No snapshots found for year " + str(year))
        return []

    # Find available weeks
    available_weeks = []
    for entry in sorted(os.listdir(year_dir)):
        if entry.startswith("week_"):
            try:
                wk = int(entry.replace("week_", ""))
                available_weeks.append(wk)
            except ValueError:
                pass

    if week_range:
        start_wk, end_wk = week_range
        available_weeks = [w for w in available_weeks if start_wk <= w <= end_wk]

    if not available_weeks:
        print("No snapshots found" + (" for weeks " + str(week_range) if week_range else ""))
        return []

    print("Replaying " + str(len(available_weeks)) + " weeks for " + str(year) + "...")

    # Load actuals once for the whole season
    actuals = _load_actuals(year)
    results = []
    for week in available_weeks:
        result = replay_week(year, week, verbose=verbose, actuals=actuals)
        results.append(result)

    # Summary
    valid = [r for r in results if r.lineup_efficiency is not None]
    if valid:
        avg_eff = sum(r.lineup_efficiency for r in valid) / len(valid)
        total_actual = sum(r.roster_value for r in valid if r.roster_value)
        total_optimal = sum(r.optimal_value for r in valid if r.optimal_value)
        print("")
        print("Season Summary:")
        print("  Weeks analyzed: " + str(len(valid)))
        print("  Avg lineup efficiency: " + str(round(avg_eff, 3)))
        print("  Total roster value: " + str(round(total_actual, 1)))
        print("  Total optimal value: " + str(round(total_optimal, 1)))
        print("  Value left on bench: " + str(round(total_optimal - total_actual, 1)))

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backtest Replay Engine")
    parser.add_argument("--year", type=int, default=datetime.now().year,
                        help="Season year (default: current year)")
    parser.add_argument("--weeks", type=str, default=None,
                        help="Week range, e.g. 1-25 (default: all available)")
    parser.add_argument("--verbose", action="store_true",
                        help="Show per-week details")
    parser.add_argument("--json", action="store_true",
                        help="Output results as JSON")

    args = parser.parse_args()

    week_range = None
    if args.weeks:
        parts = args.weeks.split("-")
        if len(parts) == 2:
            try:
                week_range = (int(parts[0]), int(parts[1]))
            except ValueError:
                print("Invalid week range: " + args.weeks)
                sys.exit(1)
        elif len(parts) == 1:
            try:
                wk = int(parts[0])
                week_range = (wk, wk)
            except ValueError:
                print("Invalid week: " + args.weeks)
                sys.exit(1)

    results = replay_season(args.year, week_range, verbose=args.verbose)

    if args.json:
        output = [r.to_dict() for r in results]
        print(json.dumps(output, indent=2))
