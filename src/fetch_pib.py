import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

from .config import PIB_FEEDS, USER_AGENT
from .db import insert_article


PIB_BASE = "https://www.pib.gov.in"

# Number of articles to inspect per collection run.
# Increase/decrease later without changing the rest of the collector.
MAX_ARTICLES_PER_RUN = 50


# ---------------------------------------------------------
# TEXT CLEANING
# ---------------------------------------------------------

def clean_text(html):
    soup = BeautifulSoup(
        html or "",
        "html.parser"
    )

    for tag in soup(
        ["script", "style", "noscript"]
    ):
        tag.decompose()

    text = soup.get_text(
        " ",
        strip=True
    )

    return re.sub(
        r"\s+",
        " ",
        text
    ).strip()


# ---------------------------------------------------------
# HTTP
# ---------------------------------------------------------

def get_response(url):

    headers = {
        "User-Agent": USER_AGENT or (
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


# ---------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------

def normalize_datetime(value):
    """
    Convert different PIB/RSS date formats into an ISO
    timestamp suitable for Supabase timestamptz.
    """

    if not value:
        return None

    value = str(value).strip()

    if not value:
        return None

    # -----------------------------------------------------
    # Already ISO formatted
    # -----------------------------------------------------

    try:
        parsed = datetime.fromisoformat(
            value.replace(
                "Z",
                "+00:00"
            )
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.isoformat()

    except Exception:
        pass

    # -----------------------------------------------------
    # RSS / RFC822 date
    #
    # Example:
    # Wed, 19 Aug 2026 10:30:00 +0530
    # -----------------------------------------------------

    try:
        parsed = parsedate_to_datetime(
            value
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.isoformat()

    except Exception:
        pass

    # -----------------------------------------------------
    # PIB formats
    #
    # Examples:
    # 18 AUG 2026 8:04PM
    # 18 AUG 2026 08:04 PM
    # 18 August 2026 8:04PM
    # -----------------------------------------------------

    patterns = [
        "%d %b %Y %I:%M%p",
        "%d %b %Y %I:%M %p",
        "%d %B %Y %I:%M%p",
        "%d %B %Y %I:%M %p",
    ]

    # Remove common trailing PIB text.
    cleaned = re.sub(
        r"\s+by\s+PIB.*$",
        "",
        value,
        flags=re.IGNORECASE
    ).strip()

    for pattern in patterns:

        try:

            parsed = datetime.strptime(
                cleaned,
                pattern
            )

            # PIB operates in India.
            # Store the timestamp with IST offset.
            from datetime import timedelta

            ist = timezone(
                timedelta(
                    hours=5,
                    minutes=30
                )
            )

            parsed = parsed.replace(
                tzinfo=ist
            )

            return parsed.isoformat()

        except Exception:
            continue

    return None


def extract_pib_posted_date(html):
    """
    Extract PIB's actual publication timestamp from
    the article page.

    PIB commonly contains:

    Posted On: 18 AUG 2026 8:04PM by PIB Delhi
    """

    if not html:
        return None

    # Work with visible page text.
    text = clean_text(html)

    patterns = [

        # Standard PIB format.
        r"Posted\s*On\s*:\s*"
        r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}"
        r"\s+\d{1,2}:\d{2}\s*(?:AM|PM))",

        # Slightly different spacing.
        r"Posted\s+On\s*:\s*"
        r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}"
        r"\s+\d{1,2}:\d{2}\s*(?:AM|PM))",

        # Case-insensitive variant.
        r"posted\s*on\s*:\s*"
        r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}"
        r"\s+\d{1,2}:\d{2}\s*(?:am|pm))",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        if match:

            raw_date = match.group(
                1
            ).strip()

            normalized = normalize_datetime(
                raw_date
            )

            if normalized:
                return normalized

    return None


def extract_pib_metadata(html):
    """
    Extract useful metadata from a PIB article page.

    Returns:
        {
            "published_at": ...,
            "ministry": ...,
        }
    """

    if not html:
        return {
            "published_at": None,
            "ministry": "",
        }

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    text = clean_text(
        html
    )

    published_at = extract_pib_posted_date(
        html
    )

    ministry = ""

    # -----------------------------------------------------
    # Try common PIB page structure.
    # -----------------------------------------------------

    possible_selectors = [
        ".MinistryName",
        ".ministry",
        ".ministery",
        "#ctl00_ContentPlaceHolder1_lblMinistry",
    ]

    for selector in possible_selectors:

        element = soup.select_one(
            selector
        )

        if element:

            ministry = clean_text(
                element.get_text(
                    " ",
                    strip=True
                )
            )

            if ministry:
                break

    # -----------------------------------------------------
    # Fallback:
    #
    # PIB pages normally begin with something such as:
    #
    # Ministry of ...
    #
    # before the title.
    # -----------------------------------------------------

    if not ministry:

        lines = [
            line.strip()
            for line in text.split(".")
            if line.strip()
        ]

        for line in lines[:10]:

            if (
                line.startswith(
                    "Ministry of"
                )
                or line.startswith(
                    "Department of"
                )
            ):

                ministry = line[:300]

                break

    return {
        "published_at": published_at,
        "ministry": ministry,
    }


# ---------------------------------------------------------
# ARTICLE FETCH
# ---------------------------------------------------------

def fetch_article(url):

    response = get_response(
        url
    )

    metadata = extract_pib_metadata(
        response.text
    )

    raw_text = clean_text(
        response.text
    )

    return {
        "raw_text": raw_text,
        "published_at": metadata[
            "published_at"
        ],
        "ministry": metadata[
            "ministry"
        ],
    }


# ---------------------------------------------------------
# RSS
# ---------------------------------------------------------

def parse_rss(
    response,
    source_name
):

    try:

        # Use bytes so XML encoding declarations
        # are handled correctly.
        root = ET.fromstring(
            response.content
        )

    except ET.ParseError as error:

        print(
            "RSS XML parsing failed:"
        )

        print(error)

        print(
            "Falling back to PIB "
            "All Releases page."
        )

        return []

    items = root.findall(
        ".//item"
    )

    if not items:

        items = root.findall(
            ".//{*}entry"
        )

    print(
        f"RSS records discovered: "
        f"{len(items)}"
    )

    articles = []

    for item in items:

        def text(tag):

            element = item.find(
                tag
            )

            if element is not None:
                return (
                    element.text
                    or ""
                )

            element = item.find(
                f".//{{*}}{tag}"
            )

            if element is not None:
                return (
                    element.text
                    or ""
                )

            return ""

        title = text(
            "title"
        ).strip()

        guid = (
            text("guid").strip()
            or text("id").strip()
        )

        link = text(
            "link"
        ).strip()

        if not link:

            link_element = item.find(
                ".//{*}link"
            )

            if link_element is not None:

                link = (
                    link_element
                    .attrib
                    .get(
                        "href",
                        ""
                    )
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

        normalized_date = (
            normalize_datetime(
                published
            )
        )

        articles.append(
            {
                "guid": guid or link,

                "title": clean_text(
                    title
                ),

                "link": urljoin(
                    PIB_BASE,
                    link
                ),

                "published_at":
                    normalized_date,

                "source":
                    source_name,

                "summary":
                    clean_text(
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
    print(
        "=" * 70
    )

    print(
        "FALLBACK: PIB ALL RELEASES"
    )

    print(url)

    print(
        "=" * 70
    )

    response = get_response(
        url
    )

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

    for anchor in soup.find_all(
        "a"
    ):

        href = anchor.get(
            "href",
            ""
        )

        title = anchor.get_text(
            " ",
            strip=True
        )

        if not href or not title:
            continue

        href_lower = href.lower()

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

                "title": clean_text(
                    title
                ),

                "link": link,

                # We will retrieve the actual
                # date from the article page.
                "published_at":
                    None,

                "source":
                    "PIB All Releases",

                "summary":
                    "",
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

def save_articles(
    articles
):

    added = 0

    # -----------------------------------------------------
    # IMPORTANT
    #
    # Previously this was:
    #
    # articles = articles[:10]
    #
    # That meant only 10 articles could ever be
    # considered from each feed.
    # -----------------------------------------------------

    articles = articles[
        :MAX_ARTICLES_PER_RUN
    ]

    print(
        f"Articles selected for this run: "
        f"{len(articles)}"
    )

    for article in articles:

        print("")
        print(
            f"Fetching article: "
            f"{article['title']}"
        )

        raw_text = article.get(
            "summary",
            ""
        )

        published_at = article.get(
            "published_at"
        )

        ministry = ""

        try:

            result = fetch_article(
                article["link"]
            )

            raw_text = (
                result.get(
                    "raw_text"
                )
                or raw_text
            )

            # -------------------------------------------------
            # CRITICAL FIX:
            #
            # If RSS did not give us a date, use the
            # actual PIB article page.
            # -------------------------------------------------

            if not published_at:

                published_at = (
                    result.get(
                        "published_at"
                    )
                )

            ministry = (
                result.get(
                    "ministry",
                    ""
                )
                or ""
            )

            print(
                f"Article fetched: "
                f"{len(raw_text)} characters"
            )

            if published_at:

                print(
                    f"Publication date: "
                    f"{published_at}"
                )

            else:

                print(
                    "WARNING: "
                    "Publication date could not "
                    "be extracted."
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

            "guid":
                article["guid"],

            "title":
                article["title"],

            "link":
                article["link"],

            "published_at":
                published_at or None,

            "source":
                article["source"],

            "ministry":
                ministry,

            "raw_text":
                raw_text,

            "fetched_at":
                datetime.now(
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

        time.sleep(
            0.2
        )

    return added


# ---------------------------------------------------------
# MAIN COLLECTOR
# ---------------------------------------------------------

def collect():

    total_added = 0

    for feed_config in PIB_FEEDS:

        print("")
        print(
            "=" * 70
        )

        print(
            f"TRYING RSS: "
            f"{feed_config['name']}"
        )

        print(
            feed_config["url"]
        )

        print(
            "=" * 70
        )

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

                total_added += (
                    save_articles(
                        articles
                    )
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

            articles = (
                scrape_all_releases()
            )

            total_added += (
                save_articles(
                    articles
                )
            )

        except Exception as error:

            print(
                f"All Releases fallback failed: "
                f"{error}"
            )

    print("")
    print(
        "=" * 70
    )

    print(
        f"TOTAL NEW ARTICLES INSERTED: "
        f"{total_added}"
    )

    print(
        "=" * 70
    )

    return total_added


# ---------------------------------------------------------
# DIRECT EXECUTION
# ---------------------------------------------------------

if __name__ == "__main__":

    collect()
