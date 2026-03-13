#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "scholarly",
#   "beautifulsoup4",
# ]
# ///
"""
Fetch citation counts from Google Scholar and update index.html.

Usage:
    uv run fetch_citations.py
"""

import json
from datetime import datetime
from difflib import SequenceMatcher

SCHOLAR_ID = "iGO-GD4AAAAJ"
HTML_FILE = "index.html"
JSON_FILE = "citations.json"
FUZZY_THRESHOLD = 0.6


def fuzzy_match(query: str, candidates: list[dict]) -> dict | None:
    """Return the best-matching candidate dict (with 'title' key) or None."""
    q = query.lower().strip()
    best_score = 0.0
    best = None
    for cand in candidates:
        t = cand["title"].lower().strip()
        score = SequenceMatcher(None, q, t).ratio()
        if score > best_score:
            best_score = score
            best = cand
    return best if best_score >= FUZZY_THRESHOLD else None


def fetch_scholar_data() -> dict:
    from scholarly import scholarly

    print(f"Fetching author profile {SCHOLAR_ID} from Google Scholar…")
    author = scholarly.search_author_id(SCHOLAR_ID)
    author = scholarly.fill(author, sections=["basics", "indices", "publications"])

    total_citations = author.get("citedby", 0)
    h_index = author.get("hindex", 0)

    papers = []
    for pub in author.get("publications", []):
        bib = pub.get("bib", {})
        title = bib.get("title", "")
        num_citations = pub.get("num_citations", 0)
        if title:
            papers.append({"title": title, "citations": num_citations})

    return {
        "total_citations": total_citations,
        "h_index": h_index,
        "papers": papers,
    }


def write_json(data: dict, scholar_papers: list[dict], html_matches: list[dict]) -> None:
    out = {
        "fetched_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        "total_citations": data["total_citations"],
        "h_index": data["h_index"],
        "papers": [
            {
                "scholar_title": p["title"],
                "citations": p["citations"],
                "matched_html_title": m.get("html_title", "") if m else "",
            }
            for p, m in zip(scholar_papers, html_matches)
        ],
    }
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Wrote {JSON_FILE}")


def patch_html(data: dict) -> None:
    from bs4 import BeautifulSoup

    with open(HTML_FILE, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Update aggregate stats
    total = data["total_citations"]
    hindex = data["h_index"]

    for elem_id, value in [("stat-citations", str(total)), ("stat-hindex", str(hindex))]:
        el = soup.find(id=elem_id)
        if el:
            el.string = value

    contact_el = soup.find(id="stat-contact-summary")
    if contact_el:
        contact_el.string = f"{total} citations · h-index {hindex}"

    # Build lookup from Scholar papers
    scholar_papers = [{"title": p["title"], "citations": p["citations"]} for p in data["papers"]]
    html_matches = []

    # Update per-paper citation badges
    matched = 0
    unmatched = []
    for entry in soup.select(".pub-entry"):
        title_el = entry.select_one(".pub-title")
        if not title_el:
            continue
        html_title = title_el.get_text(strip=True).rstrip(".")
        best = fuzzy_match(html_title, scholar_papers)
        badge = entry.select_one(".pub-citations")
        if badge is not None:
            if best:
                badge.string = f"{best['citations']} cited"
                html_matches.append({"html_title": html_title, "scholar_title": best["title"]})
                matched += 1
            else:
                badge.string = ""
                html_matches.append(None)
                unmatched.append(html_title)

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(str(soup))

    print(f"Patched {HTML_FILE}: {matched} papers matched, {len(unmatched)} unmatched")
    if unmatched:
        print("Unmatched HTML titles:")
        for t in unmatched:
            print(f"  - {t}")

    return scholar_papers, html_matches


def main() -> None:
    data = fetch_scholar_data()
    print(f"Total citations: {data['total_citations']}, h-index: {data['h_index']}, "
          f"papers from Scholar: {len(data['papers'])}")

    scholar_papers, html_matches = patch_html(data)
    write_json(data, scholar_papers, html_matches)
    print("Done.")


if __name__ == "__main__":
    main()
