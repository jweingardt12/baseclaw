#!/usr/bin/env python3
"""Offline Fantasy Draft Engine

Manages an in-person/offline fantasy baseball draft with Google Sheet sync.
State persisted to data/offline-draft.json. Player data from FanGraphs projections
via the valuations engine.
"""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import valuations

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
STATE_FILE = os.path.join(DATA_DIR, "offline-draft.json")

# Default roster slots for a standard 12-team Yahoo league
DEFAULT_ROSTER = {
    "C": 1, "1B": 1, "2B": 1, "3B": 1, "SS": 1,
    "OF": 3, "Util": 2,
    "SP": 2, "RP": 2, "P": 2, "BN": 3,
}


class OfflineDraft:
    def __init__(self):
        self._hitters = None
        self._pitchers = None
        self._state = None

    # --- Valuations cache ---

    def _load_valuations(self):
        if self._hitters is None:
            self._hitters, self._pitchers, _ = valuations.load_all()

    def _all_players(self):
        """Return combined list of all players from valuations."""
        self._load_valuations()
        players = []
        if self._hitters is not None:
            for _, row in self._hitters.iterrows():
                players.append({
                    "name": str(row.get("Name", "")),
                    "team": str(row.get("Team", "")),
                    "position": str(row.get("Pos", "")),
                    "z_score": _safe_float(row.get("Z_Final", 0)),
                    "type": "B",
                })
        if self._pitchers is not None:
            for _, row in self._pitchers.iterrows():
                players.append({
                    "name": str(row.get("Name", "")),
                    "team": str(row.get("Team", "")),
                    "position": str(row.get("Pos", "")),
                    "z_score": _safe_float(row.get("Z_Final", 0)),
                    "type": "P",
                })
        return players

    # --- State management ---

    def _load(self):
        if self._state is not None:
            return self._state
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                self._state = json.load(f)
        else:
            self._state = None
        return self._state

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(STATE_FILE, "w") as f:
            json.dump(self._state, f, indent=2)

    def is_active(self):
        state = self._load()
        return state is not None and state.get("started", False)

    # --- Draft control ---

    def start(self, teams, num_rounds, my_team, snake=True, sheet_id=None, sheet_range="Sheet1", roster_positions=None):
        """Initialize a new offline draft session."""
        self._state = {
            "teams": teams,
            "num_rounds": int(num_rounds),
            "my_team": my_team,
            "snake": bool(snake),
            "started": True,
            "sheet_id": sheet_id,
            "sheet_range": sheet_range or "Sheet1",
            "roster_positions": roster_positions or DEFAULT_ROSTER,
            "picks": [],
        }
        self._save()
        return self.status()

    def reset(self):
        """Reset the draft — clear all state."""
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        self._state = None
        return {"success": True, "message": "Draft reset"}

    # --- Pick management ---

    def pick(self, player_name, team_name=None):
        """Record a draft pick. Auto-assigns to on-the-clock team if team_name is None."""
        state = self._load()
        if not state or not state.get("started"):
            return {"error": "No active draft. Call start() first."}

        # Determine who is on the clock
        clock = self._on_the_clock_internal(state)
        if clock is None:
            return {"error": "Draft is complete — all rounds filled."}

        if team_name is None:
            team_name = clock["team"]

        # Validate team name
        if team_name not in state["teams"]:
            # Fuzzy match team name
            matches = [t for t in state["teams"] if team_name.lower() in t.lower()]
            if len(matches) == 1:
                team_name = matches[0]
            elif len(matches) > 1:
                return {"error": "Ambiguous team name '" + team_name + "'. Matches: " + ", ".join(matches)}
            else:
                return {"error": "Unknown team '" + team_name + "'. Teams: " + ", ".join(state["teams"])}

        # Look up player in valuations
        player_info = self._match_player(player_name)

        pick_entry = {
            "round": clock["round"],
            "pick": clock["pick_in_round"],
            "overall": clock["overall"],
            "team": team_name,
            "player_name": player_info["name"],
            "position": player_info["position"],
            "z_score": player_info["z_score"],
            "mlb_id": player_info.get("mlb_id"),
        }
        state["picks"].append(pick_entry)
        self._save()
        return {"success": True, "pick": pick_entry, "status": self._status_internal(state)}

    def undo(self):
        """Remove the last pick."""
        state = self._load()
        if not state or not state.get("picks"):
            return {"error": "No picks to undo."}
        removed = state["picks"].pop()
        self._save()
        return {"success": True, "removed": removed, "status": self._status_internal(state)}

    # --- Google Sheet sync ---

    def sync_from_sheet(self):
        """Fetch picks from Google Sheet via gws CLI and update state."""
        state = self._load()
        if not state or not state.get("started"):
            return {"error": "No active draft."}

        sheet_id = state.get("sheet_id")
        if not sheet_id:
            return {"error": "No sheet_id configured. Set it when starting the draft."}

        sheet_range = state.get("sheet_range", "Sheet1")
        # Fetch all data from the sheet
        try:
            params_json = json.dumps({
                "spreadsheetId": sheet_id,
                "range": sheet_range,
            })
            result = subprocess.run(
                ["gws", "sheets", "spreadsheets", "values", "get", "--params", params_json],
                capture_output=True, text=True, timeout=15,
            )
            if result.returncode != 0:
                return {"error": "gws failed: " + result.stderr.strip()}

            data = json.loads(result.stdout)
        except FileNotFoundError:
            return {"error": "gws CLI not found. Install from https://github.com/googleworkspace/cli"}
        except subprocess.TimeoutExpired:
            return {"error": "gws timed out after 15 seconds"}
        except json.JSONDecodeError:
            return {"error": "Invalid JSON from gws: " + result.stdout[:200]}

        # Parse the sheet data
        rows = data.get("values", [])
        if not rows:
            return {"synced": 0, "total_picks": len(state["picks"]), "message": "Sheet is empty"}

        # Auto-detect column mapping from header row
        header = [str(c).strip().lower() for c in rows[0]]
        col_map = _detect_columns(header)
        if col_map is None:
            return {"error": "Could not detect columns. Header: " + str(rows[0]) + ". Expected columns containing: round, pick, team, player"}

        # Parse picks from rows (skip header)
        sheet_picks = []
        for row in rows[1:]:
            if len(row) <= max(col_map.values()):
                # Skip incomplete rows
                if not any(str(c).strip() for c in row):
                    continue
            player_name = _safe_cell(row, col_map["player"])
            if not player_name:
                continue
            team_name = _safe_cell(row, col_map["team"])
            round_num = _safe_int(_safe_cell(row, col_map.get("round")))
            pick_num = _safe_int(_safe_cell(row, col_map.get("pick")))
            sheet_picks.append({
                "player_name": player_name,
                "team": team_name,
                "round": round_num,
                "pick": pick_num,
            })

        # Determine new picks (compare count)
        existing_count = len(state["picks"])
        new_count = len(sheet_picks)

        if new_count <= existing_count:
            return {"synced": 0, "total_picks": existing_count, "message": "No new picks"}

        # Process new picks
        new_picks = sheet_picks[existing_count:]
        added = 0
        for sp in new_picks:
            player_info = self._match_player(sp["player_name"])
            clock = self._on_the_clock_internal(state)
            if clock is None:
                break
            pick_entry = {
                "round": sp["round"] or clock["round"],
                "pick": sp["pick"] or clock["pick_in_round"],
                "overall": clock["overall"],
                "team": sp["team"] or clock["team"],
                "player_name": player_info["name"],
                "position": player_info["position"],
                "z_score": player_info["z_score"],
                "mlb_id": player_info.get("mlb_id"),
            }
            state["picks"].append(pick_entry)
            added += 1

        self._save()
        return {
            "synced": added,
            "total_picks": len(state["picks"]),
            "status": self._status_internal(state),
        }

    # --- Queries ---

    def status(self):
        state = self._load()
        if not state or not state.get("started"):
            return {"active": False}
        return self._status_internal(state)

    def _status_internal(self, state):
        clock = self._on_the_clock_internal(state)
        total_picks = len(state["picks"])
        total_possible = len(state["teams"]) * state["num_rounds"]
        complete = total_picks >= total_possible

        result = {
            "active": True,
            "complete": complete,
            "total_picks": total_picks,
            "total_possible": total_possible,
            "num_teams": len(state["teams"]),
            "num_rounds": state["num_rounds"],
            "teams": state["teams"],
            "my_team": state["my_team"],
            "snake": state["snake"],
            "has_sheet": bool(state.get("sheet_id")),
        }
        if clock:
            result["on_the_clock"] = clock
        return result

    def _on_the_clock_internal(self, state):
        """Determine who picks next."""
        total_picks = len(state["picks"])
        num_teams = len(state["teams"])
        total_possible = num_teams * state["num_rounds"]
        if total_picks >= total_possible:
            return None

        current_round = total_picks // num_teams + 1
        pick_in_round = total_picks % num_teams + 1

        if state["snake"] and current_round % 2 == 0:
            team_idx = num_teams - pick_in_round
        else:
            team_idx = pick_in_round - 1

        # Calculate picks until my turn
        my_team = state["my_team"]
        my_idx = state["teams"].index(my_team) if my_team in state["teams"] else -1
        picks_until_my_turn = self._picks_until_turn(state, total_picks, my_idx)

        return {
            "team": state["teams"][team_idx],
            "round": current_round,
            "pick_in_round": pick_in_round,
            "overall": total_picks + 1,
            "picks_until_my_turn": picks_until_my_turn,
        }

    def _picks_until_turn(self, state, current_total, my_idx):
        """Count how many picks until my_idx's next turn."""
        if my_idx < 0:
            return -1
        num_teams = len(state["teams"])
        total_possible = num_teams * state["num_rounds"]
        for offset in range(0, total_possible - current_total):
            future_pick = current_total + offset
            future_round = future_pick // num_teams + 1
            future_pos = future_pick % num_teams
            if state["snake"] and future_round % 2 == 0:
                team_idx = num_teams - 1 - future_pos
            else:
                team_idx = future_pos
            if team_idx == my_idx:
                return offset
        return -1

    def search_players(self, query, limit=10):
        """Autocomplete search against valuations database."""
        if not query or len(query) < 2:
            return []

        all_players = self._all_players()
        drafted_names = self._drafted_names()
        q = query.lower()

        matches = []
        for p in all_players:
            if q in p["name"].lower():
                p["drafted"] = p["name"] in drafted_names
                matches.append(p)

        # Sort: undrafted first, then by z-score descending
        matches.sort(key=lambda x: (x["drafted"], -x["z_score"]))
        return matches[:limit]

    def get_available(self, pos_type="all", limit=25):
        """Best available undrafted players by z-score."""
        all_players = self._all_players()
        drafted_names = self._drafted_names()

        available = [p for p in all_players if p["name"] not in drafted_names]

        if pos_type and pos_type.lower() not in ("all", ""):
            pos_upper = pos_type.upper()
            if pos_upper == "B":
                available = [p for p in available if p["type"] == "B"]
            elif pos_upper == "P":
                available = [p for p in available if p["type"] == "P"]
            else:
                # Specific position filter (C, 1B, SS, OF, SP, RP, etc.)
                available = [p for p in available if pos_upper in p["position"].upper().split(",")]

        available.sort(key=lambda x: -x["z_score"])
        return available[:limit]

    def recommend(self):
        """Recommend the best pick for the user's team."""
        state = self._load()
        if not state or not state.get("started"):
            return {"error": "No active draft."}

        my_team = state["my_team"]
        my_picks = [p for p in state["picks"] if p["team"] == my_team]
        roster_slots = state.get("roster_positions", DEFAULT_ROSTER)

        # Count filled positions
        filled = {}
        for p in my_picks:
            pos = (p.get("position") or "").split(",")[0].strip()
            if pos:
                filled[pos] = filled.get(pos, 0) + 1

        # Determine positional needs
        needs = {}
        for pos, count in roster_slots.items():
            if pos == "BN" or pos == "Util":
                continue
            have = filled.get(pos, 0)
            if have < count:
                needs[pos] = count - have

        # Get best available
        all_available = self.get_available("all", limit=100)
        drafted_names = self._drafted_names()

        # Score players: z-score + positional need bonus
        scored = []
        for p in all_available:
            if p["name"] in drafted_names:
                continue
            bonus = 0
            pos = p["position"].split(",")[0].strip() if p["position"] else ""
            if pos in needs:
                bonus = 1.5  # Boost for needed positions
            scored.append({
                **p,
                "need_bonus": bonus,
                "adjusted_score": p["z_score"] + bonus,
                "fills_need": pos if pos in needs else None,
            })

        scored.sort(key=lambda x: -x["adjusted_score"])

        clock = self._on_the_clock_internal(state)
        return {
            "on_the_clock": clock,
            "my_picks_count": len(my_picks),
            "positional_needs": needs,
            "filled_positions": filled,
            "recommendations": scored[:15],
        }

    def my_team_roster(self):
        """Show user's drafted roster."""
        state = self._load()
        if not state or not state.get("started"):
            return {"error": "No active draft."}

        my_team = state["my_team"]
        my_picks = [p for p in state["picks"] if p["team"] == my_team]
        roster_slots = state.get("roster_positions", DEFAULT_ROSTER)

        total_z = sum(p.get("z_score") or 0 for p in my_picks)
        hitters = [p for p in my_picks if p.get("position", "").split(",")[0].strip() not in ("SP", "RP", "P")]
        pitchers = [p for p in my_picks if p.get("position", "").split(",")[0].strip() in ("SP", "RP", "P")]

        return {
            "team": my_team,
            "picks": my_picks,
            "total_z_score": round(total_z, 2),
            "hitters": len(hitters),
            "pitchers": len(pitchers),
            "roster_slots": roster_slots,
        }

    def board(self):
        """Full draft board grid: teams × rounds."""
        state = self._load()
        if not state or not state.get("started"):
            return {"error": "No active draft."}

        teams = state["teams"]
        num_rounds = state["num_rounds"]
        num_teams = len(teams)

        # Build grid: rounds[round_num][team_name] = pick_info
        grid = []
        for r in range(1, num_rounds + 1):
            round_picks = {}
            for t in teams:
                round_picks[t] = None
            grid.append({"round": r, "picks": round_picks})

        for p in state["picks"]:
            r = p.get("round", 0)
            t = p.get("team", "")
            if 1 <= r <= num_rounds and t in teams:
                grid[r - 1]["picks"][t] = {
                    "player_name": p["player_name"],
                    "position": p.get("position", ""),
                    "z_score": p.get("z_score"),
                }

        clock = self._on_the_clock_internal(state)
        return {
            "teams": teams,
            "num_rounds": num_rounds,
            "my_team": state["my_team"],
            "snake": state["snake"],
            "grid": grid,
            "total_picks": len(state["picks"]),
            "on_the_clock": clock,
        }

    # --- Helpers ---

    def _drafted_names(self):
        """Set of drafted player names (lowercased for matching)."""
        state = self._load()
        if not state:
            return set()
        return {p["player_name"] for p in state.get("picks", [])}

    def _match_player(self, name):
        """Match a player name against valuations. Returns best match or raw name."""
        self._load_valuations()
        results = valuations.get_player_by_name(name, self._hitters, self._pitchers)

        if results:
            # Find exact match first, then best partial match by z-score
            exact = [r for r in results if r.get("Name", "").lower() == name.lower()]
            if exact:
                best = exact[0]
            else:
                best = max(results, key=lambda r: _safe_float(r.get("Z_Final", 0)))
            return {
                "name": str(best.get("Name", name)),
                "position": str(best.get("Pos", "")),
                "z_score": round(_safe_float(best.get("Z_Final", 0)), 2),
                "mlb_id": _get_mlb_id_safe(str(best.get("Name", ""))),
            }

        # Player not found in projections — store raw name
        return {
            "name": name,
            "position": "",
            "z_score": None,
            "mlb_id": None,
        }


def _safe_float(val):
    try:
        import math
        f = float(val)
        return 0.0 if math.isnan(f) else f
    except (TypeError, ValueError):
        return 0.0


def _safe_int(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def _safe_cell(row, idx):
    """Safely get a cell from a row by index."""
    if idx is None or idx < 0 or idx >= len(row):
        return ""
    return str(row[idx]).strip()


def _get_mlb_id_safe(name):
    try:
        from mlb_id_cache import get_mlb_id
        return get_mlb_id(name)
    except Exception:
        return None


def _detect_columns(header):
    """Auto-detect column indices from header row."""
    col_map = {}
    for i, col in enumerate(header):
        col = col.lower().strip()
        if "player" in col or col == "name":
            col_map["player"] = i
        elif col == "team" or "team" in col:
            if "player" not in col:
                col_map["team"] = i
        elif col == "round" or col == "rd":
            col_map["round"] = i
        elif col == "pick" or col == "#" or col == "pick #":
            col_map["pick"] = i

    if "player" not in col_map:
        return None
    if "team" not in col_map:
        col_map["team"] = None
    return col_map
