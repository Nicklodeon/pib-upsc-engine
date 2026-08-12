import argparse
import json

from .fetch_pib import collect
from .ai_processor import process_pending
from .db import get_client


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=25)
    args = parser.parse_args()

    print("Starting PIB collection...")

    added = collect()

    print(f"New articles collected: {added}")
    print("Starting AI processing...")

    processed = process_pending(args.batch)

    client = get_client()

    result = (
        client
        .table("articles")
        .select("id, processed, relevant")
        .execute()
    )

    rows = result.data or []

    total = len(rows)
    processed_total = sum(1 for r in rows if r.get("processed"))
    relevant_total = sum(1 for r in rows if r.get("relevant"))

    print(
        json.dumps(
            {
                "new_articles": added,
                "processed_now": processed,
                "database_total": total,
                "database_processed": processed_total,
                "database_relevant": relevant_total,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
