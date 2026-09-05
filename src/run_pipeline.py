import argparse
import json

from .fetch_pib import collect
from .ai_processor import process_pending
from .db import get_client


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--batch",
        type=int,
        default=50,
    )

    args = parser.parse_args()

    print("")
    print("=" * 70)
    print("PIB UPSC PIPELINE")
    print("=" * 70)

    # =====================================================
    # STEP 1 — COLLECT PIB
    # =====================================================

    print("")
    print(
        "STEP 1: Collecting PIB articles..."
    )

    added = collect()

    print(
        f"New articles collected: {added}"
    )

    # =====================================================
    # STEP 2 — AI
    # =====================================================

    print("")
    print(
        "STEP 2: Starting Grok processing..."
    )

    processed = process_pending(
        args.batch
    )

    # =====================================================
    # STEP 3 — DATABASE STATS
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

    rows = (
        result.data
        or []
    )

    total = len(
        rows
    )

    processed_total = sum(
        1
        for row in rows
        if row.get(
            "processed"
        )
    )

    relevant_total = sum(
        1
        for row in rows
        if row.get(
            "relevant"
        )
    )

    high_priority_total = sum(
        1
        for row in rows
        if (
            row.get(
                "relevant"
            )
            and
            int(
                row.get(
                    "importance",
                    0,
                )
                or 0
            ) >= 7
        )
    )

    output = {

        "new_articles":
            added,

        "processed_now":
            processed,

        "database_total":
            total,

        "database_processed":
            processed_total,

        "database_relevant":
            relevant_total,

        "database_high_priority":
            high_priority_total,
    }

    print("")
    print(
        json.dumps(
            output,
            indent=2,
            ensure_ascii=False,
        )
    )

    print("")
    print(
        "=" * 70
    )


if __name__ == "__main__":

    main()
