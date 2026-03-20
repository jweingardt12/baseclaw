#!/usr/bin/env python3
"""Yahoo Fantasy Baseball JSON API Server

Routes match the TypeScript MCP Apps server's python-client.ts expectations.
"""

import sys
import os
import importlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request

# Import modules (some have hyphens, need importlib)
yahoo_fantasy = importlib.import_module("yahoo-fantasy")
draft_assistant = importlib.import_module("draft-assistant")
mlb_data = importlib.import_module("mlb-data")
season_manager = importlib.import_module("season-manager")
import valuations
import history
import intel
import news
import yahoo_browser

app = Flask(__name__)


# --- Session heartbeat (keeps Yahoo cookies alive) ---

HEARTBEAT_INTERVAL = int(os.environ.get("BROWSER_HEARTBEAT_HOURS", "6")) * 3600


def _run_heartbeat():
    """Background loop that refreshes the browser session periodically"""
    import time

    # Wait a bit for startup to settle
    time.sleep(30)
    while True:
        try:
            status = yahoo_browser.is_session_valid()
            if status.get("valid"):
                yahoo_browser.refresh_session()
        except Exception as e:
            print("Heartbeat error: " + str(e))
        time.sleep(HEARTBEAT_INTERVAL)


import threading

_heartbeat_thread = threading.Thread(target=_run_heartbeat, daemon=True)
_heartbeat_thread.start()


# --- Startup projection fetch ---

def _startup_projections():
    """Background thread to ensure projections are loaded on startup"""
    import time
    time.sleep(5)  # Let other startup tasks settle
    try:
        valuations.ensure_projections()
        print("Startup projections loaded successfully")
    except Exception as e:
        print("Startup projections failed: " + str(e))


_proj_thread = threading.Thread(target=_startup_projections, daemon=True)
_proj_thread.start()


# --- Health check ---


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/endpoints")
def api_endpoints():
    """List all registered API endpoints with methods"""
    endpoints = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if rule.rule.startswith("/api/"):
            methods = sorted(rule.methods - {"OPTIONS", "HEAD"})
            endpoints.append({
                "path": rule.rule,
                "methods": methods,
            })
    return jsonify({"endpoints": endpoints})


@app.route("/api/browser-login-status")
def api_browser_login_status():
    try:
        result = yahoo_browser.is_session_valid()
        result["heartbeat"] = yahoo_browser.get_heartbeat_state()
        return jsonify(result)
    except Exception as e:
        return jsonify({"valid": False, "reason": str(e)}), 500


