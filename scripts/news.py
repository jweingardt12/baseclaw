#!/usr/bin/env python3
"""Fantasy Baseball News Feed - Multi-Source Aggregator

Aggregates fantasy baseball news from 16 sources:
- RotoWire MLB, ESPN MLB, FanGraphs, CBS Sports MLB, Yahoo MLB, MLB.com
- Pitcher List, Razzball, Google News MLB, RotoBaller
- Reddit r/fantasybaseball (JSON API)
- Pitcher List (Bluesky), Baseball America (Bluesky), Mr. Cheatsheet (Bluesky)
- Joe Orrico (Bluesky), Fantasy Six Pack (Bluesky)

Also supports player name matching to link news to roster players.
"""

import sys
import os
import time
import re
import json
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared import USER_AGENT, cache_get, cache_set, normalize_player_name, reddit_get

# Cache
_cache = {}
TTL_NEWS = 900      # 15 minutes (breaking news sources)
TTL_ANALYSIS = 1800  # 30 minutes (analysis/editorial sources)

# Injury keywords to detect in titles and descriptions
INJURY_KEYWORDS = [
    "injury", "injured", "disabled list", "day-to-day", "dtd",
    "out for", "miss", "surgery", "rehab", "strain", "sprain", "fracture",
    "torn", "inflammation", "concussion", "oblique", "hamstring", "shoulder",
    "elbow", "knee", "ankle", "back", "wrist", "tommy john", "ucl",
    "setback", "shut down", "shelved", "sidelined",
]

# Pre-compiled regexes
_TZ_ABBR_RE = re.compile(r"\s+[A-Z]{2,5}$")
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# ============================================================
# 1. Feed Registry
# ============================================================

# Feeds disabled via NEWS_FEEDS_DISABLED env var (comma-separated source IDs)
_disabled_feeds = set(
    s.strip().lower()
    for s in os.environ.get("NEWS_FEEDS_DISABLED", "").split(",")
    if s.strip()
)

FEED_REGISTRY = {
    "rotowire": {
        "url": "https://www.rotowire.com/rss/news.htm?sport=MLB",
        "name": "RotoWire MLB",
        "ttl": TTL_NEWS,
        "enabled": "rotowire" not in _disabled_feeds,
    },
    "espn": {
        "url": "https://www.espn.com/espn/rss/mlb/news",
        "name": "ESPN MLB",
        "ttl": TTL_NEWS,
        "enabled": "espn" not in _disabled_feeds,
    },
    "fangraphs": {
        "url": "https://fantasy.fangraphs.com/feed/",
        "name": "FanGraphs",
        "ttl": TTL_ANALYSIS,
        "enabled": "fangraphs" not in _disabled_feeds,
    },
    "cbs": {
        "url": "https://www.cbssports.com/rss/headlines/mlb/",
        "name": "CBS Sports MLB",
        "ttl": TTL_NEWS,
        "enabled": "cbs" not in _disabled_feeds,
    },
    "yahoo": {
        "url": "https://sports.yahoo.com/mlb/rss.xml",
        "name": "Yahoo MLB",
        "ttl": TTL_NEWS,
        "enabled": "yahoo" not in _disabled_feeds,
    },
    "mlb": {
        "url": "https://www.mlb.com/feeds/news/rss.xml",
        "name": "MLB.com",
        "ttl": TTL_NEWS,
        "enabled": "mlb" not in _disabled_feeds,
    },
    "pitcherlist": {
        "url": "https://pitcherlist.com/feed",
        "name": "Pitcher List",
        "ttl": TTL_ANALYSIS,
        "enabled": "pitcherlist" not in _disabled_feeds,
    },
    "razzball": {
        "url": "https://razzball.com/feed/",
        "name": "Razzball",
        "ttl": TTL_ANALYSIS,
        "enabled": "razzball" not in _disabled_feeds,
    },
    "google": {
        "url": "https://news.google.com/rss/search?q=MLB+baseball&hl=en-US&gl=US&ceid=US:en",
        "name": "Google News MLB",
        "ttl": TTL_NEWS,
        "enabled": "google" not in _disabled_feeds,
    },
    "reddit": {
        "url": "https://www.reddit.com/r/fantasybaseball/hot.json?limit=50",
        "name": "Reddit r/fantasybaseball",
        "ttl": TTL_NEWS,
        "enabled": "reddit" not in _disabled_feeds,
        "fetcher": "reddit",
    },
    "rotoballer": {
        "url": "https://www.rotoballer.com/feed",
        "name": "RotoBaller",
        "ttl": TTL_ANALYSIS,
        "enabled": "rotoballer" not in _disabled_feeds,
    },
    "bsky_pitcherlist": {
        "url": "https://bsky.app/profile/pitcherlist.com/rss",
        "name": "Pitcher List (Bluesky)",
        "ttl": TTL_ANALYSIS,
        "enabled": "bsky_pitcherlist" not in _disabled_feeds,
    },
    "bsky_baseballamerica": {
        "url": "https://bsky.app/profile/baseballamerica.com/rss",
        "name": "Baseball America (Bluesky)",
        "ttl": TTL_ANALYSIS,
        "enabled": "bsky_baseballamerica" not in _disabled_feeds,
    },
    "bsky_mrcheatsheet": {
        "url": "https://bsky.app/profile/mrcheatsheet.bsky.social/rss",
        "name": "Mr. Cheatsheet (Bluesky)",
        "ttl": TTL_ANALYSIS,
        "enabled": "bsky_mrcheatsheet" not in _disabled_feeds,
    },
    "bsky_joeorrico": {
        "url": "https://bsky.app/profile/joeorrico99.bsky.social/rss",
        "name": "Joe Orrico (Bluesky)",
        "ttl": TTL_ANALYSIS,
        "enabled": "bsky_joeorrico" not in _disabled_feeds,
    },
    "bsky_sixpack": {
        "url": "https://bsky.app/profile/fantasysixpack.net/rss",
        "name": "Fantasy Six Pack (Bluesky)",
        "ttl": TTL_ANALYSIS,
        "enabled": "bsky_sixpack" not in _disabled_feeds,
    },
}


