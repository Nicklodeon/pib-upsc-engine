import argparse
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openai import OpenAI

from .config import OPENAI_API_KEY, OPENAI_MODEL, OUTPUT_DIR
from .db import connect

def week_rows(days):
    con = connect()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = con.execute("""
        SELECT * FROM articles
        WHERE processed=1 AND relevant=1 AND published_at >= ?
        ORDER BY importance DESC, published_at DESC
    """, (cutoff,)).fetchall()
    con.close()
    return rows

def make_digest(rows):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is missing.")

    payload = []
    for r in rows:
        payload.append({
            "title": r["title"],
            "date": r["published_at"],
            "ministry": r["ministry"],
            "importance": r["importance"],
            "gs_papers": json.loads(r["gs_papers"] or "[]"),
            "topics": json.loads(r["topics"] or "[]"),
            "prelims_facts": json.loads(r["prelims_facts"] or "[]"),
            "mains_notes": json.loads(r["mains_notes"] or "[]"),
            "data_points": json.loads(r["data_points"] or "[]"),
            "implications": json.loads(r["implications"] or "[]"),
            "questions": json.loads(r["possible_questions"] or "[]"),
            "url": r["link"],
        })

    prompt = f"""
Create a high-quality UPSC weekly current-affairs revision digest from the
following structured PIB items.

Rules:
- Prioritize the most consequential items.
- Consolidate duplicates and recurring announcements.
- Organize by GS1, GS2, GS3, GS4, Prelims-only and Essay/Interview where useful.
- For each major issue: What happened, why it matters, key facts, static linkage,
  implications/challenges, and one possible mains question.
- Keep it concise enough to revise in 45-60 minutes.
- Do not add facts that are not present in the supplied records.
- Preserve source URLs.

DATA:
{json.dumps(payload, ensure_ascii=False)}
"""

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.responses.create(
        model=OPENAI_MODEL,
        input=prompt,
    )
    return response.output_text

def export_flashcards(rows, path):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Question", "Answer", "Type", "Source", "Date", "Importance"])
        for r in rows:
            for card in json.loads(r["flashcards_json"] or "[]"):
                w.writerow([
                    card.get("question", ""),
                    card.get("answer", ""),
                    card.get("type", ""),
                    r["link"],
                    r["published_at"],
                    r["importance"],
                ])

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=7)
    args = p.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = week_rows(args.days)
    stamp = datetime.now().strftime("%Y-%m-%d")
    digest_path = OUTPUT_DIR / f"UPSC_PIB_Weekly_{stamp}.md"
    cards_path = OUTPUT_DIR / f"UPSC_PIB_Flashcards_{stamp}.csv"

    digest = make_digest(rows)
    digest_path.write_text(digest, encoding="utf-8")
    export_flashcards(rows, cards_path)

    print(f"Created: {digest_path}")
    print(f"Created: {cards_path}")
    print(f"Relevant articles included: {len(rows)}")

if __name__ == "__main__":
    main()