@app.route("/api/change-team-name", methods=["POST"])
def api_change_team_name():
    try:
        data = request.get_json(force=True) if request.is_json else request.form
        new_name = data.get("new_name", "")
        if not new_name:
            return jsonify({"error": "Missing new_name"}), 400
        result = yahoo_browser.change_team_name(new_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/change-team-logo", methods=["POST"])
def api_change_team_logo():
    try:
        data = request.get_json(force=True) if request.is_json else request.form
        image_path = data.get("image_path", "")
        if not image_path:
            return jsonify({"error": "Missing image_path"}), 400
        result = yahoo_browser.change_team_logo(image_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Yahoo Fantasy (yahoo-fantasy.py) ---
# TS tools call: /api/roster, /api/free-agents, /api/standings, etc.


@app.route("/api/roster")
def api_roster():
    try:
        result = yahoo_fantasy.cmd_roster([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/free-agents")
def api_free_agents():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "20")
        result = yahoo_fantasy.cmd_free_agents([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/standings")
def api_standings():
    try:
        result = yahoo_fantasy.cmd_standings([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/info")
def api_info():
    try:
        result = yahoo_fantasy.cmd_info([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/league-context")
def api_league_context():
    try:
        from shared import get_league_settings, get_league_context, normalize_team_details
        settings = get_league_settings()
        result = {
            "waiver_type": settings.get("waiver_type", "unknown"),
            "uses_faab": settings.get("uses_faab", False),
            "scoring_type": settings.get("scoring_type", ""),
            "stat_categories": settings.get("stat_categories", []),
            "roster_positions": settings.get("roster_positions", []),
            "num_teams": settings.get("num_teams", 0),
            "max_weekly_adds": settings.get("max_weekly_adds", 0),
        }
        # Include FAAB balance only for FAAB leagues
        if settings.get("uses_faab"):
            try:
                sc, gm, lg, team = get_league_context()
                d = normalize_team_details(team)
                fb = d.get("faab_balance")
                if fb is not None:
                    result["faab_balance"] = fb
            except Exception as e:
                print("Warning: could not fetch FAAB balance for league-context: " + str(e))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/search")
def api_search():
    try:
        # TS tool sends "name" param
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        result = yahoo_fantasy.cmd_search([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/add", methods=["POST"])
def api_add():
    try:
        # TS tool sends JSON body: { player_id: "..." }
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            player_id = request.args.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id"}), 400
        result = yahoo_fantasy.cmd_add([player_id], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/drop", methods=["POST"])
def api_drop():
    try:
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            player_id = request.args.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id"}), 400
        result = yahoo_fantasy.cmd_drop([player_id], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/swap", methods=["POST"])
def api_swap():
    try:
        data = request.get_json(silent=True) or {}
        add_id = data.get("add_id", "")
        drop_id = data.get("drop_id", "")
        if not add_id:
            add_id = request.args.get("add_id", "")
        if not drop_id:
            drop_id = request.args.get("drop_id", "")
        if not add_id or not drop_id:
            return jsonify({"error": "Missing add_id and/or drop_id"}), 400
        result = yahoo_fantasy.cmd_swap([add_id, drop_id], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/matchups")
def api_matchups():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = yahoo_fantasy.cmd_matchups(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scoreboard")
def api_scoreboard():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = yahoo_fantasy.cmd_scoreboard(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/transactions")
def api_transactions():
    try:
        args = []
        tx_type = request.args.get("type", "")
        if tx_type:
            args.append(tx_type)
        count = request.args.get("count", "")
        if count:
            args.append(count)
        result = yahoo_fantasy.cmd_transactions(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stat-categories")
def api_stat_categories():
    try:
        result = yahoo_fantasy.cmd_stat_categories([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/transaction-trends")
def api_transaction_trends():
    try:
        result = yahoo_fantasy.cmd_transaction_trends([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/matchup-detail")
def api_matchup_detail():
    try:
        result = yahoo_fantasy.cmd_matchup_detail([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Draft Assistant (draft-assistant.py) ---
# TS tools call: /api/draft-status, /api/draft-recommend, /api/draft-cheatsheet, /api/best-available


@app.route("/api/draft-status")
def api_draft_status():
    try:
        da = draft_assistant.DraftAssistant()
        result = da.status(as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/draft-recommend")
def api_draft_recommend():
    try:
        da = draft_assistant.DraftAssistant()
        result = da.recommend(as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/draft-cheatsheet")
def api_draft_cheatsheet():
    try:
        result = draft_assistant.cmd_cheatsheet([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/best-available")
def api_best_available():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "25")
        result = draft_assistant.cmd_best_available([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Valuations (valuations.py) ---
# TS tools call: /api/rankings, /api/compare, /api/value


@app.route("/api/rankings")
def api_rankings():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "25")
        result = valuations.cmd_rankings([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/compare")
def api_compare():
    try:
        # TS tool sends player1 and player2 params
        player1 = request.args.get("player1", "")
        player2 = request.args.get("player2", "")
        if not player1 or not player2:
            return jsonify({"error": "Missing player1 and/or player2 parameters"}), 400
        result = valuations.cmd_compare([player1, player2], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/value")
def api_value():
    try:
        # TS tool sends "player_name" param
        name = request.args.get("player_name", "")
        if not name:
            name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing player_name parameter"}), 400
        result = valuations.cmd_value([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/projections-update", methods=["POST"])
def api_projections_update():
    try:
        data = request.get_json(silent=True) or {}
        proj_type = data.get("proj_type", "steamer")
        result = valuations.ensure_projections(proj_type=proj_type, force=True)
        return jsonify({"status": "ok", "result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/projection-disagreements", methods=["GET"])
def api_projection_disagreements():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = int(request.args.get("count", "20"))
        stats_type = "bat" if pos_type == "B" else "pit"
        result = valuations.compute_projection_disagreements(stats_type=stats_type, count=count)
        return jsonify({"pos_type": pos_type, "disagreements": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/zscore-shifts", methods=["GET"])
def api_zscore_shifts():
    try:
        count = int(request.args.get("count", "25"))
        result = valuations.compute_zscore_shifts(count=count)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/park-factors", methods=["GET"])
def api_park_factors():
    try:
        factors = []
        for team, factor in sorted(valuations.PARK_FACTORS.items()):
            factors.append({"team": team, "factor": factor})
        return jsonify({"park_factors": factors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Season Manager (season-manager.py) ---
# TS tools call: /api/lineup-optimize, /api/category-check, etc.


@app.route("/api/lineup-optimize")
def api_lineup_optimize():
    try:
        args = []
        apply_flag = request.args.get("apply", "false")
        if apply_flag.lower() == "true":
            args.append("--apply")
        result = season_manager.cmd_lineup_optimize(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/category-check")
def api_category_check():
    try:
        result = season_manager.cmd_category_check([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/injury-report")
def api_injury_report():
    try:
        result = season_manager.cmd_injury_report([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/waiver-analyze")
def api_waiver_analyze():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = season_manager.cmd_waiver_analyze([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/streaming")
def api_streaming():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = season_manager.cmd_streaming(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trade-eval", methods=["POST"])
def api_trade_eval():
    try:
        # TS tool sends JSON body: { give_ids: "...", get_ids: "..." }
        data = request.get_json(silent=True) or {}
        give_ids = data.get("give_ids", "")
        get_ids = data.get("get_ids", "")
        if not give_ids or not get_ids:
            return jsonify({"error": "Missing give_ids and/or get_ids"}), 400
        result = season_manager.cmd_trade_eval([give_ids, get_ids], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/category-simulate")
def api_category_simulate():
    try:
        add_name = request.args.get("add_name", "")
        drop_name = request.args.get("drop_name", "")
        if not add_name:
            return jsonify({"error": "Missing add_name parameter"}), 400
        args = [add_name]
        if drop_name:
            args.append(drop_name)
        result = season_manager.cmd_category_simulate(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scout-opponent")
def api_scout_opponent():
    try:
        result = season_manager.cmd_scout_opponent([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/matchup-strategy")
def api_matchup_strategy():
    try:
        result = season_manager.cmd_matchup_strategy([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/daily-update")
def api_daily_update():
    try:
        result = season_manager.cmd_daily_update([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pending-trades")
def api_pending_trades():
    try:
        result = season_manager.cmd_pending_trades([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/propose-trade", methods=["POST"])
def api_propose_trade():
    try:
        data = request.get_json(silent=True) or {}
        their_team_key = data.get("their_team_key", "")
        your_player_ids = data.get("your_player_ids", "")
        their_player_ids = data.get("their_player_ids", "")
        note = data.get("note", "")
        if not their_team_key or not your_player_ids or not their_player_ids:
            return jsonify(
                {
                    "error": "Missing their_team_key, your_player_ids, or their_player_ids"
                }
            ), 400
        args = [their_team_key, your_player_ids, their_player_ids]
        if note:
            args.append(note)
        result = season_manager.cmd_propose_trade(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/accept-trade", methods=["POST"])
def api_accept_trade():
    try:
        data = request.get_json(silent=True) or {}
        transaction_key = data.get("transaction_key", "")
        note = data.get("note", "")
        if not transaction_key:
            return jsonify({"error": "Missing transaction_key"}), 400
        args = [transaction_key]
        if note:
            args.append(note)
        result = season_manager.cmd_accept_trade(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reject-trade", methods=["POST"])
def api_reject_trade():
    try:
        data = request.get_json(silent=True) or {}
        transaction_key = data.get("transaction_key", "")
        note = data.get("note", "")
        if not transaction_key:
            return jsonify({"error": "Missing transaction_key"}), 400
        args = [transaction_key]
        if note:
            args.append(note)
        result = season_manager.cmd_reject_trade(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/set-lineup", methods=["POST"])
def api_set_lineup():
    try:
        data = request.get_json(silent=True) or {}
        moves = data.get("moves", [])
        if not moves:
            return jsonify({"error": "Missing moves array"}), 400
        # Convert moves to "player_id:position" arg format
        args = []
        for m in moves:
            pid = m.get("player_id", "")
            pos = m.get("position", "")
            if pid and pos:
                args.append(str(pid) + ":" + str(pos))
        if not args:
            return jsonify({"error": "No valid moves provided"}), 400
        result = season_manager.cmd_set_lineup(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Waiver Claims (yahoo-fantasy.py) ---


@app.route("/api/waiver-claim", methods=["POST"])
def api_waiver_claim():
    try:
        data = request.get_json(silent=True) or {}
        player_id = data.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id"}), 400
        args = [player_id]
        faab = data.get("faab")
        if faab is not None:
            args.append(str(faab))
        result = yahoo_fantasy.cmd_waiver_claim(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/waiver-claim-swap", methods=["POST"])
def api_waiver_claim_swap():
    try:
        data = request.get_json(silent=True) or {}
        add_id = data.get("add_id", "")
        drop_id = data.get("drop_id", "")
        if not add_id or not drop_id:
            return jsonify({"error": "Missing add_id and/or drop_id"}), 400
        args = [add_id, drop_id]
        faab = data.get("faab")
        if faab is not None:
            args.append(str(faab))
        result = yahoo_fantasy.cmd_waiver_claim_swap(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Who Owns / League Pulse (yahoo-fantasy.py) ---


@app.route("/api/who-owns")
def api_who_owns():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id parameter"}), 400
        result = yahoo_fantasy.cmd_who_owns([player_id], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/percent-owned")
def api_percent_owned():
    try:
        ids = request.args.get("ids", "")
        if not ids:
            return jsonify({"error": "Missing ids parameter (comma-separated player IDs)"}), 400
        args = [pid.strip() for pid in ids.split(",") if pid.strip()]
        result = yahoo_fantasy.cmd_percent_owned(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/league-pulse")
def api_league_pulse():
    try:
        result = yahoo_fantasy.cmd_league_pulse([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Phase 3: What's New & Trade Finder ---


@app.route("/api/whats-new")
def api_whats_new():
    try:
        result = season_manager.cmd_whats_new([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trade-finder")
def api_trade_finder():
    try:
        target = request.args.get("target", "")
        args = [target] if target else []
        result = season_manager.cmd_trade_finder(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Phase 4: Power Rankings, Week Planner, Season Pace ---


@app.route("/api/power-rankings")
def api_power_rankings():
    try:
        result = season_manager.cmd_power_rankings([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/week-planner")
def api_week_planner():
    try:
        args = []
        week = request.args.get("week", "")
        if week:
            args.append(week)
        result = season_manager.cmd_week_planner(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/season-pace")
def api_season_pace():
    try:
        result = season_manager.cmd_season_pace([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Phase 5: Closer Monitor ---


@app.route("/api/closer-monitor")
def api_closer_monitor():
    try:
        result = season_manager.cmd_closer_monitor([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Phase 5: Pitcher Matchup ---


@app.route("/api/pitcher-matchup")
def api_pitcher_matchup():
    try:
        week = request.args.get("week", "")
        args = [week] if week else []
        result = season_manager.cmd_pitcher_matchup(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- New Yahoo API Tools ---


@app.route("/api/player-stats")
def api_player_stats():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        period = request.args.get("period", "season")
        week = request.args.get("week", "")
        date_str = request.args.get("date", "")
        args = [name, period]
        if period == "week" and week:
            args.append(week)
        elif period == "date" and date_str:
            args.append(date_str)
        result = yahoo_fantasy.cmd_player_stats(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/roster-stats")
def api_roster_stats():
    try:
        period = request.args.get("period", "season")
        week = request.args.get("week", "")
        team_key = request.args.get("team_key", "")
        args = []
        if period:
            args.append("--period=" + period)
        if week:
            args.append("--week=" + week)
        if team_key:
            args.append("--team=" + team_key)
        result = season_manager.cmd_roster_stats(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/faab-recommend")
def api_faab_recommend():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "name parameter required"}), 400
        result = season_manager.cmd_faab_recommend([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ownership-trends")
def api_ownership_trends():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "name parameter required"}), 400
        result = season_manager.cmd_ownership_trends([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/category-trends")
def api_category_trends():
    try:
        result = season_manager.cmd_category_trends([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/punt-advisor")
def api_punt_advisor():
    try:
        result = season_manager.cmd_punt_advisor([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/il-stash-advisor")
def api_il_stash_advisor():
    try:
        result = season_manager.cmd_il_stash_advisor([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/playoff-planner")
def api_playoff_planner():
    try:
        result = season_manager.cmd_playoff_planner([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/optimal-moves")
def api_optimal_moves():
    try:
        count = request.args.get("count", "5")
        result = season_manager.cmd_optimal_moves([count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/weekly-narrative")
def api_weekly_narrative():
    try:
        result = season_manager.cmd_weekly_narrative([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/roster-history")
def api_roster_history():
    try:
        week = request.args.get("week", "")
        date_str = request.args.get("date", "")
        team_key = request.args.get("team_key", "")
        lookup = week or date_str
        if not lookup:
            return jsonify({"error": "Missing week or date parameter"}), 400
        args = [lookup]
        if team_key:
            args.append(team_key)
        result = yahoo_fantasy.cmd_roster_history(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/waivers")
def api_waivers():
    try:
        result = yahoo_fantasy.cmd_waivers([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/taken-players")
def api_taken_players():
    try:
        position = request.args.get("position", "")
        args = [position] if position else []
        result = yahoo_fantasy.cmd_taken_players(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/player-list")
def api_player_list():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "50")
        status = request.args.get("status", "FA")
        result = yahoo_fantasy.cmd_player_list([pos_type, count, status], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/positional-ranks")
def api_positional_ranks():
    try:
        result = yahoo_fantasy.cmd_positional_ranks([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- MLB Data (mlb-data.py) ---
# TS tools call: /api/mlb/teams, /api/mlb/roster, etc. (these already match)


@app.route("/api/mlb/teams")
def api_mlb_teams():
    try:
        result = mlb_data.cmd_teams([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/roster")
def api_mlb_roster():
    try:
        team = request.args.get("team", "")
        if not team:
            return jsonify({"error": "Missing team parameter"}), 400
        result = mlb_data.cmd_roster([team], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/player")
def api_mlb_player():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id parameter"}), 400
        result = mlb_data.cmd_player([player_id], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/stats")
def api_mlb_stats():
    try:
        player_id = request.args.get("player_id", "")
        if not player_id:
            return jsonify({"error": "Missing player_id parameter"}), 400
        args = [player_id]
        season = request.args.get("season", "")
        if season:
            args.append(season)
        result = mlb_data.cmd_stats(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/injuries")
def api_mlb_injuries():
    try:
        result = mlb_data.cmd_injuries([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/standings")
def api_mlb_standings():
    try:
        result = mlb_data.cmd_standings([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/draft")
def api_mlb_draft():
    try:
        year = request.args.get("year", "")
        args = [year] if year else []
        result = mlb_data.cmd_draft(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/schedule")
def api_mlb_schedule():
    try:
        args = []
        date_arg = request.args.get("date", "")
        if date_arg:
            args.append(date_arg)
        result = mlb_data.cmd_schedule(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mlb/weather")
def api_mlb_weather():
    try:
        game_date = request.args.get("date", "")
        args = [game_date] if game_date else []
        result = mlb_data.cmd_weather(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- History (history.py) ---
# TS tools call: /api/league-history, /api/record-book, /api/past-standings, etc.


@app.route("/api/league-history")
def api_league_history():
    try:
        result = history.cmd_league_history([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/record-book")
def api_record_book():
    try:
        result = history.cmd_record_book([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/past-standings")
def api_past_standings():
    try:
        year = request.args.get("year", "")
        if not year:
            return jsonify({"error": "Missing year parameter"}), 400
        result = history.cmd_past_standings([year], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/past-draft")
def api_past_draft():
    try:
        year = request.args.get("year", "")
        if not year:
            return jsonify({"error": "Missing year parameter"}), 400
        args = [year]
        count = request.args.get("count", "")
        if count:
            args.append(count)
        result = history.cmd_past_draft(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/past-teams")
def api_past_teams():
    try:
        year = request.args.get("year", "")
        if not year:
            return jsonify({"error": "Missing year parameter"}), 400
        result = history.cmd_past_teams([year], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/past-trades")
def api_past_trades():
    try:
        year = request.args.get("year", "")
        if not year:
            return jsonify({"error": "Missing year parameter"}), 400
        args = [year]
        count = request.args.get("count", "")
        if count:
            args.append(count)
        result = history.cmd_past_trades(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/past-matchup")
def api_past_matchup():
    try:
        year = request.args.get("year", "")
        week = request.args.get("week", "")
        if not year or not week:
            return jsonify({"error": "Missing year and/or week parameters"}), 400
        result = history.cmd_past_matchup([year, week], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Intel (intel.py) ---


@app.route("/api/intel/player")
def api_intel_player():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        result = intel.cmd_player_report([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/breakouts")
def api_intel_breakouts():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = intel.cmd_breakouts([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/busts")
def api_intel_busts():
    try:
        pos_type = request.args.get("pos_type", "B")
        count = request.args.get("count", "15")
        result = intel.cmd_busts([pos_type, count], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/reddit")
def api_intel_reddit():
    try:
        result = intel.cmd_reddit_buzz([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/trending")
def api_intel_trending():
    try:
        result = intel.cmd_trending([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/prospects")
def api_intel_prospects():
    try:
        result = intel.cmd_prospect_watch([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/transactions")
def api_intel_transactions():
    try:
        days = request.args.get("days", "7")
        result = intel.cmd_transactions([days], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/batch")
def api_intel_batch():
    try:
        names = request.args.get("names", "")
        if not names:
            return jsonify({"error": "Missing names parameter (comma-separated)"}), 400
        name_list = [n.strip() for n in names.split(",") if n.strip()]
        include_str = request.args.get("include", "statcast")
        include = [s.strip() for s in include_str.split(",") if s.strip()]
        result = intel.batch_intel(name_list, include=include)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/intel/statcast-history")
def api_intel_statcast_history():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        days = request.args.get("days", "30")
        result = intel.cmd_statcast_compare([name, days], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Workflow endpoints (aggregate multiple calls for token efficiency) ---


def _safe_call(fn, args=None):
    """Call a cmd_* function with as_json=True, returning error dict on failure"""
    try:
        return fn(args or [], as_json=True)
    except Exception as e:
        return {"_error": str(e)}


def _synthesize_morning_actions(injury, lineup, whats_new, waiver_b, waiver_p):
    """Build priority-ranked action items from morning briefing data"""
    actions = []

    # Critical: injured players in active slots
    for p in (injury or {}).get("injured_active", []):
        actions.append({
            "priority": 1,
            "type": "injury",
            "message": str(p.get("name", "?")) + " (" + str(p.get("status", ""))
                + ") injured in active slot - move to IL or bench",
            "player_id": str(p.get("player_id", "")),
        })

    # Lineup: off-day starters or bench with games
    off_day = (lineup or {}).get("active_off_day", [])
    bench_playing = (lineup or {}).get("bench_playing", [])
    if off_day or bench_playing:
        msg = str(len(off_day)) + " starter(s) off today"
        if bench_playing:
            msg += ", " + str(len(bench_playing)) + " bench player(s) have games"
        actions.append({
            "priority": 2,
            "type": "lineup",
            "message": msg + " - run yahoo_auto_lineup",
        })

    # Pending trades need attention
    for t in (whats_new or {}).get("pending_trades", []):
        actions.append({
            "priority": 2,
            "type": "trade",
            "message": "Pending trade from " + str(t.get("trader_team_name", "?"))
                + " - review and respond",
            "transaction_key": str(t.get("transaction_key", "")),
        })

    # Waiver opportunities: top picks
    for label, waiver in [("batter", waiver_b), ("pitcher", waiver_p)]:
        recs = (waiver or {}).get("recommendations", [])
        if recs:
            top = recs[0]
            actions.append({
                "priority": 3,
                "type": "waiver",
                "message": "Top " + label + " pickup: " + str(top.get("name", "?"))
                    + " (id:" + str(top.get("pid", "?")) + ") score="
                    + str(top.get("score", "?")),
                "player_id": str(top.get("pid", "")),
            })

    # Healthy players stuck on IL
    for p in (injury or {}).get("healthy_il", []):
        actions.append({
            "priority": 3,
            "type": "il_activation",
            "message": str(p.get("name", "?"))
                + " on IL with no injury status - may be activatable",
            "player_id": str(p.get("player_id", "")),
        })

    actions.sort(key=lambda a: a.get("priority", 99))
    return actions


@app.route("/api/workflow/morning-briefing")
def workflow_morning_briefing():
    try:
        injury = _safe_call(season_manager.cmd_injury_report)
        lineup = _safe_call(season_manager.cmd_lineup_optimize)
        matchup = _safe_call(yahoo_fantasy.cmd_matchup_detail)
        strategy = _safe_call(season_manager.cmd_matchup_strategy)
        whats_new = _safe_call(season_manager.cmd_whats_new)
        waiver_b = _safe_call(season_manager.cmd_waiver_analyze, ["B", "5"])
        waiver_p = _safe_call(season_manager.cmd_waiver_analyze, ["P", "5"])

        action_items = _synthesize_morning_actions(
            injury, lineup, whats_new, waiver_b, waiver_p
        )

        # Include next lineup edit date
        edit_date = None
        try:
            _sc, _gm, _lg = yahoo_fantasy.get_league()
            edit_date = str(_lg.edit_date())
        except Exception:
            pass

        return jsonify({
            "action_items": action_items,
            "injury": injury,
            "lineup": lineup,
            "matchup": matchup,
            "strategy": strategy,
            "whats_new": whats_new,
            "waiver_batters": waiver_b,
            "waiver_pitchers": waiver_p,
            "edit_date": edit_date,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/league-landscape")
def workflow_league_landscape():
    try:
        standings = _safe_call(yahoo_fantasy.cmd_standings)
        pace = _safe_call(season_manager.cmd_season_pace)
        power = _safe_call(season_manager.cmd_power_rankings)
        pulse = _safe_call(yahoo_fantasy.cmd_league_pulse)
        transactions = _safe_call(yahoo_fantasy.cmd_transactions, ["", "15"])
        trade_finder = _safe_call(season_manager.cmd_trade_finder)
        scoreboard = _safe_call(yahoo_fantasy.cmd_scoreboard)

        return jsonify({
            "standings": standings,
            "pace": pace,
            "power_rankings": power,
            "league_pulse": pulse,
            "transactions": transactions,
            "trade_finder": trade_finder,
            "scoreboard": scoreboard,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _synthesize_roster_issues(injury, lineup, roster, busts):
    """Build severity-ranked roster issues"""
    issues = []

    # Critical: injured in active slots
    for p in (injury or {}).get("injured_active", []):
        issues.append({
            "severity": "critical",
            "type": "injury",
            "message": str(p.get("name", "?")) + " (" + str(p.get("status", ""))
                + ") injured in active slot",
            "fix": "Move to IL or bench",
            "player_id": str(p.get("player_id", "")),
        })

    # Warning: healthy players on IL
    for p in (injury or {}).get("healthy_il", []):
        issues.append({
            "severity": "warning",
            "type": "il_waste",
            "message": str(p.get("name", "?")) + " on IL with no injury status",
            "fix": "Activate to free IL slot",
            "player_id": str(p.get("player_id", "")),
        })

    # Warning: off-day starters
    for p in (lineup or {}).get("active_off_day", []):
        issues.append({
            "severity": "warning",
            "type": "off_day",
            "message": str(p.get("name", "?")) + " starting but has no game today",
            "fix": "Bench and start an active player",
        })

    # Info: bust candidates on roster
    roster_names = set()
    for p in (roster or {}).get("players", []):
        roster_names.add(str(p.get("name", "")).lower())
    for b in (busts or {}).get("candidates", []):
        if str(b.get("name", "")).lower() in roster_names:
            issues.append({
                "severity": "info",
                "type": "bust_risk",
                "message": str(b.get("name", "?"))
                    + " is a bust candidate (underperforming Statcast metrics)",
                "fix": "Consider replacing if better options available",
            })

    return issues


@app.route("/api/workflow/roster-health")
def workflow_roster_health():
    try:
        injury = _safe_call(season_manager.cmd_injury_report)
        lineup = _safe_call(season_manager.cmd_lineup_optimize)
        roster = _safe_call(yahoo_fantasy.cmd_roster)
        busts = _safe_call(intel.cmd_busts, ["B", "20"])

        issues = _synthesize_roster_issues(injury, lineup, roster, busts)

        return jsonify({
            "issues": issues,
            "injury": injury,
            "lineup": lineup,
            "roster": roster,
            "busts": busts,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _synthesize_waiver_pairs(waiver_b, waiver_p):
    """Pair waiver recommendations with position type labels"""
    pairs = []

    for label, waiver in [("B", waiver_b), ("P", waiver_p)]:
        for rec in (waiver or {}).get("recommendations", [])[:5]:
            pair = {
                "add": {
                    "name": str(rec.get("name", "?")),
                    "player_id": str(rec.get("pid", "")),
                    "positions": str(rec.get("positions", "")),
                    "score": rec.get("score", 0),
                    "percent_owned": rec.get("pct", 0),
                },
                "pos_type": label,
                "weak_categories": [
                    c.get("name", "") for c in
                    (waiver or {}).get("weak_categories", [])
                ],
            }
            pairs.append(pair)

    return pairs


@app.route("/api/workflow/waiver-recommendations")
def workflow_waiver_recommendations():
    try:
        count = request.args.get("count", "5")
        cat_check = _safe_call(season_manager.cmd_category_check)
        waiver_b = _safe_call(season_manager.cmd_waiver_analyze, ["B", count])
        waiver_p = _safe_call(season_manager.cmd_waiver_analyze, ["P", count])
        roster = _safe_call(yahoo_fantasy.cmd_roster)

        pairs = _synthesize_waiver_pairs(waiver_b, waiver_p)

        return jsonify({
            "pairs": pairs,
            "category_check": cat_check,
            "waiver_batters": waiver_b,
            "waiver_pitchers": waiver_p,
            "roster": roster,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/trade-analysis", methods=["POST"])
def workflow_trade_analysis():
    try:
        data = request.get_json(silent=True) or {}
        give_names = data.get("give_names", [])
        get_names = data.get("get_names", [])
        if not give_names or not get_names:
            return jsonify({"error": "Missing give_names and/or get_names arrays"}), 400

        # Resolve player names to IDs via value lookup
        give_players = []
        get_players = []
        give_ids = []
        get_ids = []

        # Fetch roster once for give-player ID lookups
        roster = _safe_call(yahoo_fantasy.cmd_roster)
        roster_players = (roster or {}).get("players", [])

        for name in give_names:
            try:
                val = valuations.cmd_value([name], as_json=True)
                players = val.get("players", [])
                if players:
                    p = players[0]
                    give_players.append(p)
                    for rp in roster_players:
                        if str(rp.get("name", "")).lower() == str(p.get("name", "")).lower():
                            give_ids.append(str(rp.get("player_id", "")))
                            break
            except Exception:
                give_players.append({"name": name, "_error": "not found"})

        for name in get_names:
            try:
                val = valuations.cmd_value([name], as_json=True)
                players = val.get("players", [])
                if players:
                    p = players[0]
                    get_players.append(p)
                    # Try search for player ID
                    search = _safe_call(yahoo_fantasy.cmd_search, [name])
                    for rp in (search or {}).get("results", []):
                        if str(rp.get("name", "")).lower() == str(p.get("name", "")).lower():
                            get_ids.append(str(rp.get("player_id", "")))
                            break
            except Exception:
                get_players.append({"name": name, "_error": "not found"})

        # Run trade eval if we have IDs
        trade_eval = None
        if give_ids and get_ids:
            try:
                trade_eval = season_manager.cmd_trade_eval(
                    [",".join(give_ids), ",".join(get_ids)], as_json=True
                )
            except Exception as e:
                trade_eval = {"_error": str(e)}

        # Get intel for each player
        all_names = give_names + get_names
        intel_data = {}
        for name in all_names:
            try:
                intel_data[name] = intel.cmd_player_report([name], as_json=True)
            except Exception:
                intel_data[name] = {"_error": "unavailable"}

        return jsonify({
            "give_players": give_players,
            "get_players": get_players,
            "give_ids": give_ids,
            "get_ids": get_ids,
            "trade_eval": trade_eval,
            "intel": intel_data,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/game-day-manager")
def workflow_game_day_manager():
    try:
        data = season_manager.cmd_game_day_manager([], as_json=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/waiver-deadline-prep")
def workflow_waiver_deadline_prep():
    try:
        count = request.args.get("count", "5")
        data = season_manager.cmd_waiver_deadline_prep([count], as_json=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/trade-pipeline")
def workflow_trade_pipeline():
    try:
        data = season_manager.cmd_trade_pipeline([], as_json=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/weekly-digest")
def workflow_weekly_digest():
    try:
        data = season_manager.cmd_weekly_digest([], as_json=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/workflow/season-checkpoint")
def workflow_season_checkpoint():
    try:
        data = season_manager.cmd_season_checkpoint([], as_json=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- News (RotoWire RSS) ---


@app.route("/api/news")
def api_news():
    try:
        limit = request.args.get("limit", "20")
        result = news.cmd_news([limit], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/news/player")
def api_news_player():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        result = news.cmd_news_player([name], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/news/feed")
def api_news_feed():
    try:
        sources = request.args.get("sources", None)
        player = request.args.get("player", None)
        limit = int(request.args.get("limit", "30"))
        entries = news.fetch_aggregated_news(sources=sources, player=player, limit=limit)
        source_set = sorted(set(e.get("source", "") for e in entries if e.get("source")))
        return jsonify({"entries": entries, "sources": source_set, "count": len(entries)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/news/sources")
def api_news_sources():
    try:
        result = news.cmd_news_sources([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Strategy / Advanced Analysis ---


@app.route("/api/probable-pitchers")
def api_probable_pitchers():
    try:
        days = request.args.get("days", "7")
        result = season_manager.fetch_probable_pitchers(int(days))
        return jsonify({"pitchers": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule-analysis")
def api_schedule_analysis():
    try:
        team_name = request.args.get("team", "")
        days = request.args.get("days", "14")
        if not team_name:
            return jsonify({"error": "Missing team parameter"}), 400
        result = season_manager.analyze_schedule_density(team_name, int(days))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/category-impact", methods=["POST"])
def api_category_impact():
    try:
        data = request.get_json(silent=True) or {}
        add_players = data.get("add_players", [])
        drop_players = data.get("drop_players", [])
        result = valuations.project_category_impact(add_players, drop_players)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/regression-candidates")
def api_regression_candidates():
    try:
        result = intel.detect_regression_candidates()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/player-tier")
def api_player_tier():
    try:
        name = request.args.get("name", "")
        if not name:
            return jsonify({"error": "Missing name parameter"}), 400
        result = valuations.get_player_zscore(name)
        if result is None:
            return jsonify({"error": "Player not found: " + name}), 404
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cache-stats", methods=["GET"])
def api_cache_stats():
    try:
        from intel import _cache_manager
        return jsonify(_cache_manager.stats())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cache-clear", methods=["POST"])
def api_cache_clear():
    try:
        from intel import _cache_manager
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        _cache_manager.clear(key)
        return jsonify({"cleared": key or "all"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trash-talk")
def api_trash_talk():
    try:
        intensity = request.args.get("intensity", "competitive")
        result = season_manager.cmd_trash_talk([intensity], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rival-history")
def api_rival_history():
    try:
        opponent = request.args.get("opponent", "")
        args = [opponent] if opponent else []
        result = season_manager.cmd_rival_history(args, as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/achievements")
def api_achievements():
    try:
        result = season_manager.cmd_achievements([], as_json=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("API_PORT", "8766"))
    app.run(host="0.0.0.0", port=port)