# ============================================================
# 2. Cache Helpers
# ============================================================

def _cache_get(key, ttl_seconds):
    """Get cached value if not expired"""
    return cache_get(_cache, key, ttl_seconds)


def _cache_set(key, data):
    """Store value in cache with current timestamp"""
    cache_set(_cache, key, data)


# ============================================================
# 3. Name Matching
# ============================================================

def _normalize_name(name):
    """Normalize player name for matching across sources"""
    return normalize_player_name(name)


def _names_match(name_a, name_b):
    """Check if two player names match (fuzzy)"""
    norm_a = _normalize_name(name_a)
    norm_b = _normalize_name(name_b)
    if not norm_a or not norm_b:
        return False
    if norm_a == norm_b:
        return True
    if norm_a in norm_b or norm_b in norm_a:
        return True
    parts_a = norm_a.split()
    parts_b = norm_b.split()
    if len(parts_a) >= 2 and len(parts_b) >= 2:
        if parts_a[-1] == parts_b[-1] and parts_a[0][0] == parts_b[0][0]:
            return True
    return False


# ============================================================
# 4. RSS Feed Parsing
# ============================================================

def _extract_player_name(title):
    """Try to extract player name from RSS title.

    Common formats:
    - "Player Name - Some headline" (RotoWire)
    - "Player Name: headline" (various)
    """
    if not title:
        return ""
    if " - " in title:
        candidate = title.split(" - ", 1)[0].strip()
        words = candidate.split()
        if 1 <= len(words) <= 4 and not any(c.isdigit() for c in candidate):
            return candidate
    if ": " in title:
        candidate = title.split(": ", 1)[0].strip()
        words = candidate.split()
        if 1 <= len(words) <= 4 and not any(c.isdigit() for c in candidate):
            return candidate
    return ""


_IL_RE = re.compile(r"\bil\b", re.I)


def _detect_injury(title, description):
    """Check if the news item is injury-related"""
    text = ((title or "") + " " + (description or "")).lower()
    for keyword in INJURY_KEYWORDS:
        if keyword in text:
            return True
    # Check "IL" separately with word boundary to avoid matching "likely" etc.
    if _IL_RE.search(text):
        return True
    return False


