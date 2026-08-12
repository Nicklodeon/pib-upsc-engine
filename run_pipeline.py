import argparse
import json
from datetime import datetime, timedelta, timezone

from .fetch_pib import collect
from .ai_processor import process_pending
from .db import connect

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--hours", type=int, default=24,
                   help="Retention window for future extensions; collector currently fetches feed's available items.")
    p.add_argument("--batch", type=int, default=25)
    args = p.parse_args()

    added = collect()
    processed = process_pending(args.batch)

    con = connect()
    counts = con.execute("""
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN processed=1 THEN 1 ELSE 0 END) AS processed,
          SUM(CASE WHEN relevant=1 THEN 1 ELSE 0 END) AS relevant
        FROM articles
    """).fetchone()
    con.close()

    print(json.dumps({
        "new_articles": added,
        "processed_now": processed,
        "database_total": counts["total"],
        "database_processed": counts["processed"],
        "database_relevant": counts["relevant"],
    }, indent=2))

if __name__ == "__main__":
    main()
