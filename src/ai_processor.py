import json

from openai import OpenAI

from .config import OPENAI_API_KEY, OPENAI_MODEL
from .db import get_client


SYSTEM_PROMPT = """
You are a UPSC Civil Services Examination current-affairs editor.

Analyze Indian government/PIB articles for UPSC usefulness.

Do NOT simply summarize the government announcement.

Your job is to identify:
- Prelims facts
- Mains-relevant issues
- Static syllabus connections
- Important data
- Government schemes
- Institutions
- Laws and policies
- International organisations
- Environmental/scientific concepts
- Economic implications
- Governance implications
- Possible UPSC questions

Be factually conservative.
Do not invent information that is not present in the article.
If something is not available, return an empty list.

Give the article an importance score from 1 to 10.

1-3 = low UPSC relevance
4-6 = useful background
7-8 = important
9-10 = must know

Classify the article into GS1, GS2, GS3, GS4, Prelims or multiple where appropriate.

Routine ceremonial announcements should normally receive low importance.
"""


SCHEMA = {
    "type": "object",
    "properties": {
        "relevant": {
            "type": "boolean"
        },
        "importance": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10
        },
        "gs_papers": {
            "type": "array",
            "items": {"type": "string"}
        },
        "topics": {
            "type": "array",
            "items": {"type": "string"}
        },
        "prelims_facts": {
            "type": "array",
            "items": {"type": "string"}
        },
        "mains_notes": {
            "type": "array",
            "items": {"type": "string"}
        },
        "data_points": {
            "type": "array",
            "items": {"type": "string"}
        },
        "schemes": {
            "type": "array",
            "items": {"type": "string"}
        },
        "institutions": {
            "type": "array",
            "items": {"type": "string"}
        },
        "implications": {
            "type": "array",
            "items": {"type": "string"}
        },
        "possible_questions": {
            "type": "array",
            "items": {"type": "string"}
        },
        "keywords": {
            "type": "array",
            "items": {"type": "string"}
        },
        "flashcards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": [
                            "Prelims",
                            "Mains",
                            "Concept"
                        ]
                    }
                },
                "required": [
                    "question",
                    "answer",
                    "type"
                ],
                "additionalProperties": False
            }
        }
    },
    "required": [
        "relevant",
        "importance",
        "gs_papers",
        "topics",
        "prelims_facts",
        "mains_notes",
        "data_points",
        "schemes",
        "institutions",
        "implications",
        "possible_questions",
        "keywords",
        "flashcards"
    ],
    "additionalProperties": False
}


def get_openai_client():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is missing.")

    return OpenAI(api_key=OPENAI_API_KEY)


def process_one(row):
    client = get_openai_client()
    supabase = get_client()

    article_text = (row.get("raw_text") or "")[:30000]

    prompt = f"""
ARTICLE TITLE:
{row.get("title")}

MINISTRY:
{row.get("ministry")}

DATE:
{row.get("published_at")}

SOURCE:
{row.get("link")}

ARTICLE:

{article_text}
"""

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "upsc_article_analysis",
                "strict": True,
                "schema": SCHEMA
            }
        }
    )

    result = json.loads(response.output_text)

    supabase.table("articles").update(
        {
            "processed": True,
            "relevant": result["relevant"],
            "importance": result["importance"],
            "gs_papers": result["gs_papers"],
            "topics": result["topics"],
            "prelims_facts": result["prelims_facts"],
            "mains_notes": result["mains_notes"],
            "data_points": result["data_points"],
            "schemes": result["schemes"],
            "institutions": result["institutions"],
            "implications": result["implications"],
            "possible_questions": result["possible_questions"],
            "keywords": result["keywords"],
            "flashcards": result["flashcards"],
            "processing_error": None
        }
    ).eq("id", row["id"]).execute()


def process_pending(limit=25):
    supabase = get_client()

    response = (
        supabase
        .table("articles")
        .select("*")
        .eq("processed", False)
        .order("id")
        .limit(limit)
        .execute()
    )

    rows = response.data or []

    processed = 0

    for row in rows:
        try:
            print(f"Processing: {row['title']}")
            process_one(row)
            processed += 1

        except Exception as e:
            print(f"ERROR: {e}")

            (
                supabase
                .table("articles")
                .update(
                    {
                        "processing_error": str(e)[:1000]
                    }
                )
                .eq("id", row["id"])
                .execute()
            )

    return processed