def _parse_pub_date(date_str):
    """Parse RSS pubDate string to ISO format timestamp"""
    if not date_str:
        return ""
    s = date_str.strip()
    # Strip timezone abbreviations like EST, PST, CDT that strptime can't parse
    s = _TZ_ABBR_RE.sub("", s)
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%d %b %Y %H:%M %z",
        "%d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return date_str.strip()


def _parse_rss_items(raw_xml):
    """Parse RSS/Atom XML into a list of (title, link, description, pub_date) tuples."""
    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError as e:
        print("Error parsing RSS XML: " + str(e))
        return []

    items = []

    # RSS 2.0: rss > channel > item
    channel = root.find("channel")
    if channel is not None:
        for item in channel.findall("item"):
            items.append((
                (item.findtext("title") or "").strip(),
                (item.findtext("link") or "").strip(),
                (item.findtext("description") or "").strip(),
                (item.findtext("pubDate") or "").strip(),
            ))
        return items

    # Atom: feed > entry
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("atom:entry", ns):
        link_el = entry.find("atom:link", ns)
        link = (link_el.get("href", "") if link_el is not None else "").strip()
        items.append((
            (entry.findtext("atom:title", "", ns)).strip(),
            link,
            (entry.findtext("atom:summary", "", ns) or entry.findtext("atom:content", "", ns) or "").strip(),
            (entry.findtext("atom:published", "", ns) or entry.findtext("atom:updated", "", ns) or "").strip(),
        ))

    # Fallback: items anywhere in tree
    if not items:
        for item in root.findall(".//item"):
            items.append((
                (item.findtext("title") or "").strip(),
                (item.findtext("link") or "").strip(),
                (item.findtext("description") or "").strip(),
                (item.findtext("pubDate") or "").strip(),
            ))

    return items


def _fetch_rss_feed(url, source_name, ttl=TTL_NEWS):
    """Fetch and parse a single RSS feed. Returns list of news entry dicts."""
    cache_key = "feed_" + source_name
    cached = _cache_get(cache_key, ttl)
    if cached is not None:
        return cached

    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as response:
            raw_xml = response.read().decode("utf-8")
    except Exception as e:
        print("Error fetching " + source_name + " RSS: " + str(e))
        return []

    raw_items = _parse_rss_items(raw_xml)
    entries = []
    for title, link, description, pub_date in raw_items:
        player = _extract_player_name(title)
        headline = title
        if player and " - " in title:
            headline = title.split(" - ", 1)[1].strip()
        elif player and ": " in title:
            headline = title.split(": ", 1)[1].strip()

        # Strip HTML tags from description
        clean_desc = description
        if "<" in clean_desc:
            clean_desc = _HTML_TAG_RE.sub("", clean_desc).strip()

        entries.append({
            "source": source_name,
            "player": player,
            "headline": headline,
            "summary": clean_desc[:500] if clean_desc else "",
            "timestamp": _parse_pub_date(pub_date),
            "injury_flag": _detect_injury(title, description),
            "link": link,
            "raw_title": title,
        })

    _cache_set(cache_key, entries)
    return entries


# ============================================================
# 4b. Reddit JSON Feed Fetcher
# ============================================================

