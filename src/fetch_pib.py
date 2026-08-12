import re
import time
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

from .config import PIB_FEEDS, USER_AGENT
from .db import insert_article


def clean_text(html):
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(" ", strip=True)

    return re.sub(r"\s+", " ", text)


def fetch_url(url):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    return response


def fetch_article(url):
    response = fetch_url(url)

    return clean_text(response.text)


def parse_rss_xml(xml_text, source_name):

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as error:
        print("RSS XML parsing failed:")
        print(error)
        print("First 1000 characters of response:")
        print(xml_text[:1000])
        return []

    articles = []

    # Handles both RSS <item> and Atom-style <entry>
    items = root.findall(".//item")

    if not items:
        items = root.findall(".//{*}entry")

    print(f"RSS records discovered: {len(items)}")

    for item in items:

        def get_text(tag):
            element = item.find(tag)

            if element is not None:
                return element.text or ""

            # Try namespace-independent lookup
            element = item.find(f".//{{*}}{tag}")

            if element is not None:
                return element.text or ""

            return ""

        title = get_text("title").strip()

        guid = (
            get_text("guid").strip()
            or get_text("id").strip()
        )

        link = get_text("link").strip()

        # Atom links sometimes store URL in href
        if not link:
            link_element = item.find(".//{*}link")

            if link_element is not None:
                link = link_element.attrib.get("href", "")

        published = (
            get_text("pubDate").strip()
            or get_text("published").strip()
            or get_text("updated").strip()
        )

        description = (
            get_text("description")
            or get_text("summary")
            or get_text("content")
        )

        if not guid:
            guid = link

        if not title or not link:
            continue

        articles.append({
            "guid": guid,
            "title": clean_text(title),
            "link": link,
            "published_at": published,
            "source": source_name,
            "ministry": "",
            "summary": clean_text(description),
        })

    return articles


def collect_feed(feed_config):

    feed_url = feed_config["url"]
    source_name = feed_config["name"]

    print("")
    print("=" * 70)
    print(f"FETCHING: {source_name}")
    print(feed_url)
    print("=" * 70)

    response = fetch_url(feed_url)

    print(f"HTTP status: {response.status_code}")
    print(f"Content type: {response.headers.get('content-type')}")
    print(f"Response size: {len(response.content)} bytes")

    articles = parse_rss_xml(
        response.text,
        source_name,
    )

    print(f"Articles parsed: {len(articles)}")

    added = 0

    for article in articles:

        raw_text = article["summary"]

        try:

            print(f"Fetching article: {article['title']}")

            raw_text = fetch_article(
                article["link"]
            )

            print(
                f"Article fetched: {len(raw_text)} characters"
            )

        except Exception as error:

            print(
                f"Article fetch failed: {error}"
            )

            print(
                "Using RSS summary instead."
            )

        item = {
            "guid": article["guid"],
            "title": article["title"],
            "link": article["link"],
            "published_at": article["published_at"],
            "source": article["source"],
            "ministry": article["ministry"],
            "raw_text": raw_text,
            "fetched_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        try:

            inserted = insert_article(item)

            if inserted:

                added += 1

                print(
                    f"✓ INSERTED: {article['title']}"
                )

            else:

                print(
                    f"Already exists: {article['title']}"
                )

        except Exception as error:

            print(
                f"✗ Supabase insert failed:"
            )

            print(error)

        time.sleep(0.2)

    return added


def collect():

    total_added = 0

    for feed_config in PIB_FEEDS:

        try:

            total_added += collect_feed(
                feed_config
            )

        except Exception as error:

            print("")
            print("FEED ERROR")
            print(error)

    print("")
    print("=" * 70)
    print(
        f"TOTAL NEW ARTICLES INSERTED: {total_added}"
    )
    print("=" * 70)

    return total_added


if __name__ == "__main__":

    collect()
