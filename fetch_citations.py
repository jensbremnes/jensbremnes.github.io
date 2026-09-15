#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4>=4.12,<5",
# ]
# ///
"""
Fetch citation counts from the Google Scholar profile page and update index.html.

Reads the public profile page directly (no `scholarly` dependency, which broke
when bibtexparser 2.x removed modules it imports).

Usage:
    uv run fetch_citations.py
"""

import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from difflib import SequenceMatcher

from bs4 import BeautifulSoup, NavigableString

SCHOLAR_ID = "iGO-GD4AAAAJ"
PROFILE_URL = f"https://scholar.google.com/citations?user={SCHOLAR_ID}&hl=en&cstart=0&pagesize=100"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
HTML_FILE = "index.html"
JSON_FILE = "citations.json"
FUZZY_THRESHOLD = 0.6
ATTEMPTS = 3


def fuzzy_match(query: str, candidates: list[dict]) -> tuple[dict | None, float]:
    """Return the best-matching candidate dict (with 'title' key) and its score, or (None, score)."""
    q = query.lower().strip()
    best_score = 0.0
    best = None
    for cand in candidates:
        t = cand["title"].lower().strip()
        score = SequenceMatcher(None, q, t).ratio()
        if score > best_score:
            best_score = score
            best = cand
    return (best, best_score) if best_score >= FUZZY_THRESHOLD else (None, best_score)


def download_profile() -> str:
    request = urllib.request.Request(PROFILE_URL, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    last_error = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as resp:
                page = resp.read().decode("utf-8", errors="replace")
            if "gsc_rsb_std" in page:
                return page
            last_error = "profile stats not found (likely a CAPTCHA or block page)"
        except Exception as exc:  # network errors, HTTP 429, etc.
            last_error = repr(exc)
        print(f"Attempt {attempt}/{ATTEMPTS} failed: {last_error}")
        if attempt < ATTEMPTS:
            time.sleep(20 * attempt)
    sys.exit(f"Could not fetch Google Scholar profile: {last_error}")


def fetch_scholar_data() -> dict:
    print(f"Fetching author profile {SCHOLAR_ID} from Google Scholar…")
    soup = BeautifulSoup(download_profile(), "html.parser")

    # Stats table cells: citations (all, since), h-index (all, since), i10 (all, since)
    stats = [int(td.get_text(strip=True)) for td in soup.select("td.gsc_rsb_std")]
    if len(stats) < 3:
        sys.exit(f"Unexpected stats table on Scholar profile: {stats}")

    papers = []
    for row in soup.select("tr.gsc_a_tr"):
        title_el = row.select_one("a.gsc_a_at")
        cites_el = row.select_one("a.gsc_a_ac")
        if not title_el:
            continue
        cites = cites_el.get_text(strip=True) if cites_el else ""
        papers.append({"title": title_el.get_text(strip=True), "citations": int(cites) if cites.isdigit() else 0})

    return {"total_citations": stats[0], "h_index": stats[2], "papers": papers}


def write_json(data: dict, matches: dict[str, list[str]]) -> None:
    out = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "total_citations": data["total_citations"],
        "h_index": data["h_index"],
        "papers": [
            {
                "scholar_title": p["title"],
                "citations": p["citations"],
                "matched_html_title": " | ".join(matches.get(p["title"], [])),
            }
            for p in data["papers"]
        ],
    }
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {JSON_FILE}")


def set_badge(soup: BeautifulSoup, entry, citations: int) -> None:
    badge = entry.select_one(".pub-citations")
    if citations <= 0:
        if badge is not None:
            badge.decompose()
        return
    if badge is None:
        badge = soup.new_tag("span", attrs={"class": "pub-citations"})
        award = entry.select_one(".pub-award")
        if award is not None:
            award.insert_before(badge)
            badge.insert_after(NavigableString("\n"))
        else:
            last = entry.contents[-1] if entry.contents else None
            if isinstance(last, NavigableString) and not last.strip():
                last.insert_before(badge)
                badge.insert_before(NavigableString("\n"))
            else:
                entry.append(badge)
                entry.append(NavigableString("\n"))
    badge.string = f"{citations} cited"


def patch_html(data: dict) -> dict[str, list[str]]:
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    total = data["total_citations"]
    hindex = data["h_index"]

    for elem_id, value in [("stat-citations", str(total)), ("stat-hindex", str(hindex))]:
        el = soup.find(id=elem_id)
        if el:
            el.string = value

    contact_el = soup.find(id="stat-contact-summary")
    if contact_el:
        contact_el.string = f"{total} citations · h-index {hindex}"

    # Pair each page entry with its closest Scholar paper, then let each Scholar paper
    # keep only its best-scoring entry. Otherwise a similar-sounding entry that isn't
    # on Scholar (e.g. an FFI report) would borrow a paper's citations.
    candidates = []
    unmatched = []
    for entry in soup.select(".pub-entry"):
        title_el = entry.select_one(".pub-title")
        if not title_el:
            continue
        html_title = title_el.get_text(strip=True).rstrip(".")
        best, score = fuzzy_match(html_title, data["papers"])
        if best:
            candidates.append((entry, html_title, best, score))
        else:
            unmatched.append(html_title)

    top_score: dict[str, float] = {}
    for _, _, paper, score in candidates:
        top_score[paper["title"]] = max(score, top_score.get(paper["title"], 0.0))

    matches: dict[str, list[str]] = {}
    for entry, html_title, paper, score in candidates:
        if score < top_score[paper["title"]]:
            # Not on Scholar: leave the entry as it is.
            unmatched.append(html_title)
            continue
        entry["data-citations"] = str(paper["citations"])
        set_badge(soup, entry, paper["citations"])
        matches.setdefault(paper["title"], []).append(html_title)

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(str(soup))

    matched = sum(len(v) for v in matches.values())
    print(f"Patched {HTML_FILE}: {matched} papers matched, {len(unmatched)} unmatched")
    for scholar_title, html_titles in matches.items():
        for t in html_titles:
            if t.lower() != scholar_title.lower():
                print(f"  ~ {t!r} -> {scholar_title!r}")
    if unmatched:
        print("Unmatched HTML titles:")
        for t in unmatched:
            print(f"  - {t}")

    return matches


def main() -> None:
    data = fetch_scholar_data()
    print(f"Total citations: {data['total_citations']}, h-index: {data['h_index']}, "
          f"papers from Scholar: {len(data['papers'])}")
    if not data["papers"]:
        sys.exit("No publications parsed from Scholar profile; refusing to update.")

    matches = patch_html(data)
    write_json(data, matches)
    print("Done.")


if __name__ == "__main__":
    main()
