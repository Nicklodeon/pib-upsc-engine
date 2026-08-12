from .db import get_client


def main():
    client = get_client()

    result = (
        client
        .table("articles")
        .select("processed, relevant, importance")
        .execute()
    )

    rows = result.data or []

    total = len(rows)

    processed = sum(
        1 for r in rows
        if r.get("processed")
    )

    relevant = sum(
        1 for r in rows
        if r.get("relevant")
    )

    importance_values = [
        r["importance"]
        for r in rows
        if r.get("relevant")
        and r.get("importance") is not None
    ]

    average_importance = (
        sum(importance_values) / len(importance_values)
        if importance_values
        else 0
    )

    print(f"Total articles: {total}")
    print(f"Processed: {processed}")
    print(f"Relevant: {relevant}")
    print(f"Average importance: {average_importance:.2f}")


if __name__ == "__main__":
    main()
