import argparse
import json

from .fetch_pib import collect
from .ai_processor import process_pending
from .db import get_client


def main():
    parser = argparse.ArgumentParser(
        description="Collect PIB releases and process them with Groq."
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=50,
        help="Maximum number of pending articles to process.",
    )

    args = parser.parse_args()

    # =====================================================
    # PIB COLLECTION
    # =====================================================

    print("=" * 60)
    print("STARTING PIB COLLECTION")
    print("=" * 60)

    added = collect()

    print(
        f"New articles collected: {added}"
    )

    # =====================================================
    # GROQ PROCESSING
    # =====================================================

    print("=" * 60)
    print("STARTING GROQ AI PROCESSING")
    print("=" * 60)

    processed = process_pending(
        args.batch
    )

    # =====================================================
    # DATABASE SUMMARY
    # =====================================================

    client = get_client()

    result = (
        client
        .table("articles")
        .select(
            "id, processed, relevant, importance"
        )
        .execute()
    )

    rows = result.data or []

    total = len(rows)

    processed_total = sum(
        1
        for row in rows
        if row.get("processed") is True
    )

    pending_total = total - processed_total

    relevant_total = sum(
        1
        for row in rows
        if row.get("relevant") is True
    )

    high_priority_total = sum(
        1
        for row in rows
        if (
            row.get("relevant") is True
            and int(row.get("importance") or 0) >= 7
        )
    )

    summary = {
        "new_articles": added,
        "processed_now": processed,
        "database_total": total,
        "database_processed": processed_total,
        "database_pending": pending_total,
        "database_relevant": relevant_total,
        "database_high_priority": high_priority_total,
    }

    print("=" * 60)
    print("PIPELINE SUMMARY")
    print("=" * 60)

    print(
        json.dumps(
            summary,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
