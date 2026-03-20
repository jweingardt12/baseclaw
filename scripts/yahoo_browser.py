#!/usr/bin/env python3
"""Yahoo Fantasy Browser Automation for Write Operations

Yahoo removed write (fspt-w) OAuth scope from new developer apps in Oct 2025.
This module uses Playwright + Chromium to perform write operations via the
Yahoo Fantasy website directly, as a fallback when the API rejects writes.

Session management:
  - storageState saved to /app/config/yahoo_session.json
  - Yahoo cookies last 2-4 weeks
  - Run `./yf browser-login` to set up or refresh the session
"""

import os
import sys
import json
import time

LEAGUE_ID = os.environ.get("LEAGUE_ID", "")
TEAM_ID = os.environ.get("TEAM_ID", "")
SESSION_FILE = os.environ.get("YAHOO_SESSION_FILE", "/app/config/yahoo_session.json")

# Derive the league number from LEAGUE_ID (e.g. "469.l.16960" -> "16960")
_parts = LEAGUE_ID.split(".") if LEAGUE_ID else []
LEAGUE_NUM = _parts[-1] if len(_parts) >= 3 else ""
GAME_KEY = _parts[0] if _parts else ""

# Derive team number from TEAM_ID (e.g. "469.l.16960.t.12" -> "12")
_team_parts = TEAM_ID.split(".") if TEAM_ID else []
TEAM_NUM = _team_parts[-1] if len(_team_parts) >= 5 else ""

BASE_URL = "https://baseball.fantasysports.yahoo.com"

# Heartbeat state — written by refresh_session(), read by is_session_valid()
_heartbeat = {"last_ok": None, "last_error": None}

# Reusable selectors
_CONFIRM_SELECTOR = "button[type='submit'], input[type='submit'], .Btn-primary, [data-tst='confirm']"
_ERROR_SELECTOR = ".ysf-error, .error, .Alert--error, [class*='error']"


def is_scope_error(error):
    """Check if an error is a Yahoo OAuth scope permission error"""
    msg = str(error).lower()
    return "scope" in msg or "permission" in msg or "not allowed" in msg


def write_method():
    """Get configured write method: auto, api, or browser"""
    return os.environ.get("YAHOO_WRITE_METHOD", "browser")


def _league_url(path=""):
    """Build a league-specific URL. Tries /b2/ (in-season) first, falls back to /b1/ (pre-season)."""
    return BASE_URL + "/b2/" + LEAGUE_NUM + path


def _league_url_b1(path=""):
    """Build a pre-season league URL using /b1/"""
    return BASE_URL + "/b1/" + LEAGUE_NUM + path


def _navigate_league(page, path=""):
    """Navigate to a league page, trying /b1/ first (pre-season) then /b2/ (in-season)."""
    url = _league_url_b1(path)
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(2000)
    # If /b1/ redirected away, try /b2/ (in-season)
    if LEAGUE_NUM not in page.url:
        url = _league_url(path)
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2000)
    _check_for_login_redirect(page)


def is_session_valid():
    """Check if saved session file exists and has Yahoo cookies"""
    try:
        if not os.path.exists(SESSION_FILE):
            return {"valid": False, "reason": "No session file found"}
        with open(SESSION_FILE, "r") as f:
            data = json.load(f)
        cookies = data.get("cookies", [])
        yahoo_cookies = [c for c in cookies if ".yahoo.com" in c.get("domain", "")]
        if not yahoo_cookies:
            return {"valid": False, "reason": "No Yahoo cookies in session"}
        auth_names = {"Y", "T", "A", "B"}
        has_auth = any(c.get("name", "") in auth_names for c in yahoo_cookies)
        if not has_auth:
            return {"valid": False, "reason": "No auth cookies found"}
        return {"valid": True, "cookie_count": len(yahoo_cookies)}
    except Exception as e:
        return {"valid": False, "reason": "Error reading session: " + str(e)}


def _get_browser_context():
    """Create a Playwright browser context with saved session"""
    from playwright.sync_api import sync_playwright

    status = is_session_valid()
    if not status.get("valid"):
        raise Exception(
            "Browser session not valid: " + status.get("reason", "unknown")
            + ". Run './yf browser-login' to set up."
        )

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(storage_state=SESSION_FILE)
    return pw, browser, context