def _fetch_reddit_news():
    """Fetch r/fantasybaseball hot posts and convert to news entry format."""
    source_name = FEED_REGISTRY["reddit"]["name"]
    cache_key = "feed_" + source_name
    ttl = FEED_REGISTRY["reddit"]["ttl"]

    cached = _cache_get(cache_key, ttl)
    if cached is not None:
        return cached

    data = reddit_get("/r/fantasybaseball/hot.json?limit=50")
    if not data:
        return []

    entries = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        title = post.get("title", "")
        score = post.get("score", 0)
        num_comments = post.get("num_comments", 0)
        created_utc = post.get("created_utc", 0)
        flair = post.get("link_flair_text", "") or ""
        post_id = post.get("id", "")

        # Timestamp from unix epoch
        ts = ""
        if created_utc:
            try:
                ts = datetime.fromtimestamp(created_utc, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                pass

        # Summary includes engagement context
        summary = ""
        if flair:
            summary = "[" + flair + "] "
        summary = summary + str(score) + " pts, " + str(num_comments) + " comments"

        entries.append({
            "source": source_name,
            "player": "",
            "headline": title,
            "summary": summary,
            "timestamp": ts,
            "injury_flag": _detect_injury(title, ""),
            "link": "https://www.reddit.com/r/fantasybaseball/comments/" + post_id,
            "raw_title": title,
        })

    _cache_set(cache_key, entries)
    return entries


# ============================================================
# 5. Legacy RotoWire Fetch (backward compat)
# ============================================================

def fetch_news():
    """Fetch and parse RotoWire RSS feed. Returns list of news entries."""
    rw = FEED_REGISTRY["rotowire"]
    return _fetch_rss_feed(rw["url"], rw["name"], rw["ttl"])


# ============================================================
# 6. Aggregated Multi-Source Fetch
# ============================================================

def _headline_key(headline):
    """Normalize headline for deduplication."""
    return headline.lower()[:80].strip() if headline else ""


def fetch_aggregated_news(sources=None, player=None, limit=50):
    """Fetch news from all enabled feeds (or a specific subset), merge and deduplicate.

    Args:
        sources: comma-separated source IDs or list. None = all enabled.
        player: optional player name to filter results.
        limit: max entries to return.
    Returns:
        list of news entry dicts sorted by timestamp descending.
    """
    if isinstance(sources, str):
        source_ids = [s.strip().lower() for s in sources.split(",") if s.strip()]
    elif isinstance(sources, list):
        source_ids = [s.strip().lower() for s in sources if s.strip()]
    else:
        source_ids = None

    feeds_to_fetch = [
        (fid, finfo) for fid, finfo in FEED_REGISTRY.items()
        if finfo.get("enabled") and (not source_ids or fid in source_ids)
    ]

    def _fetch_one(fid, finfo):
        if finfo.get("fetcher") == "reddit":
            return _fetch_reddit_news()
        return _fetch_rss_feed(finfo["url"], finfo["name"], finfo.get("ttl", TTL_NEWS))

    all_entries = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_fetch_one, fid, finfo): fid for fid, finfo in feeds_to_fetch}
        for fut in as_completed(futures):
            try:
                all_entries.extend(fut.result())
            except Exception as e:
                print("Feed fetch error (" + futures[fut] + "): " + str(e))

    # Deduplicate by headline similarity
    seen = set()
    unique = []
    for entry in all_entries:
        key = _headline_key(entry.get("headline", "") or entry.get("raw_title", ""))
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        unique.append(entry)

    # Sort by timestamp descending (most recent first)
    unique.sort(key=lambda e: e.get("timestamp", ""), reverse=True)

    # Filter by player if specified
    if player:
        player_lower = player.lower()
        parts = player_lower.split()
        last_name = parts[-1] if len(parts) >= 2 else ""
        first_name = parts[0] if len(parts) >= 2 else ""
        unique = [
            e for e in unique
            if _names_match(player, e.get("player", ""))
            or player_lower in (
                e.get("headline", "") + " " + e.get("summary", "") + " " + e.get("raw_title", "")
            ).lower()
            or (last_name and len(last_name) > 3
                and last_name in (
                    e.get("headline", "") + " " + e.get("summary", "") + " " + e.get("raw_title", "")
                ).lower()
                and first_name in (
                    e.get("headline", "") + " " + e.get("summary", "") + " " + e.get("raw_title", "")
                ).lower())
        ]

    return unique[:limit]


# ============================================================
# 7. Player News Filtering (multi-source)
# ============================================================

def get_player_news(player_name, limit=5):
    """Get news for a specific player by name matching across all sources."""
    return fetch_aggregated_news(player=player_name, limit=limit)


# ============================================================
# 8. Player Context Lookup (for decision tools)
# ============================================================

# Context cache: 5-min TTL per player
_context_cache = {}
_CONTEXT_TTL = 300

