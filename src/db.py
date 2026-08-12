from supabase import create_client
from .config import SUPABASE_URL, SUPABASE_KEY


def get_client():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is missing.")

    if not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_KEY is missing.")

    return create_client(SUPABASE_URL, SUPABASE_KEY)


def insert_article(item):
    client = get_client()

    data = {
        "guid": item["guid"],
        "title": item["title"],
        "link": item.get("link"),
        "published_at": item.get("published_at"),
        "source": item.get("source"),
        "ministry": item.get("ministry"),
        "raw_text": item.get("raw_text"),
        "fetched_at": item.get("fetched_at"),
    }

    result = (
        client
        .table("articles")
        .upsert(data, on_conflict="guid", ignore_duplicates=True)
        .execute()
    )

    return bool(result.data)
