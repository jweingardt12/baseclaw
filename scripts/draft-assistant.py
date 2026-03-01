#!/usr/bin/env python3
"""
Yahoo Fantasy Draft Assistant - Docker Version
Live Draft Tool
"""

import sys
import json
import time
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yahoo_oauth import OAuth2
import yahoo_fantasy_api as yfa
from valuations import load_all, get_player_by_name
from mlb_id_cache import get_mlb_id
from shared import enrich_with_intel

# Docker paths
OAUTH_FILE = os.environ.get("OAUTH_FILE", "/app/config/yahoo_oauth.json")
LEAGUE_ID = os.environ.get("LEAGUE_ID", "")
TEAM_ID = os.environ.get("TEAM_ID", "")

class DraftAssistant:
    def __init__(self):
        self.sc = OAuth2(None, None, from_file=OAUTH_FILE)
        self.gm = yfa.Game(self.sc, "mlb")
        self.lg = self.gm.to_league(LEAGUE_ID)
        self.team = self.lg.to_team(TEAM_ID)
        self.drafted_players = set()
        self.my_roster = []
        self.current_round = 1
        self.my_pitchers = 0
        self.my_hitters = 0
        # Load z-score valuations
        self._val_hitters = None
        self._val_pitchers = None
        self._val_source = None
        self._load_valuations()

    def _load_valuations(self):
        """Load z-score valuations from the valuation engine"""
        try:
            h, p, source = load_all()
            self._val_hitters = h
            self._val_pitchers = p
            self._val_source = source
        except Exception as e:
            print("Note: valuations unavailable (" + str(e) + ")")

    def _get_zscore(self, player_name, pos_type="B"):
        """Look up a player's z-score by name"""
        if pos_type == "B":
            df = self._val_hitters
        else:
            df = self._val_pitchers
        if df is None or len(df) == 0:
            return None
        matches = get_player_by_name(player_name,
                                      self._val_hitters if pos_type == "B" else None,
                                      self._val_pitchers if pos_type == "P" else None)
        if matches:
            return matches[0].get("Z_Final", None)
        return None

    def refresh(self):
        """Refresh draft state"""
        try:
            draft = self.lg.draft_results()
            self.drafted_players = set()
            for pick in draft:
                self.drafted_players.add(pick["player_id"])

            my_picks = [p for p in draft if p["team_key"] == TEAM_ID]
            self.current_round = len(my_picks) + 1

            self.my_pitchers = 0
            self.my_hitters = 0
            for p in my_picks:
                try:
                    details = self.lg.player_details([p["player_id"]])
                    if details:
                        pos = details[0].get("display_position", "")
                        if "P" in pos and pos != "DH":
                            self.my_pitchers += 1
                        else:
                            self.my_hitters += 1
                except:
                    pass

            return len(draft)
        except Exception as e:
            print("Error refreshing:", e)
            return 0

    def get_available(self, pos_type="B", limit=20):
        """Get best available players, sorted by z-score when available"""
        fa = self.lg.free_agents(pos_type)
        available = []

        for p in fa:
            pid = p.get("player_id")
            if pid not in self.drafted_players:
                # Attach z-score if available
                name = p.get("name", "")
                z = self._get_zscore(name, pos_type)
                p["z_score"] = z
                available.append(p)

        # Sort by z-score (highest first) if valuations are loaded
        has_z = any(p.get("z_score") is not None for p in available)
        if has_z:
            available.sort(key=lambda p: p.get("z_score") or -999, reverse=True)

        return available[:limit]

    def recommend(self, as_json=False):
        """Get draft recommendation"""
        self.refresh()

        should_pitch = False
        recommendation = ""
        if self.current_round >= 7 and self.my_pitchers == 0:
            should_pitch = True
            recommendation = "Consider first pitcher (round 7+)"
        elif self.current_round >= 9 and self.my_pitchers < 2:
            should_pitch = True
            recommendation = "Need pitching depth"
        elif self.current_round <= 6:
            recommendation = "HITTERS ONLY (rounds 1-6)"

        hitters = self.get_available("B", 10)
        pitchers = self.get_available("P", 10)

        top_pick = None
        if should_pitch and pitchers:
            top_pick = pitchers[0]
        elif hitters:
            top_pick = hitters[0]

        if as_json:
            def player_entry(p):
                z = p.get("z_score")
                return {
                    "name": p.get("name", "?"),
                    "positions": p.get("eligible_positions", []),
                    "z_score": round(float(z), 1) if z is not None else None,
                    "mlb_id": get_mlb_id(p.get("name", "")),
                }

            top_pick_info = None
            if top_pick:
                z = top_pick.get("z_score")
                top_pick_info = {
                    "name": top_pick.get("name", "?"),
                    "type": "P" if (should_pitch and pitchers and top_pick == pitchers[0]) else "B",
                    "z_score": round(float(z), 1) if z is not None else None,
                }

            top_hitters_list = [player_entry(p) for p in hitters]
            top_pitchers_list = [player_entry(p) for p in pitchers]
            enrich_with_intel(top_hitters_list + top_pitchers_list)
            return {
                "round": self.current_round,
                "hitters_count": self.my_hitters,
                "pitchers_count": self.my_pitchers,
                "recommendation": recommendation,
                "top_hitters": top_hitters_list,
                "top_pitchers": top_pitchers_list,
                "top_pick": top_pick_info,
            }

        print("\n" + "="*60)
        print("DRAFT ASSISTANT - Round", self.current_round)
        print("="*60)
        print("Your roster:", self.my_hitters, "H /", self.my_pitchers, "P")

        if recommendation:
            print("RECOMMENDATION: " + recommendation)

        print("\n--- TOP 10 AVAILABLE HITTERS ---")
        for i, p in enumerate(hitters, 1):
            name = p.get("name", "?")
            pos = ",".join(p.get("eligible_positions", ["?"]))
            z = p.get("z_score")
            z_str = " [" + "{:.1f}".format(z) + "]" if z is not None else ""
            print(str(i) + ". " + name.ljust(25) + pos.ljust(15) + z_str)

        print("\n--- TOP 10 AVAILABLE PITCHERS ---")
        for i, p in enumerate(pitchers, 1):
            name = p.get("name", "?")
            pos = ",".join(p.get("eligible_positions", ["?"]))
            z = p.get("z_score")
            z_str = " [" + "{:.1f}".format(z) + "]" if z is not None else ""
            print(str(i) + ". " + name.ljust(25) + pos.ljust(15) + z_str)

        print("\n" + "="*60)
        if should_pitch and pitchers:
            print("TOP PICK: " + pitchers[0].get("name", "?") + " (PITCHER)")
        elif hitters:
            print("TOP PICK: " + hitters[0].get("name", "?") + " (HITTER)")
        print("="*60)

        return top_pick

    def watch(self, interval=30):
        """Watch draft and update recommendations"""
        print("Starting draft watch mode (refresh every " + str(interval) + "s)")
        print("Press Ctrl+C to stop")

        last_picks = 0
        while True:
            try:
                current_picks = self.refresh()
                if current_picks != last_picks:
                    print("\n*** NEW PICK DETECTED ***")
                    self.recommend()
                    last_picks = current_picks
                else:
                    print(".", end="", flush=True)
                time.sleep(interval)
            except KeyboardInterrupt:
                print("\nStopped watching.")
                break
            except Exception as e:
                print("\nError:", e)
                time.sleep(interval)

    def status(self, as_json=False):
        """Show current draft status"""
        picks = self.refresh()

        if as_json:
            result = {
                "total_picks": picks,
                "current_round": self.current_round,
                "hitters": self.my_hitters,
                "pitchers": self.my_pitchers,
            }

            # Include draft results for draft board view
            try:
                draft = self.lg.draft_results()
                settings = self.lg.settings()
                num_teams = int(settings.get("num_teams", 12))
                result["num_teams"] = num_teams
                result["your_team_key"] = TEAM_ID

                # Build team name mapping
                team_names = {}
                try:
                    teams = self.lg.teams()
                    for tk, td in teams.items():
                        team_names[str(tk)] = td.get("name", "?")
                except Exception:
                    pass

                # Resolve player names in batches
                player_ids = []
                for pick in draft:
                    pid = pick.get("player_id", "")
                    if pid and pid not in player_ids:
                        player_ids.append(pid)

                player_info = {}
                for i in range(0, len(player_ids), 25):
                    batch = player_ids[i:i + 25]
                    try:
                        details = self.lg.player_details(batch)
                        if details:
                            for d in details:
                                pid = d.get("player_id", "")
                                pname = d.get("name", "Unknown")
                                if isinstance(pname, dict):
                                    pname = pname.get("full", "Unknown")
                                pos = d.get("display_position", "")
                                player_info[str(pid)] = {
                                    "name": str(pname),
                                    "position": pos,
                                }
                    except Exception:
                        pass

                draft_results = []
                for pick in draft:
                    pid = str(pick.get("player_id", ""))
                    team_key = str(pick.get("team_key", ""))
                    info = player_info.get(pid, {})
                    draft_results.append({
                        "round": pick.get("round", 0),
                        "pick": pick.get("pick", 0),
                        "team_key": team_key,
                        "team_name": team_names.get(team_key, "?"),
                        "player_name": info.get("name", "Player " + pid),
                        "player_key": pid,
                        "position": info.get("position", ""),
                    })

                result["draft_results"] = draft_results
            except Exception as e:
                result["draft_results"] = []

            return result

        print("Total picks made:", picks)
        print("Your round:", self.current_round)
        print("Your roster:", self.my_hitters, "H /", self.my_pitchers, "P")