# Dealbreaker/warning/info keywords for transaction scanning
_DEALBREAKER_KEYWORDS = [
    "released", "dfa", "designated for assignment", "optioned", "sent to minors",
    "outrighted", "non-tendered", "unconditional release",
    "60-day injured list", "season-ending", "out for season", "out for the year",
]
_WARNING_KEYWORDS = [
    "placed on", "injured list", "day-to-day",
    "bullpen", "reliever", "moved to bullpen", "begin in bullpen",
    "may skip start", "skip start", "scratched", "not in lineup",
    "demoted", "lost job", "loses closer", "loses role",
]
_INFO_KEYWORDS = [
    "called up", "activated", "signed", "selected", "recalled", "contract purchased",
    "named closer", "closing", "promoted", "return from",
]

# Reddit sentiment keywords for player context
_BULLISH_KW = ["add", "pickup", "breakout", "buy", "stash", "sleeper", "must-add", "fire"]
_BEARISH_KW = ["drop", "sell", "bust", "avoid", "droppable", "overrated", "concern"]

# Injury severity keywords
SEVERITY_KEYWORDS = {
    "day-to-day": "MINOR", "dtd": "MINOR", "not serious": "MINOR",
    "precautionary": "MINOR", "minor": "MINOR", "bruise": "MINOR",
    "soreness": "MINOR", "cramp": "MINOR", "fatigue": "MINOR",
    "tightness": "MODERATE", "strain": "MODERATE", "sprain": "MODERATE",
    "hamstring": "MODERATE", "oblique": "MODERATE", "shoulder": "MODERATE",
    "back": "MODERATE", "groin": "MODERATE", "calf": "MODERATE",
    "knee": "MODERATE", "ankle": "MODERATE", "wrist": "MODERATE",
    "elbow": "MODERATE", "inflammation": "MODERATE", "contusion": "MODERATE",
    "surgery": "SEVERE", "torn": "SEVERE", "fracture": "SEVERE",
    "broken": "SEVERE", "out for season": "SEVERE", "tommy john": "SEVERE",
    "ucl": "SEVERE", "acl": "SEVERE", "labrum": "SEVERE", "rotator cuff": "SEVERE",
}


