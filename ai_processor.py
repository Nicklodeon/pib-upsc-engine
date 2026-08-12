import json
from datetime import datetime, timezone

from openai import OpenAI

from .config import OPENAI_API_KEY, OPENAI_MODEL
from .db import connect

SYSTEM_PROMPT = """
You are a UPSC Civil Services Examination current-affairs editor.

Your job is NOT to summarize every government press release. Decide whether an
article has meaningful UPSC value and extract only exam-useful information.

Priorities:
- Prelims facts: institutions, schemes, locations, species, reports, indices,
  constitutional/legal provisions, international organisations, geography,
  science concepts, important numbers.
- Mains value: causes, significance, challenges, government measures,
  criticism/limitations, way forward, constitutional/governance/economic/
  social/environmental/international-relations dimensions.
- Connect current affairs to static UPSC syllabus concepts.
- Avoid propaganda-style praise. Preserve factual neutrality.
- Do not invent facts. If a detail is absent from the article, write null or
  an empty list rather than guessing.
- Treat routine congratulations, ceremonial events and purely administrative
  announcements as low relevance unless they contain substantive policy facts.

Return JSON matching the supplied schema.
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "relevant": {"type": "boolean"},
        "importance": {"type": "integer", "minimum": 1, "maximum": 10},
        "gs_papers": {"type": "array", "items": {"type": "string"}},
        "topics": {"type": "array", "items": {"type": "string"}},
        "prelims_facts": {"type": "array", "items": {"type": "string"}},
        "mains_notes": {"type": "array", "items": {"type": "string"}},
        "data_points": {"type": "array", "items": {"type": "string"}},
        "schemes": {"type": "array", "items": {"type": "string"}},
        "institutions": {"type": "array", "items": {"type": "string"}},
        "implications": {"type": "array", "items": {"type": "string"}},
        "possible_questions": {"type": "array", "items": {"type": "string"}},
        "keywords": {"type": "array", "items": {"type": "string"}},
        "flashcards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                    "type": {"type": "string", "enum": ["Prelims", "Mains", "Concept"]},
                },
                "required": ["question", "answer", "type"],
                "additionalProperties": False,
            },
        },
    },
    "required": [
        "relevant", "importance", "gs_papers", "topics", "prelims_facts",
        "mains_notes", "data_points", "schemes", "institutions", "implications",
        "possible_questions", "keywords", "flashcards"
    ],
    "additionalProperties": False,
}

def client():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is missing. Put it in .env.")
    return OpenAI(api_key=OPENAI_API_KEY)

def process_one(con, row):
    text = (row["raw_text"] or "")[:30000]

    prompt = f"""
ARTICLE TITLE:
{row['title']}

MINISTRY/SOURCE:
{row['ministry'] or row['source']}

DATE:
{row['published_at']}

SOURCE URL:
{row['link']}

ARTICLE TEXT:
{text}
"""

    response = client().responses.create(
        model=OPENAI_MODEL,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "upsc_article_analysis",
                "strict": True,
                "schema": SCHEMA,
            }
        },
    )

    result = json.loads(response.output_text)

    con.execute(
        """UPDATE articles SET processed=1, relevant=?, importance=?,
        gs_papers=?, topics=?, prelims_facts=?, mains_notes=?, data_points=?,
        schemes=?, institutions=?, implications=?, possible_questions=?,
        keywords=?, flashcards_json=?, error=NULL WHERE id=?""",
        (
            int(result["relevant"]),
            result["importance"],
            json.dumps(result["gs_papers"], ensure_ascii=False),
            json.dumps(result["topics"], ensure_ascii=False),
            json.dumps(result["prelims_facts"], ensure_ascii=False),
            json.dumps(result["mains_notes"], ensure_ascii=False),
            json.dumps(result["data_points"], ensure_ascii=False),
            json.dumps(result["schemes"], ensure_ascii=False),
            json.dumps(result["institutions"], ensure_ascii=False),
            json.dumps(result["implications"], ensure_ascii=False),
            json.dumps(result["possible_questions"], ensure_ascii=False),
            json.dumps(result["keywords"], ensure_ascii=False),
            json.dumps(result["flashcards"], ensure_ascii=False),
            row["id"],
        ),
    )
    con.commit()

def process_pending(limit=25):
    con = connect()
    rows = con.execute(
        "SELECT * FROM articles WHERE processed=0 ORDER BY id LIMIT ?", (limit,)
    ).fetchall()

    done = 0
    for row in rows:
        try:
            process_one(con, row)
            done += 1
        except Exception as e:
            con.execute(
                "UPDATE articles SET error=? WHERE id=?",
                (str(e)[:1000], row["id"]),
            )
            con.commit()
    con.close()
    return done