def _load_cheatsheet():
    """Load cheatsheet from config file"""
    cheatsheet_path = os.environ.get("CHEATSHEET_FILE", "/app/config/draft-cheatsheet.json")
    try:
        with open(cheatsheet_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:
        print("Error loading cheatsheet: " + str(e))
        return None

def cmd_cheatsheet(args, as_json=False):
    """Print quick cheat sheet"""
    data = _load_cheatsheet()
    if not data:
        msg = "No cheatsheet configured. Copy config/draft-cheatsheet.json.example to config/draft-cheatsheet.json and customize."
        if as_json:
            return {"error": msg}
        print(msg)
        return

    if as_json:
        return data

    strategy = data.get("strategy", {})
    targets = data.get("targets", {})
    avoid = data.get("avoid", [])
    opponents = data.get("opponents", [])
    title = data.get("title", "DRAFT CHEAT SHEET")

    print("")
    print("=== " + title + " ===")
    print("")
    print("STRATEGY:")
    for key, val in strategy.items():
        label = key.replace("rounds_", "Rounds ").replace("_", "-")
        print("- " + label + ": " + val)
    print("")
    print("TARGETS BY ROUND:")
    for key, val in targets.items():
        label = key.replace("rounds_", "").replace("_", "-")
        print(label + ": " + ", ".join(val))
    print("")
    print("AVOID:")
    for item in avoid:
        print("- " + item)
    if opponents:
        print("")
        print("OPPONENTS TO EXPLOIT:")
        for opp in opponents:
            print("- " + opp.get("name", "???") + ": " + opp.get("tendency", ""))
    print("")

def cmd_best_available(args, as_json=False):
    """Show ranked available players with z-scores"""
    pos_type = args[0].upper() if args else "B"
    count = int(args[1]) if len(args) > 1 else 25

    da = DraftAssistant()
    da.refresh()

    available = da.get_available(pos_type, count)

    if as_json:
        players = []
        for i, p in enumerate(available, 1):
            z = p.get("z_score")
            players.append({
                "rank": i,
                "name": p.get("name", "?"),
                "positions": p.get("eligible_positions", []),
                "z_score": round(float(z), 2) if z is not None else None,
                "mlb_id": get_mlb_id(p.get("name", "")),
            })
        enrich_with_intel(players)
        return {"pos_type": pos_type, "players": players}

    label = "Hitters" if pos_type == "B" else "Pitchers"
    print("\nBest Available " + label + " (by Z-Score):")
    print("-" * 65)
    print("  #  " + "Name".ljust(25) + "Positions".ljust(15) + "Z-Score")
    print("-" * 65)

    for i, p in enumerate(available, 1):
        name = p.get("name", "?")
        pos = ",".join(p.get("eligible_positions", ["?"]))
        z = p.get("z_score")
        z_str = "{:.2f}".format(z) if z is not None else "N/A"
        print("  " + str(i).rjust(2) + ". " + name.ljust(25) + pos.ljust(15) + z_str)

COMMANDS = {
    "recommend": lambda a: DraftAssistant().recommend(),
    "watch": lambda a: DraftAssistant().watch(int(a[0]) if a else 30),
    "status": lambda a: DraftAssistant().status(),
    "cheatsheet": cmd_cheatsheet,
    "best-available": cmd_best_available,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Draft Assistant (Docker)")
        print("Usage: draft-assistant.py <command>")
        print("\nCommands: recommend, watch, status, cheatsheet, best-available")
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command:", cmd)
