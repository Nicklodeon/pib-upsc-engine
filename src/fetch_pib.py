import re
import time
from datetime import datetime, timezone

import feedparser
import requests
from bs4 import BeautifulSoup

from .config import PIB_FEEDS, USER_AGENT, IGNORE_TITLE_PATTERNS
from .db import insert_article


def clean_text(html):
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(" ", strip=True)

    return re.sub(r"\s+", " ", text)


def fetch_article(url):
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=30
    )

    response.raise_for_status()

    return clean_text(response.text)


def should_soft_skip(title):
    title_lower = title.lower()

    return any(
        pattern in title_lower
        for pattern in IGNORE_TITLE_PATTERNS
    )


def parse_feed(feed_url, source_name):

    feed = feedparser.parse(feed_url)

    for entry in feed.entries:

        guid = (
            entry.get("id")
            or entry.get("guid")
            or entry.get("link")
        )

        title = clean_text(
            entry.get("title", "")
        )

        link = entry.get("link", "")

        published = (
            entry.get("published")
            or entry.get("updated")
            or ""
        )

        ministry = (
            entry.get("author")
            or entry.get("dc_creator")
            or ""
        )

        summary = clean_text(
            entry.get("summary", "")
        )

        if not guid or not title:
            continue

        raw_text = summary

        try:

            if link:
                raw_text = fetch_article(link)

        except Exception as error:

            print(
                f"Could not fetch article: {title}"
            )

            print(
                f"Using RSS summary instead. Error: {error}"
            )

        yield {
            "guid": guid,
            "title": title,
            "link": link,
            "published_at": published,
            "source": source_name,
            "ministry": ministry,
            "raw_text": raw_text,
            "fetched_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "soft_skip": should_soft_skip(title),
        }


def collect():

    added = 0

    for feed_config in PIB_FEEDS:

        print(
            f"Fetching feed: {feed_config['name']}"
        )

        for item in parse_feed(
            feed_config["url"],
            feed_config["name"]
        ):

            try:

                inserted = insert_article(item)

                if inserted:
                    added += 1

                    print(
                        f"Added: {item['title']}"
                    )
                else:
                    print(
                        f"Already exists: {item['title']}"
                    )

            except Exception as error:

                print(
                    f"Database error for: {item['title']}"
                )

                print(error)

            time.sleep(0.2)

    return added


if __name__ == "__main__":

    print(
        f"Added {collect()} new PIB articles."
    )
