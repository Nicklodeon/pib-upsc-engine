import re
import time
from datetime import datetime, timezone
from urllib.parse import urljoin
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

from .config import PIB_FEEDS, USER_AGENT
from .db import insert_article


PIB_BASE = "https://www.pib.gov.in"


def clean_text(html):
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(" ", strip=True)

    return re.sub(r"\s+", " ", text)


def get_response(url):

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 Chrome/151 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,"
            "application/xml;q=0.9,*/*;q=0.8"
        ),
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

    response = get_response(url)

    return clean_text(response.text)


# ---------------------------------------------------------
# RSS
# ---------------------------------------------------------

def parse_rss(response, source_name):

    try:

        # Use bytes rather than response.text so XML encoding
        # declarations are handled correctly.
        root = ET.fromstring(response.content)

    except ET.ParseError as error:

        print("RSS XML parsing failed:")
        print(error)

        print("Falling back to PIB All Releases page.")

        return []

    items = root.findall(".//item")

    if not items:
        items = root.findall(".//{*}entry")

    print(
        f"RSS records discovered: {len(items)}"
    )

    articles = []

    for item in items:

        def text(tag):

            element = item.find(tag)

            if element is not None:
                return element.text or ""

            element = item.find(
                f".//{{*}}{tag}"
            )

            if element is not None:
                return element.text or ""

            return ""

        title = text("title").strip()

        guid = (
            text("guid").strip()
            or text("id").strip()
        )

        link = text("link").strip()

        if not link:

            link_element = item.find(
                ".//{*}link"
            )

            if link_element is not None:

                link = link_element.attrib.get(
                    "href",
                    ""
                )

        published = (
            text("pubDate").strip()
            or text("published").strip()
            or text("updated").strip()
        )

        description = (
            text("description")
            or text("summary")
            or text("content")
        )

        if not title or not link:
            continue

        articles.append(
            {
                "guid": guid or link,
                "title": clean_text(title),
                "link": urljoin(
                    PIB_BASE,
                    link
                ),
                "published_at": published,
                "source": source_name,
                "summary": clean_text(
                    description
                ),
            }
        )

    return articles


# ---------------------------------------------------------
# PIB ALL RELEASES FALLBACK
# ---------------------------------------------------------

def scrape_all_releases():

    url = (
        "https://www.pib.gov.in/"
        "AllRelease.aspx?lang=1&reg=3"
    )

    print("")
    print("=" * 70)
    print("FALLBACK: PIB ALL RELEASES")
    print(url)
    print("=" * 70)

    response = get_response(url)

    print(
        f"All Releases HTTP status: "
        f"{response.status_code}"
    )

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    articles = []
    seen = set()

    for anchor in soup.find_all("a"):

        href = anchor.get("href", "")

        title = anchor.get_text(
            " ",
            strip=True
        )

        if not href or not title:
            continue

        href_lower = href.lower()

        # PIB uses several variants of article URLs.
        valid_url = any(
            x in href_lower
            for x in [
                "pressreleasepage.aspx",
                "pressrelesedetail.aspx",
                "pressreleaseiframepage.aspx",
                "pressnotedetails.aspx",
            ]
        )

        if not valid_url:
            continue

        link = urljoin(
            PIB_BASE,
            href
        )

        if link in seen:
            continue

        seen.add(link)

        articles.append(
            {
                "guid": link,
                "title": clean_text(title),
                "link": link,
                "published_at": "",
                "source": "PIB All Releases",
                "summary": "",
            }
        )

    print(
        f"All Releases links discovered: "
        f"{len(articles)}"
    )

    return articles


# ---------------------------------------------------------
# PROCESS ARTICLES
# ---------------------------------------------------------

def save_articles(articles):

    added = 0

    # Only process a small number during testing.
    # We'll increase this after everything works.
    articles = articles[:10]

    for article in articles:

        print("")
        print(
            f"Fetching article: "
            f"{article['title']}"
        )

        raw_text = article["summary"]

        try:

            raw_text = fetch_article(
                article["link"]
            )

            print(
                f"Article fetched: "
                f"{len(raw_text)} characters"
            )

        except Exception as error:

            print(
                f"Article fetch failed: "
                f"{error}"
            )

            if not raw_text:

                print(
                    "Skipping article because "
                    "no article text was obtained."
                )

                continue

        item = {
            "guid": article["guid"],
            "title": article["title"],
            "link": article["link"],
            "published_at": (
                article["published_at"]
                or None
            ),
            "source": article["source"],
            "ministry": "",
            "raw_text": raw_text,
            "fetched_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        try:

            inserted = insert_article(
                item
            )

            if inserted:

                added += 1

                print(
                    "✓ INSERTED"
                )

            else:

                print(
                    "Already exists"
                )

        except Exception as error:

            print(
                f"✗ Supabase error: "
                f"{error}"
            )

        time.sleep(0.2)

    return added


# ---------------------------------------------------------
# MAIN COLLECTOR
# ---------------------------------------------------------

def collect():

    total_added = 0

    for feed_config in PIB_FEEDS:

        print("")
        print("=" * 70)
        print(
            f"TRYING RSS: "
            f"{feed_config['name']}"
        )
        print(
            feed_config["url"]
        )
        print("=" * 70)

        try:

            response = get_response(
                feed_config["url"]
            )

            print(
                f"HTTP status: "
                f"{response.status_code}"
            )

            print(
                f"Content type: "
                f"{response.headers.get('content-type')}"
            )

            print(
                f"Response size: "
                f"{len(response.content)} bytes"
            )

            articles = parse_rss(
                response,
                feed_config["name"]
            )

            if articles:

                print(
                    "RSS worked successfully."
                )

                total_added += save_articles(
                    articles
                )

                continue

            print(
                "RSS returned no usable "
                "articles."
            )

        except Exception as error:

            print(
                f"RSS request failed: "
                f"{error}"
            )

    # -----------------------------------------------------
    # FALLBACK
    # -----------------------------------------------------

    if total_added == 0:

        print("")
        print(
            "RSS unavailable. "
            "Using All Releases fallback."
        )

        try:

            articles = scrape_all_releases()

            total_added += save_articles(
                articles
            )

        except Exception as error:

            print(
                f"All Releases fallback failed: "
                f"{error}"
            )

    print("")
    print("=" * 70)
    print(
        f"TOTAL NEW ARTICLES INSERTED: "
        f"{total_added}"
    )
    print("=" * 70)

    return total_added


if __name__ == "__main__":

    collect()
