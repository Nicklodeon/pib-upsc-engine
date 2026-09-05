import re
import time

from datetime import (
    datetime,
    timezone,
    timedelta,
)

from email.utils import (
    parsedate_to_datetime,
)

from urllib.parse import urljoin

from xml.etree import ElementTree as ET

import requests

from bs4 import BeautifulSoup

from .config import (
    PIB_FEEDS,
    USER_AGENT,
    COLLECT_BATCH_SIZE,
)

from .db import insert_article


PIB_BASE = (
    "https://www.pib.gov.in"
)


# =========================================================
# CLEAN TEXT
# =========================================================

def clean_text(html):

    soup = BeautifulSoup(
        html or "",
        "html.parser",
    )

    for tag in soup(
        [
            "script",
            "style",
            "noscript",
        ]
    ):
        tag.decompose()

    text = soup.get_text(
        " ",
        strip=True,
    )

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


# =========================================================
# HTTP
# =========================================================

def get_response(url):

    headers = {
        "User-Agent": (
            USER_AGENT
            or "Mozilla/5.0"
        ),
        "Accept": (
            "text/html,"
            "application/xhtml+xml,"
            "application/xml,"
            "q=0.9,*/*;q=0.8"
        ),
        "Accept-Language":
            "en-US,en;q=0.9",
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    return response


# =========================================================
# DATE NORMALISATION
# =========================================================

def normalize_datetime(value):

    if not value:
        return None

    value = str(value).strip()

    if not value:
        return None

    # ISO
    try:

        parsed = datetime.fromisoformat(
            value.replace(
                "Z",
                "+00:00",
            )
        )

        if parsed.tzinfo is None:

            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.isoformat()

    except Exception:
        pass

    # RSS / RFC822
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

    # PIB
    cleaned = re.sub(
        r"\s+by\s+PIB.*$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip()

    formats = [
        "%d %b %Y %I:%M%p",
        "%d %b %Y %I:%M %p",
        "%d %B %Y %I:%M%p",
        "%d %B %Y %I:%M %p",
    ]

    for fmt in formats:

        try:

            parsed = datetime.strptime(
                cleaned,
                fmt,
            )

            ist = timezone(
                timedelta(
                    hours=5,
                    minutes=30,
                )
            )

            parsed = parsed.replace(
                tzinfo=ist
            )

            return parsed.isoformat()

        except Exception:
            continue

    return None


# =========================================================
# PIB POSTED DATE
# =========================================================

def extract_pib_posted_date(html):

    if not html:
        return None

    text = clean_text(
        html
    )

    patterns = [

        r"Posted\s*On\s*:\s*"
        r"(\d{1,2}\s+[A-Za-z]{3,9}"
        r"\s+\d{4}\s+\d{1,2}:\d{2}"
        r"\s*(?:AM|PM))",

        r"Posted\s+On\s*:\s*"
        r"(\d{1,2}\s+[A-Za-z]{3,9}"
        r"\s+\d{4}\s+\d{1,2}:\d{2}"
        r"\s*(?:AM|PM))",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            return normalize_datetime(
                match.group(1)
            )

    return None


# =========================================================
# PIB METADATA
# =========================================================

def extract_pib_metadata(html):

    if not html:

        return {
            "published_at": None,
            "ministry": "",
        }

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    text = clean_text(
        html
    )

    published_at = (
        extract_pib_posted_date(
            html
        )
    )

    ministry = ""

    selectors = [
        ".MinistryName",
        ".ministry",
        ".ministery",
        "#ctl00_ContentPlaceHolder1_lblMinistry",
    ]

    for selector in selectors:

        element = soup.select_one(
            selector
        )

        if element:

            ministry = clean_text(
                element.get_text(
                    " ",
                    strip=True,
                )
            )

            if ministry:
                break

    if not ministry:

        for sentence in text.split(".")[:30]:

            sentence = sentence.strip()

            if (
                sentence.startswith(
                    "Ministry of"
                )
                or
                sentence.startswith(
                    "Department of"
                )
            ):

                ministry = sentence[:300]

                break

    return {
        "published_at":
            published_at,

        "ministry":
            ministry,
    }


# =========================================================
# ARTICLE
# =========================================================

def fetch_article(url):

    response = get_response(
        url
    )

    metadata = (
        extract_pib_metadata(
            response.text
        )
    )

    return {
        "raw_text":
            clean_text(
                response.text
            ),

        "published_at":
            metadata[
                "published_at"
            ],

        "ministry":
            metadata[
                "ministry"
            ],
    }


# =========================================================
# RSS PARSER
# =========================================================

def parse_rss(
    response,
    source_name,
):

    try:

        root = ET.fromstring(
            response.content
        )

    except ET.ParseError as error:

        print(
            "RSS XML parsing failed:",
            error,
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
            or
            text("id").strip()
        )

        link = text(
            "link"
        ).strip()

        if not link:

            link_element = (
                item.find(
                    ".//{*}link"
                )
            )

            if link_element:

                link = (
                    link_element
                    .attrib
                    .get(
                        "href",
                        "",
                    )
                )

        published = (
            text(
                "pubDate"
            ).strip()
            or
            text(
                "published"
            ).strip()
            or
            text(
                "updated"
            ).strip()
        )

        description = (
            text(
                "description"
            )
            or
            text(
                "summary"
            )
            or
            text(
                "content"
            )
        )

        if not title or not link:
            continue

        articles.append(
            {
                "guid":
                    guid or link,

                "title":
                    clean_text(
                        title
                    ),

                "link":
                    urljoin(
                        PIB_BASE,
                        link,
                    ),

                "published_at":
                    normalize_datetime(
                        published
                    ),

                "source":
                    source_name,

                "summary":
                    clean_text(
                        description
                    ),
            }
        )

    return articles


# =========================================================
# FALLBACK
# =========================================================

def scrape_all_releases():

    url = (
        "https://www.pib.gov.in/"
        "AllRelease.aspx?lang=1&reg=3"
    )

    response = get_response(
        url
    )

    soup = BeautifulSoup(
        response.text,
        "html.parser",
    )

    articles = []

    seen = set()

    for anchor in soup.find_all(
        "a"
    ):

        href = anchor.get(
            "href",
            "",
        )

        title = anchor.get_text(
            " ",
            strip=True,
        )

        if not href or not title:
            continue

        href_lower = href.lower()

        valid = any(
            pattern in href_lower
            for pattern in [
                "pressreleasepage.aspx",
                "pressrelesedetail.aspx",
                "pressreleaseiframepage.aspx",
                "pressnotedetails.aspx",
            ]
        )

        if not valid:
            continue

        link = urljoin(
            PIB_BASE,
            href,
        )

        if link in seen:
            continue

        seen.add(link)

        articles.append(
            {
                "guid":
                    link,

                "title":
                    clean_text(
                        title
                    ),

                "link":
                    link,

                "published_at":
                    None,

                "source":
                    "PIB All Releases",

                "summary":
                    "",
            }
        )

    return articles


# =========================================================
# SAVE
# =========================================================

def save_articles(
    articles
):

    added = 0

    selected = articles[
        :COLLECT_BATCH_SIZE
    ]

    print(
        f"Articles selected: "
        f"{len(selected)}"
    )

    for article in selected:

        print("")
        print(
            "Fetching:",
            article["title"],
        )

        raw_text = (
            article.get(
                "summary"
            )
            or ""
        )

        published_at = (
            article.get(
                "published_at"
            )
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

            if result.get(
                "published_at"
            ):

                published_at = (
                    result[
                        "published_at"
                    ]
                )

            ministry = (
                result.get(
                    "ministry"
                )
                or ""
            )

            print(
                "Publication date:",
                published_at,
            )

        except Exception as error:

            print(
                "Article fetch failed:",
                error,
            )

            if not raw_text:
                continue

        item = {

            "guid":
                article["guid"],

            "title":
                article["title"],

            "link":
                article["link"],

            "published_at":
                published_at,

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
                    "✓ NEW ARTICLE"
                )

            else:

                print(
                    "✓ EXISTING ARTICLE UPDATED"
                )

        except Exception as error:

            print(
                "Supabase error:",
                error,
            )

        time.sleep(
            0.15
        )

    return added


# =========================================================
# COLLECT
# =========================================================

def collect():

    total_added = 0

    for feed in PIB_FEEDS:

        print("")
        print(
            "=" * 70
        )

        print(
            f"PIB FEED: "
            f"{feed['name']}"
        )

        try:

            response = get_response(
                feed["url"]
            )

            articles = parse_rss(
                response,
                feed["name"],
            )

            if articles:

                total_added += (
                    save_articles(
                        articles
                    )
                )

            else:

                print(
                    "No RSS articles found."
                )

        except Exception as error:

            print(
                "RSS error:",
                error,
            )

    if total_added == 0:

        try:

            fallback = (
                scrape_all_releases()
            )

            total_added += (
                save_articles(
                    fallback
                )
            )

        except Exception as error:

            print(
                "Fallback error:",
                error,
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


if __name__ == "__main__":

    collect()