def get_player_context(player_name, days=14):
    """Get recent news and transaction context for a player.

    Returns dict:
        headlines: list of {source, title, date, injury_flag}
        transactions: list of {type, date, description, team}
        flags: list of {type: DEALBREAKER|WARNING|INFO, message, detail}
        injury_severity: str or None (MINOR/MODERATE/SEVERE)
    """
    if not player_name:
        return {"headlines": [], "transactions": [], "flags": []}

    cache_key = player_name.lower().strip()
    cached = cache_get(_context_cache, cache_key, _CONTEXT_TTL)
    if cached is not None:
        return cached

    # 1. News headlines
    headlines = []
    try:
        entries = get_player_news(player_name, limit=5)
        for e in entries:
            headlines.append({
                "source": e.get("source", ""),
                "title": e.get("raw_title", e.get("headline", "")),
                "date": e.get("timestamp", ""),
                "injury_flag": e.get("injury_flag", False),
                "link": e.get("link", ""),
            })
    except Exception:
        pass

    # 2. Transaction history
    transactions = []
    try:
        from intel import _fetch_mlb_transactions
        all_tx = _fetch_mlb_transactions(days=days)
        pname_lower = player_name.lower()
        for tx in all_tx:
            if (pname_lower in tx.get("player_name", "").lower()
                    or pname_lower in tx.get("description", "").lower()):
                transactions.append({
                    "type": tx.get("type", ""),
                    "date": tx.get("date", ""),
                    "description": tx.get("description", ""),
                    "team": tx.get("team", ""),
                })
    except Exception:
        pass

    # 3. Build flags from transactions and headlines
    flags = []
    all_text = ""
    for tx in transactions:
        all_text = all_text + " " + tx.get("description", "").lower() + " " + tx.get("type", "").lower()
    for h in headlines:
        all_text = all_text + " " + h.get("title", "").lower()

    def _find_detail(kw):
        for tx in transactions:
            if kw in (tx.get("description", "") + " " + tx.get("type", "")).lower():
                return tx.get("description", "")
        for h in headlines:
            if kw in h.get("title", "").lower():
                return h.get("title", "")
        return ""

    # Scan keywords by priority: dealbreaker blocks warning, info always checked
    def _scan_first(keywords, flag_type):
        for kw in keywords:
            if kw in all_text:
                flags.append({
                    "type": flag_type,
                    "message": player_name + " " + kw,
                    "detail": _find_detail(kw),
                })
                return True
        return False

    found_dealbreaker = _scan_first(_DEALBREAKER_KEYWORDS, "DEALBREAKER")
    if not found_dealbreaker:
        _scan_first(_WARNING_KEYWORDS, "WARNING")
    _scan_first(_INFO_KEYWORDS, "INFO")

    # 4. Injury severity from headlines
    injury_severity = None
    for h in headlines:
        title_lower = h.get("title", "").lower()
        for kw, sev in SEVERITY_KEYWORDS.items():
            if kw in title_lower:
                injury_severity = sev
                break
        if injury_severity:
            break

    # 5. Reddit sentiment
    reddit = {"mentions": 0, "sentiment": "neutral", "summary": ""}
    try:
        from intel import _search_reddit_player
        posts = _search_reddit_player(player_name)
        if posts:
            reddit["mentions"] = len(posts)
            total_comments = sum(p.get("num_comments", 0) for p in posts)
            bullish = sum(1 for p in posts if any(kw in p.get("title", "").lower() for kw in _BULLISH_KW))
            bearish = sum(1 for p in posts if any(kw in p.get("title", "").lower() for kw in _BEARISH_KW))
            if bullish > bearish:
                reddit["sentiment"] = "bullish"
            elif bearish > bullish:
                reddit["sentiment"] = "bearish"
            elif len(posts) >= 3:
                reddit["sentiment"] = "mixed"
            reddit["summary"] = (str(len(posts)) + " Reddit mentions, "
                                + str(total_comments) + " comments, "
                                + "sentiment: " + reddit.get("sentiment", "neutral"))
    except Exception:
        pass

    result = {
        "headlines": headlines,
        "transactions": transactions,
        "flags": flags,
        "injury_severity": injury_severity,
        "reddit": reddit,
    }
    cache_set(_context_cache, cache_key, result)
    return result


# ============================================================
# 9. CLI Commands
# ============================================================

def cmd_news(args, as_json=False):
    """Show recent fantasy baseball news (RotoWire)"""
    limit = 20
    if args:
        try:
            limit = int(args[0])
        except ValueError:
            limit = 20

    entries = fetch_news()
    if not entries:
        if as_json:
            return {"news": [], "note": "No news fetched from RotoWire"}
        print("No news fetched from RotoWire RSS feed")
        return

    entries = entries[:limit]

    if as_json:
        return {"news": entries, "count": len(entries)}

    print("RotoWire MLB News")
    print("=" * 70)
    for entry in entries:
        player = entry.get("player", "")
        headline = entry.get("headline", "")
        timestamp = entry.get("timestamp", "")
        injury = entry.get("injury_flag", False)

        injury_tag = " [INJURY]" if injury else ""
        if player:
            print("")
            print("  " + player + injury_tag)
            print("  " + headline)
        else:
            print("")
            print("  " + entry.get("raw_title", "") + injury_tag)

        if timestamp:
            print("  " + timestamp)

        summary = entry.get("summary", "")
        if summary:
            if len(summary) > 200:
                summary = summary[:197] + "..."
            print("  " + summary)