def _cleanup(pw, browser, context):
    """Clean up browser resources"""
    try:
        context.close()
    except Exception:
        pass
    try:
        browser.close()
    except Exception:
        pass
    try:
        pw.stop()
    except Exception:
        pass


def _check_for_login_redirect(page):
    """Check if page redirected to Yahoo login (session expired)"""
    url = page.url
    if "login.yahoo.com" in url or "guce.yahoo.com" in url:
        raise Exception(
            "Yahoo session expired - redirected to login page. "
            "Run './yf browser-login' to refresh your session."
        )


def _wait_and_check(page, timeout=10000):
    """Wait for page to settle and check for errors"""
    page.wait_for_load_state("networkidle", timeout=timeout)
    _check_for_login_redirect(page)


def _click_if_visible(page, selector):
    """Click the first visible element matching selector, return True if clicked"""
    el = page.locator(selector).first
    if el.is_visible():
        el.click()
        return True
    return False


def _get_page_error(page):
    """Return error text from page if an error element is visible, else None"""
    error_el = page.locator(_ERROR_SELECTOR).first
    if error_el.is_visible():
        return error_el.inner_text()
    return None


def _submit_page_action(url, success_keywords, action_label, pre_submit_fn=None):
    """Common pattern: navigate to URL, optionally interact, click confirm, check result.

    Args:
        url: page to navigate to
        success_keywords: list of lowercase strings to check in page body
        action_label: used in result messages (e.g. "Add player 12345")
        pre_submit_fn: optional callable(page) to run before clicking confirm
    """
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        _check_for_login_redirect(page)

        if pre_submit_fn:
            pre_submit_fn(page)

        if _click_if_visible(page, _CONFIRM_SELECTOR):
            _wait_and_check(page)

        page_text = page.inner_text("body").lower()
        for kw in success_keywords:
            if kw in page_text:
                return {"success": True, "method": "browser", "message": action_label + " via browser"}

        error_text = _get_page_error(page)
        if error_text:
            return {"success": False, "method": "browser", "message": "Browser error: " + error_text}

        return {"success": True, "method": "browser", "message": action_label + " submitted via browser"}
    except Exception as e:
        return {"success": False, "method": "browser", "message": "Browser " + action_label.lower() + " failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def refresh_session():
    """Visit Yahoo Fantasy to refresh session cookies and save them back.
    Called periodically by the heartbeat to prevent session expiry."""
    from datetime import datetime
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        page.goto(BASE_URL, wait_until="networkidle")
        _check_for_login_redirect(page)
        # Save refreshed cookies
        context.storage_state(path=SESSION_FILE)
        _heartbeat["last_ok"] = datetime.utcnow().isoformat() + "Z"
        _heartbeat["last_error"] = None
        return {"success": True, "message": "Session refreshed"}
    except Exception as e:
        _heartbeat["last_error"] = str(e)
        return {"success": False, "message": "Session refresh failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def get_heartbeat_state():
    """Return current heartbeat state for status endpoints"""
    return dict(_heartbeat)


def add_player(player_id):
    """Add a free agent via Yahoo Fantasy web UI"""
    url = _league_url("/addplayer?apid=" + str(player_id))
    return _submit_page_action(url, ["was added", "success", "roster"], "Added player " + str(player_id))


def drop_player(player_id):
    """Drop a player via Yahoo Fantasy web UI"""
    url = _league_url("/dropplayer?dpid=" + str(player_id))
    return _submit_page_action(url, ["was dropped", "success"], "Dropped player " + str(player_id))


def swap_players(add_id, drop_id):
    """Atomic add+drop via Yahoo Fantasy web UI"""
    url = _league_url("/addplayer?apid=" + str(add_id) + "&dpid=" + str(drop_id))
    label = "Swapped: added " + str(add_id) + ", dropped " + str(drop_id)
    return _submit_page_action(url, ["was added", "success", "roster"], label)


def _fill_faab(page, faab):
    """Fill FAAB bid field if faab is not None"""
    if faab is None:
        return
    bid_input = page.locator("input[name*='bid'], input[name*='faab'], input[id*='bid']").first
    if bid_input.is_visible():
        bid_input.fill(str(faab))


def waiver_claim(player_id, faab=None):
    """Submit a waiver claim via Yahoo Fantasy web UI"""
    url = _league_url("/addplayer?apid=" + str(player_id))
    label = "Waiver claim for " + str(player_id)
    if faab is not None:
        label += " with $" + str(faab) + " FAAB bid"

    def pre_submit(page):
        _fill_faab(page, faab)

    return _submit_page_action(url, ["claim", "success", "waiver"], label, pre_submit_fn=pre_submit)


def waiver_claim_swap(add_id, drop_id, faab=None):
    """Submit a waiver claim + drop via Yahoo Fantasy web UI"""
    url = _league_url("/addplayer?apid=" + str(add_id) + "&dpid=" + str(drop_id))
    label = "Waiver claim+drop: add " + str(add_id) + ", drop " + str(drop_id)
    if faab is not None:
        label += " with $" + str(faab) + " FAAB"

    def pre_submit(page):
        _fill_faab(page, faab)

    return _submit_page_action(url, ["claim", "success", "waiver"], label, pre_submit_fn=pre_submit)


def set_lineup(moves):
    """Set lineup positions via Yahoo Fantasy web UI

    Args:
        moves: list of dicts with 'player_id' and 'selected_position'
    """
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        page.goto(_league_url("/editroster"), wait_until="networkidle")
        _check_for_login_redirect(page)

        results = []
        for move in moves:
            pid = move.get("player_id", "")
            pos = move.get("selected_position", "")
            try:
                player_row = page.locator("[data-playerid='" + str(pid) + "'], tr:has([href*='/" + str(pid) + "'])").first
                if not player_row.is_visible():
                    results.append({"player_id": pid, "position": pos, "success": False, "error": "Player not found on roster page"})
                    continue
                pos_select = player_row.locator("select").first
                if not pos_select.is_visible():
                    results.append({"player_id": pid, "position": pos, "success": False, "error": "No position dropdown found"})
                    continue
                pos_select.select_option(label=pos)
                results.append({"player_id": pid, "position": pos, "success": True})
            except Exception as e:
                results.append({"player_id": pid, "position": pos, "success": False, "error": str(e)})

        if _click_if_visible(page, "button[type='submit'], input[type='submit'], .Btn-primary, [data-tst='save']"):
            _wait_and_check(page)

        all_success = all(r.get("success") for r in results)
        return {
            "success": all_success,
            "method": "browser",
            "moves": results,
            "message": "Applied " + str(len(results)) + " lineup change(s) via browser",
        }
    except Exception as e:
        return {"success": False, "method": "browser", "message": "Browser set-lineup failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def _get_session_cookies():
    """Load cookies from Playwright session file into a requests-compatible dict."""
    import requests as req_lib
    with open(SESSION_FILE, "r") as f:
        data = json.load(f)
    jar = req_lib.cookies.RequestsCookieJar()
    for c in data.get("cookies", []):
        jar.set(c["name"], c["value"], domain=c.get("domain", ""), path=c.get("path", "/"))
    return jar


def _extract_crumb(html, field="crumb"):
    """Extract a Yahoo CSRF crumb from page HTML by field name."""
    import re
    m = re.search(r'name=["\']' + field + r'["\'][^>]*value=["\']([^"\']+)["\']', html)
    if m:
        return m.group(1)
    m = re.search(r'value=["\']([^"\']+)["\'][^>]*name=["\']' + field + r'["\']', html)
    if m:
        return m.group(1)
    return ""


def propose_trade_http(tradee_team_key, your_player_ids, their_player_ids, trade_note=""):
    """Propose a trade via direct HTTP requests using saved Yahoo session cookies.
    Much faster and more reliable than browser automation."""
    import requests as req_lib

    tradee_num = tradee_team_key.split(".")[-1] if "." in tradee_team_key else tradee_team_key
    cookies = _get_session_cookies()

    # Headers that Yahoo expects
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": BASE_URL,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    base_trade_url = BASE_URL + "/b1/" + LEAGUE_NUM + "/" + TEAM_NUM + "/proposetrade"

    # Step 1: POST stage=3 (skip player selection page, go straight to review)
    stage1_url = base_trade_url + "?stage=1&mid2=" + tradee_num
    form_data = [
        ("stage", "3"),
        ("mid2", tradee_num),
        ("trid", ""),
        ("onote", ""),
        ("note", trade_note),
        ("evaluate", ""),
        ("jsubmit", "continue"),
    ]
    for pid in your_player_ids:
        form_data.append(("tpids[]", str(pid)))
    for pid in their_player_ids:
        form_data.append(("tpids2[]", str(pid)))

    headers["Referer"] = stage1_url
    resp2 = req_lib.post(base_trade_url, data=form_data, cookies=cookies, headers=headers, timeout=15, allow_redirects=True)

    if "login.yahoo.com" in resp2.url:
        return {"success": False, "method": "http", "message": "Session expired — redirected to login. Run './yf browser-login' to refresh."}

    # Extract crumb from the review page (stage=5 form)
    crumb = _extract_crumb(resp2.text)
    if not crumb:
        return {"success": False, "method": "http", "message": "Could not extract crumb from review page"}

    # Step 2: POST stage=5 (Confirm trade proposal)
    confirm_data = [
        ("stage", "5"),
        ("mid2", tradee_num),
        ("trid", ""),
        ("onote", ""),
        ("note", trade_note),
        ("crumb", crumb),
        ("fr", "sports"),
        ("fr2", "p:sprt,m:sb"),
        ("jsubmit", ""),
    ]
    for pid in your_player_ids:
        confirm_data.append(("tpids[]", str(pid)))
    for pid in their_player_ids:
        confirm_data.append(("tpids2[]", str(pid)))

    headers["Referer"] = base_trade_url
    resp3 = req_lib.post(base_trade_url, data=confirm_data, cookies=cookies, headers=headers, timeout=15, allow_redirects=True)

    # Check if we landed on the team page (success) or stayed on trade page (error)
    final_text = resp3.text.lower()
    if "proposed" in final_text or resp3.url.endswith("/" + TEAM_NUM) or "stage" not in resp3.url:
        return {
            "success": True,
            "method": "http",
            "tradee_team_key": tradee_team_key,
            "message": "Trade proposed to " + tradee_team_key + " via HTTP",
        }

    return {
        "success": False,
        "method": "http",
        "message": "Trade submission may have failed — final URL: " + resp3.url,
    }


def _click_trade_players(page, player_ids, cb_field, name_to_cb):
    """Click checkboxes for trade players, using name-based fallback when API IDs don't match web IDs."""
    results = []
    for pid in player_ids:
        pid_str = str(pid)
        # Try direct checkbox value match first
        sel = "#checkbox-" + pid_str + ", input[name='" + cb_field + "'][value='" + pid_str + "']"
        clicked = _click_if_visible(page, sel)
        method = "id"

        # If direct match fails, try name-based matching via img URL
        # Yahoo img URLs contain the player ID: /players_l/YYYYMMDD/{web_id}.png
        # We can also match by finding which checkbox row has an img URL containing the API player ID
        if not clicked:
            try:
                # Search for a row with an img src containing this player ID
                row_sel = "tr:has(img[src*='/" + pid_str + ".png'])"
                row = page.locator(row_sel).first
                if row.is_visible():
                    cb = row.locator("input[name='" + cb_field + "']").first
                    if cb.is_visible():
                        cb.click()
                        clicked = True
                        method = "img_url"
            except Exception:
                pass

        results.append({"player_id": pid_str, "clicked": clicked, "method": method})
    return results


def propose_trade(tradee_team_key, your_player_ids, their_player_ids, trade_note="", debug=False):
    """Propose a trade via Yahoo Fantasy web UI"""
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        # Extract opponent team number from team key (e.g. "469.l.16960.t.3" -> "3")
        tradee_num = tradee_team_key.split(".")[-1] if "." in tradee_team_key else tradee_team_key

        # Navigate directly to stage=1 (player selection) with the target team
        _navigate_league(page, "/" + TEAM_NUM + "/proposetrade?stage=1&mid2=" + tradee_num)

        debug_info = {}
        if debug:
            page.screenshot(path="/tmp/trade_debug_1_loaded.png", full_page=True)
            debug_info["url_after_load"] = page.url
            debug_info["page_title"] = page.title()

        if debug:
            page.screenshot(path="/tmp/trade_debug_1b_create.png", full_page=True)
            debug_info["url_after_create"] = page.url
            # Capture all checkboxes and inputs on the page
            checkboxes = page.locator("input[type='checkbox']").all()
            debug_info["checkbox_count"] = len(checkboxes)
            cb_details = []
            for cb in checkboxes[:50]:
                try:
                    cb_details.append({
                        "name": cb.get_attribute("name") or "",
                        "value": cb.get_attribute("value") or "",
                        "id": cb.get_attribute("id") or "",
                        "visible": cb.is_visible(),
                    })
                except Exception:
                    pass
            debug_info["checkboxes"] = cb_details
            # Dump HTML around a few checkboxes to understand the structure
            cb_html_samples = []
            for cb in checkboxes[:3]:
                try:
                    parent_html = cb.evaluate("el => el.closest('tr')?.outerHTML?.substring(0, 1200) || ''")
                    cb_html_samples.append(parent_html)
                except Exception:
                    pass
            debug_info["cb_html_samples"] = cb_html_samples
            # Also search for "Cease" in page HTML
            cease_in_html = page.evaluate("() => document.body.innerHTML.includes('Cease')")
            debug_info["cease_in_html"] = cease_in_html
            # Get the form action
            forms = page.locator("form").all()
            form_actions = []
            for f in forms[:3]:
                try:
                    form_actions.append(f.get_attribute("action") or "")
                except Exception:
                    pass
            debug_info["form_actions"] = form_actions

        # Build a name->checkbox_value map from the page so we can match by name
        # Yahoo web UI uses different player IDs than the Fantasy API
        name_to_cb = page.evaluate("""() => {
            const map = {};
            document.querySelectorAll('input[type=checkbox][name^=tpids]').forEach(cb => {
                const tr = cb.closest('tr');
                if (!tr) return;
                // Player name is in the alt attribute of the player headshot img
                const img = tr.querySelector('td.player img[alt]');
                const name = img ? img.alt.trim() : '';
                if (name && cb.value) {
                    map[name.toLowerCase()] = {value: cb.value, name: cb.name};
                }
            });
            return map;
        }""")

        if debug:
            debug_info["name_to_cb"] = name_to_cb

        # Select players by clicking their checkboxes
        # Yahoo web uses different player IDs than the Fantasy API, so match by name
        your_clicked = _click_trade_players(page, your_player_ids, "tpids[]", name_to_cb)
        their_clicked = _click_trade_players(page, their_player_ids, "tpids2[]", name_to_cb)

        if debug:
            debug_info["your_clicked"] = your_clicked
            debug_info["their_clicked"] = their_clicked
            page.screenshot(path="/tmp/trade_debug_2_selected.png", full_page=True)
            # Capture all buttons and submit elements
            buttons = page.evaluate("""() => {
                const result = [];
                document.querySelectorAll('button, input[type=submit], a.Btn-primary, [class*=Btn]').forEach(el => {
                    result.push({
                        tag: el.tagName,
                        type: el.type || '',
                        text: el.textContent?.trim()?.substring(0, 60) || '',
                        class: el.className?.substring(0, 80) || '',
                        id: el.id || '',
                        visible: el.offsetParent !== null,
                    });
                });
                return result;
            }""")
            debug_info["buttons"] = buttons

        # Add trade note
        if trade_note:
            note_input = page.locator("textarea[name*='note'], textarea[name*='message'], input[name*='note']").first
            if note_input.is_visible():
                note_input.fill(trade_note)

        # Capture network requests to understand the form submission
        captured_requests = []
        if debug:
            def on_request(req):
                if "proposetrade" in req.url and req.method == "POST":
                    captured_requests.append({
                        "url": req.url,
                        "method": req.method,
                        "post_data": req.post_data,
                        "headers": {k: v for k, v in req.headers.items() if k.lower() in ("content-type", "cookie", "referer", "origin")},
                    })
            page.on("request", on_request)

        # Step 1: Click "Continue" to go from player selection to review
        continue_btn = page.locator("a.Btn-primary:has-text('Continue'), a:has-text('Continue')").first
        submit_clicked = False
        if continue_btn.is_visible():
            continue_btn.click()
            page.wait_for_load_state("networkidle", timeout=15000)
            _check_for_login_redirect(page)
            submit_clicked = True

        if debug:
            debug_info["submit_clicked"] = submit_clicked
            page.screenshot(path="/tmp/trade_debug_3_submitted.png", full_page=True)
            debug_info["url_after_submit"] = page.url

        # Step 2: On review page, add trade note and click final submit
        if trade_note:
            note_input = page.locator("textarea[name*='note'], textarea[name*='message'], input[name*='note']").first
            if note_input.is_visible():
                note_input.fill(trade_note)

        # Capture the crumb/csrf token from the page if present
        if debug:
            crumb = page.evaluate("() => document.querySelector('input[name=crumb]')?.value || ''")
            debug_info["crumb"] = crumb
            # Also capture all hidden inputs
            hidden_inputs = page.evaluate("""() => {
                const inputs = {};
                document.querySelectorAll('form input[type=hidden]').forEach(el => {
                    inputs[el.name] = el.value;
                });
                return inputs;
            }""")
            debug_info["hidden_inputs"] = hidden_inputs

        # Click "Send Trade Proposal" or similar final confirm button
        confirm_clicked = False
        final_btn = page.locator("a.Btn-primary, button.Btn-primary, input[type='submit']").first
        if final_btn.is_visible():
            final_btn.click()
            page.wait_for_load_state("networkidle", timeout=15000)
            _check_for_login_redirect(page)
            confirm_clicked = True

        if debug:
            debug_info["confirm_clicked"] = confirm_clicked
            debug_info["captured_requests"] = captured_requests
            page.screenshot(path="/tmp/trade_debug_4_confirmed.png", full_page=True)
            debug_info["url_after_confirm"] = page.url

        page_text = page.inner_text("body").lower()

        if debug:
            # Save a snippet of the page text for debugging
            debug_info["page_text_snippet"] = page_text[:500]

        # Check for actual trade confirmation — "proposed" is the real signal
        if "proposed" in page_text or "your trade proposal has been" in page_text:
            result = {
                "success": True,
                "method": "browser",
                "tradee_team_key": tradee_team_key,
                "message": "Trade proposed to " + tradee_team_key + " via browser",
            }
            if debug:
                result["debug"] = debug_info
            return result

        error_text = _get_page_error(page)
        if error_text:
            result = {"success": False, "method": "browser", "message": "Browser error: " + error_text}
            if debug:
                result["debug"] = debug_info
            return result

        # If we got here, we're not sure it worked — report as uncertain
        result = {"success": False, "method": "browser", "message": "Trade submission uncertain — no confirmation found on page"}
        if debug:
            result["debug"] = debug_info
        return result
    except Exception as e:
        result = {"success": False, "method": "browser", "message": "Browser propose trade failed: " + str(e)}
        if debug:
            result["debug"] = debug_info if "debug_info" in dir() else {}
        return result
    finally:
        _cleanup(pw, browser, context)


def _trade_response(transaction_key, action, trade_note=""):
    """Accept or reject a trade via Yahoo Fantasy web UI.

    Args:
        action: "Accept" or "Reject"
    """
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        page.goto(_league_url("/trades?tradeId=" + str(transaction_key)), wait_until="networkidle")
        _check_for_login_redirect(page)

        if trade_note:
            note_input = page.locator("textarea[name*='note'], textarea[name*='message']").first
            if note_input.is_visible():
                note_input.fill(trade_note)

        action_selector = "button:has-text('" + action + "'), input[value*='" + action + "'], a:has-text('" + action + "'), [data-tst='" + action.lower() + "']"
        if _click_if_visible(page, action_selector):
            _wait_and_check(page)
        if _click_if_visible(page, _CONFIRM_SELECTOR):
            _wait_and_check(page)

        label = action.lower() + "ed"
        return {"success": True, "method": "browser", "transaction_key": transaction_key, "message": "Trade " + label + " via browser: " + str(transaction_key)}
    except Exception as e:
        return {"success": False, "method": "browser", "transaction_key": transaction_key, "message": "Browser " + action.lower() + " trade failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def accept_trade(transaction_key, trade_note=""):
    """Accept a pending trade via Yahoo Fantasy web UI"""
    return _trade_response(transaction_key, "Accept", trade_note)


def reject_trade(transaction_key, trade_note=""):
    """Reject a pending trade via Yahoo Fantasy web UI"""
    return _trade_response(transaction_key, "Reject", trade_note)


def _team_edit_url():
    """Build URL for team edit page (pre-season uses /b1/, in-season /b2/)"""
    return BASE_URL + "/b1/" + LEAGUE_NUM + "/" + TEAM_NUM + "/editteaminfo"


def _goto_team_edit(page):
    """Navigate to team edit page with session warmup"""
    page.goto(BASE_URL + "/b1/" + LEAGUE_NUM, wait_until="domcontentloaded", timeout=15000)
    _check_for_login_redirect(page)
    page.goto(_team_edit_url(), wait_until="domcontentloaded", timeout=15000)
    _check_for_login_redirect(page)


def _click_save_changes(page):
    """Click the Save Changes button on the team edit page.
    Yahoo disables #team-settings-save until changes are detected via JS events."""
    save_btn = page.locator("#team-settings-save")
    if save_btn.get_attribute("disabled") is not None:
        save_btn.evaluate("el => el.removeAttribute('disabled')")
    save_btn.click()
    page.wait_for_timeout(3000)
    return "_global_alerts" in page.url


def change_team_name(new_name):
    """Change team name via Yahoo Fantasy web UI — useful as a write test.
    Uses type() for character-by-character input to trigger Yahoo's JS change detection."""
    if not TEAM_NUM:
        return {"success": False, "method": "browser", "message": "TEAM_ID env var not set"}

    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        _goto_team_edit(page)

        name_input = page.locator("input[name='TN']").first
        if not name_input.is_visible():
            return {
                "success": False,
                "method": "browser",
                "message": "Could not find team name field on " + page.url,
            }

        old_name = name_input.input_value()
        # type() sends keydown/keyup events which enable the Save button
        name_input.click()
        name_input.fill("")
        name_input.type(new_name)
        page.wait_for_timeout(300)

        saved = _click_save_changes(page)
        return {
            "success": saved,
            "method": "browser",
            "message": "Team name changed from '" + old_name + "' to '" + new_name + "' via browser",
            "old_name": old_name,
            "new_name": new_name,
        }
    except Exception as e:
        return {"success": False, "method": "browser", "message": "Browser change team name failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def change_team_logo(image_path):
    """Change team logo via Yahoo Fantasy web UI.
    Uploads image to Cloudinary through Yahoo's upload flow, selects it, and saves."""
    if not TEAM_NUM:
        return {"success": False, "method": "browser", "message": "TEAM_ID env var not set"}
    resolved = os.path.realpath(image_path)
    allowed_dirs = ["/app/data", "/app/config", "/tmp"]
    if not any(resolved.startswith(d + "/") or resolved == d for d in allowed_dirs):
        return {"success": False, "method": "browser", "message": "Image path must be within /app/data, /app/config, or /tmp"}
    if not os.path.exists(resolved):
        return {"success": False, "method": "browser", "message": "Image file not found: " + image_path}

    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()

        # Track Cloudinary upload response
        upload_public_id = []
        def on_response(resp):
            if "cloudinary" in resp.url and "upload" in resp.url:
                try:
                    body = resp.json()
                    upload_public_id.append(body.get("public_id", ""))
                except Exception:
                    pass
        page.on("response", on_response)

        _goto_team_edit(page)

        # Open custom image picker
        custom_btn = page.locator("text=Use Custom Image").first
        if not custom_btn.is_visible():
            return {"success": False, "method": "browser", "message": "Could not find 'Use Custom Image' button"}
        custom_btn.click()
        page.wait_for_timeout(1000)

        # Upload file — Yahoo's JS sends it to Cloudinary
        file_input = page.locator("input[type=file]").first
        file_input.set_input_files(image_path)
        page.wait_for_timeout(8000)

        if not upload_public_id:
            return {"success": False, "method": "browser", "message": "Image upload to Cloudinary failed"}

        # Select the first image in gallery (most recently uploaded)
        cloudinary_imgs = page.locator("img[src*=cloudinary]").all()
        if cloudinary_imgs:
            cloudinary_imgs[0].click()
            page.wait_for_timeout(500)

        # Confirm selection
        choose_btn = page.locator("button:has-text('Choose Logo')").first
        if choose_btn.is_visible():
            choose_btn.click()
            page.wait_for_timeout(1000)

        # Save changes
        saved = _click_save_changes(page)
        return {
            "success": saved,
            "method": "browser",
            "message": "Team logo updated via browser",
            "cloudinary_id": upload_public_id[-1] if upload_public_id else "",
        }
    except Exception as e:
        return {"success": False, "method": "browser", "message": "Browser change logo failed: " + str(e)}
    finally:
        _cleanup(pw, browser, context)


def login_interactive():
    """Launch headed browser for user to log into Yahoo manually.
    Saves session to SESSION_FILE after login."""
    from playwright.sync_api import sync_playwright

    print("Opening Yahoo login page in browser...")
    print("Please log in to your Yahoo account.")
    print("After logging in, navigate to: " + BASE_URL)
    print("The browser will close automatically once logged in.")
    print("")

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()

    page.goto("https://login.yahoo.com/")

    print("Waiting for login to complete...")
    try:
        auth_names = {"Y", "T", "A", "B"}
        for _ in range(300):  # 5 minute timeout
            time.sleep(1)
            cookies = context.cookies()
            yahoo_cookies = [c for c in cookies if ".yahoo.com" in c.get("domain", "")]
            has_auth = any(c.get("name", "") in auth_names for c in yahoo_cookies)
            if has_auth:
                page.goto(BASE_URL)
                time.sleep(2)
                break
        else:
            print("Timeout waiting for login (5 minutes)")
            _cleanup(pw, browser, context)
            return False

        session_dir = os.path.dirname(SESSION_FILE)
        if session_dir and not os.path.exists(session_dir):
            os.makedirs(session_dir, exist_ok=True)
        context.storage_state(path=SESSION_FILE)
        print("")
        print("Session saved to " + SESSION_FILE)
        print("You can now use write operations (add, drop, swap, etc.)")
        _cleanup(pw, browser, context)
        return True
    except Exception as e:
        print("Error during login: " + str(e))
        _cleanup(pw, browser, context)
        return False


def test_session():
    """Navigate to league page and verify session works end-to-end"""
    print("Testing browser session against league " + LEAGUE_NUM + "...")
    pw, browser, context = _get_browser_context()
    try:
        page = context.new_page()
        page.goto(_league_url(""), wait_until="networkidle")
        _check_for_login_redirect(page)

        title = page.title()
        url = page.url
        print("  Page title: " + title)
        print("  URL: " + url)

        # Check we landed on the league page, not login
        page_text = page.inner_text("body")
        checks = {
            "league_page": LEAGUE_NUM in url or "fantasy" in url.lower(),
            "has_content": len(page_text) > 200,
            "not_login": "login.yahoo.com" not in url,
        }
        print("")
        for name, passed in checks.items():
            status = "PASS" if passed else "FAIL"
            print("  [" + status + "] " + name)

        all_pass = all(checks.values())
        print("")
        if all_pass:
            print("Browser automation is working. Ready for season.")
        else:
            print("Some checks failed. Session may need refresh: ./yf browser-login")
        return all_pass
    except Exception as e:
        print("Test failed: " + str(e))
        return False
    finally:
        _cleanup(pw, browser, context)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "login":
        success = login_interactive()
        sys.exit(0 if success else 1)
    elif cmd == "status":
        result = is_session_valid()
        print(json.dumps(result, indent=2))
    elif cmd == "test":
        success = test_session()
        sys.exit(0 if success else 1)
    elif cmd == "change-team-name":
        if len(sys.argv) < 3:
            print("Usage: yahoo_browser.py change-team-name <new_name>")
            sys.exit(1)
        result = change_team_name(sys.argv[2])
        print(json.dumps(result, indent=2))
        sys.exit(0 if result.get("success") else 1)
    elif cmd == "change-team-logo":
        if len(sys.argv) < 3:
            print("Usage: yahoo_browser.py change-team-logo <image_path>")
            sys.exit(1)
        result = change_team_logo(sys.argv[2])
        print(json.dumps(result, indent=2))
        sys.exit(0 if result.get("success") else 1)
    else:
        print("Yahoo Fantasy Browser Automation")
        print("Usage: yahoo_browser.py <command>")
        print("")
        print("Commands:")
        print("  login                       - Open browser for Yahoo login")
        print("  status                      - Check browser session status")
        print("  test                        - Test browser session against league")
        print("  change-team-name <name>     - Change team name")
        print("  change-team-logo <path>     - Change team logo image")
