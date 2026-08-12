import re
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

import feedparser
import requests
from bs4 import BeautifulSoup

from .config import PIB_FEEDS, USER_AGENT, IGNORE_TITLE_PATTERNS
from .db import connect, insert_article

def clean_text(html):
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)

def fetch_article(url):
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return clean_text(r.text)

def should_soft_skip(title):
    t = title.lower()
    return any(p in t for p in IGNORE_TITLE_PATTERNS)

def parse_feed(feed_url, source_name):
    feed = feedparser.parse(feed_url)
    for e in feed.entries:
        guid = e.get("id") or e.get("guid") or e.get("link")
        title = clean_text(e.get("title", ""))
        link = e.get("link", "")
        published = e.get("published") or e.get("updated") or ""
        ministry = e.get("author") or e.get("dc_creator") or ""
        summary = clean_text(e.get("summary", ""))

        if not guid or not title:
            continue

        raw = summary
        # Keep the collector resilient: if article fetch fails, the feed summary
        # is still stored and can be retried later.
        try:
            if link:
                raw = fetch_article(link)
        except Exception:
            raw = summary

        yield {
            "guid": guid,
            "title": title,
            "link": link,
            "published_at": published,
            "source": source_name,
            "ministry": ministry,
            "raw_text": raw,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "soft_skip": should_soft_skip(title),
        }

def collect():
    con = connect()
    added = 0
    for feed_cfg in PIB_FEEDS:
        for item in parse_feed(feed_cfg["url"], feed_cfg["name"]):
            if insert_article(con, item):
                added += 1
            time.sleep(0.2)
    con.close()
    return added

if __name__ == "__main__":
    print(f"Added {collect()} new PIB articles.")