def cmd_news_player(args, as_json=False):
    """Show news for a specific player"""
    if not args:
        if as_json:
            return {"error": "Player name required"}
        print("Usage: news.py news-player <player_name>")
        return

    player_name = " ".join(args)
    limit = 5

    matches = get_player_news(player_name, limit=limit)
    if not matches:
        if as_json:
            return {"news": [], "player": player_name, "note": "No news found for " + player_name}
        print("No news found for: " + player_name)
        return

    if as_json:
        return {"news": matches, "player": player_name, "count": len(matches)}

    print("News for: " + player_name)
    print("=" * 70)
    for entry in matches:
        source = entry.get("source", "")
        headline = entry.get("headline", "")
        timestamp = entry.get("timestamp", "")
        injury = entry.get("injury_flag", False)

        source_tag = " [" + source + "]" if source else ""
        injury_tag = " [INJURY]" if injury else ""
        print("")
        print("  " + headline + source_tag + injury_tag)
        if timestamp:
            print("  " + timestamp)
        summary = entry.get("summary", "")
        if summary:
            if len(summary) > 200:
                summary = summary[:197] + "..."
            print("  " + summary)


def cmd_news_feed(args, as_json=False):
    """Show aggregated news from all sources"""
    sources = None
    player = None
    limit = 30

    # Parse args: [sources] [limit] or --source=X --player=Y --limit=N
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("--source="):
            sources = arg.split("=", 1)[1]
        elif arg.startswith("--player="):
            player = arg.split("=", 1)[1]
        elif arg.startswith("--limit="):
            try:
                limit = int(arg.split("=", 1)[1])
            except ValueError:
                pass
        else:
            try:
                limit = int(arg)
            except ValueError:
                sources = arg
        i += 1

    entries = fetch_aggregated_news(sources=sources, player=player, limit=limit)

    if as_json:
        source_set = sorted(set(e.get("source", "") for e in entries if e.get("source")))
        return {"entries": entries, "sources": source_set, "count": len(entries)}

    if not entries:
        print("No news found")
        return

    print("Fantasy Baseball News Feed")
    print("=" * 70)
    for entry in entries:
        source = entry.get("source", "")
        player_name = entry.get("player", "")
        headline = entry.get("headline", "")
        timestamp = entry.get("timestamp", "")
        injury = entry.get("injury_flag", False)

        source_tag = "[" + source + "] " if source else ""
        injury_tag = " [INJURY]" if injury else ""
        print("")
        if player_name:
            print("  " + source_tag + player_name + injury_tag)
            print("  " + headline)
        else:
            print("  " + source_tag + headline + injury_tag)
        if timestamp:
            print("  " + timestamp)


def cmd_news_sources(args, as_json=False):
    """List available news sources and their status"""
    sources = []
    for fid, finfo in FEED_REGISTRY.items():
        cache_key = "feed_" + finfo["name"]
        cached_entry = _cache.get(cache_key)
        last_fetch = None
        item_count = 0
        if cached_entry:
            data, fetch_time = cached_entry
            last_fetch = datetime.fromtimestamp(fetch_time).strftime("%Y-%m-%d %H:%M:%S")
            item_count = len(data) if isinstance(data, list) else 0

        sources.append({
            "id": fid,
            "name": finfo["name"],
            "url": finfo["url"],
            "ttl": finfo["ttl"],
            "enabled": finfo.get("enabled", True),
            "last_fetch": last_fetch,
            "item_count": item_count,
        })

    if as_json:
        return {"sources": sources}

    print("News Sources")
    print("=" * 70)
    for s in sources:
        status = "enabled" if s["enabled"] else "DISABLED"
        cached = ""
        if s.get("last_fetch"):
            cached = " (cached: " + str(s["item_count"]) + " items, " + s["last_fetch"] + ")"
        print("  " + s["id"].ljust(22) + s["name"].ljust(28) + status + cached)


# ============================================================
# 9. Command Dispatch
# ============================================================

COMMANDS = {
    "news": cmd_news,
    "news-player": cmd_news_player,
    "news-feed": cmd_news_feed,
    "news-sources": cmd_news_sources,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Fantasy Baseball News Feed - Multi-Source RSS Aggregator")
        print("Usage: news.py <command> [args]")
        print("")
        print("Commands:")
        for name in COMMANDS:
            doc = COMMANDS[name].__doc__ or ""
            print("  " + name.ljust(15) + doc.strip())
        sys.exit(1)
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd in COMMANDS:
        COMMANDS[cmd](args)
    else:
        print("Unknown command: " + cmd)
