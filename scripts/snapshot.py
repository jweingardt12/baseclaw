#!/usr/bin/env python3
"""Weekly snapshot — saves projections, roster, standings, and metadata."""

import os
import sys
import json
import shutil
import sqlite3
import argparse
from datetime import datetime

from shared import get_league_context

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "season.db")


def take_snapshot(week=None):
    """Save weekly state to data/snapshots/{year}/week_{NN}/."""
    try:
        sc, gm, lg, team = get_league_context()
    except Exception as e:
        print("Error connecting to Yahoo API: " + str(e))
        sys.exit(1)

    if week is None:
        try:
            week = lg.current_week()
        except Exception as e:
            print("Error getting current week: " + str(e))
            sys.exit(1)

    year = datetime.now().year
    week_str = str(week).zfill(2)
    snap_dir = os.path.join(DATA_DIR, "snapshots", str(year), "week_" + week_str)
    os.makedirs(snap_dir, exist_ok=True)

    # 1. Copy projection CSVs
    for fname in ["projections_hitters.csv", "projections_pitchers.csv"]:
        src = os.path.join(DATA_DIR, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(snap_dir, fname))
            print("Copied " + fname)
        else:
            print("Warning: " + fname + " not found, skipping")

    # 2. Dump roster
    try:
        roster_data = team.roster()
        with open(os.path.join(snap_dir, "roster.json"), "w") as fh:
            json.dump(roster_data, fh, indent=2, default=str)
        print("Saved roster (" + str(len(roster_data)) + " players)")
    except Exception as e:
        print("Error saving roster: " + str(e))

    # 3. Dump category standings from season.db
    try:
        if os.path.exists(DB_PATH):
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM category_history")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            with open(os.path.join(snap_dir, "category_standings.json"), "w") as fh:
                json.dump(rows, fh, indent=2, default=str)
            print("Saved category standings (" + str(len(rows)) + " rows)")
        else:
            print("Warning: season.db not found, skipping standings")
    except Exception as e:
        print("Error saving standings: " + str(e))

    # 4. Write metadata
    metadata = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "week": week,
        "year": year,
    }
    with open(os.path.join(snap_dir, "metadata.json"), "w") as fh:
        json.dump(metadata, fh, indent=2)
    print("Snapshot saved to " + snap_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Save weekly state snapshot")
    parser.add_argument("week", nargs="?", type=int, default=None,
                        help="Week number (default: current week from API)")
    args = parser.parse_args()
    take_snapshot(args.week)
