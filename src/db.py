from supabase import create_client

from .config import (
    SUPABASE_URL,
    SUPABASE_KEY,
)


def get_client():

    if not SUPABASE_URL:
        raise RuntimeError(
            "SUPABASE_URL is missing."
        )

    if not SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_KEY is missing."
        )

    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
    )


def insert_article(item):

    client = get_client()

    guid = item["guid"]

    # =====================================================
    # CHECK EXISTING ARTICLE
    # =====================================================

    existing = (
        client
        .table("articles")
        .select("id")
        .eq("guid", guid)
        .limit(1)
        .execute()
    )

    rows = existing.data or []

    # =====================================================
    # EXISTING ARTICLE
    # =====================================================

    if rows:

        article_id = rows[0]["id"]

        update_data = {
            "title": item.get("title"),
            "link": item.get("link"),
            "published_at": item.get(
                "published_at"
            ),
            "source": item.get("source"),
            "ministry": item.get(
                "ministry"
            ),
            "raw_text": item.get(
                "raw_text"
            ),
            "fetched_at": item.get(
                "fetched_at"
            ),
        }

        (
            client
            .table("articles")
            .update(update_data)
            .eq(
                "id",
                article_id
            )
            .execute()
        )

        print(
            f"Updated existing article: "
            f"{article_id}"
        )

        return False

    # =====================================================
    # NEW ARTICLE
    # =====================================================

    data = {
        "guid": guid,
        "title": item.get("title"),
        "link": item.get("link"),
        "published_at": item.get(
            "published_at"
        ),
        "source": item.get("source"),
        "ministry": item.get(
            "ministry"
        ),
        "raw_text": item.get(
            "raw_text"
        ),
        "fetched_at": item.get(
            "fetched_at"
        ),

        "processed": False,
        "relevant": False,
        "importance": 0,
    }

    result = (
        client
        .table("articles")
        .insert(data)
        .execute()
    )

    return bool(
        result.data
    )
