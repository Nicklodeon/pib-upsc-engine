import json

from openai import OpenAI

from .config import GROQ_API_KEY, GROQ_MODEL
from .db import get_client


SYSTEM_PROMPT = """
You are an expert UPSC Civil Services current-affairs editor.

Analyze the provided PIB article specifically for UPSC preparation.

Do NOT blindly summarize the article.

Identify:
1. Whether it is relevant for UPSC.
2. Importance from 1-10.
3. Relevant GS paper(s): GS1, GS2, GS3, GS4 and/or Prelims.
4. Specific UPSC topics.
5. Prelims facts worth memorising.
6. Mains-ready notes and arguments.
7. Important data, statistics and facts.
8. Government schemes/programmes.
9. Important institutions, organisations and bodies.
10. Implications for India, governance, economy, society,
    environment, science/technology or international relations.
11. Possible UPSC questions.
12. Keywords.
13. Flashcards.

Be conservative and factual.

NEVER invent facts that are not supported by the article.
If information is not available, return an empty list.

Routine ceremonial announcements should normally have low
importance unless they contain substantive policy information.

Importance:
1-3 = low relevance
4-6 = useful background
7-8 = important
9-10 = must know
"""


def get_client_ai():

    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is missing."
        )

    return OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )


def extract_json(text):

    text = text.strip()

    # Remove markdown code fences if the model added them.
    if text.startswith("```"):
        text = text.replace("```json", "", 1)
        text = text.replace("```", "", 1)

    text = text.strip()

    # Find the outermost JSON object.
    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1:
        raise ValueError(
            "Model did not return valid JSON."
        )

    return json.loads(
        text[start:end + 1]
    )


def analyse_article(row):

    client = get_client_ai()

    article_text = (
        row.get("raw_text") or ""
    )[:25000]

    prompt = f"""
Analyze this PIB article for UPSC preparation.

TITLE:
{row.get("title")}

MINISTRY:
{row.get("ministry")}

DATE:
{row.get("published_at")}

ARTICLE:
{article_text}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "relevant": true,
  "importance": 8,
  "gs_papers": ["GS2", "Prelims"],
  "topics": ["Governance", "Digital Public Infrastructure"],
  "prelims_facts": [
    "Fact 1",
    "Fact 2"
  ],
  "mains_notes": [
    "Point 1",
    "Point 2"
  ],
  "data_points": [
    "Important statistic"
  ],
  "schemes": [
    "Scheme or programme"
  ],
  "institutions": [
    "Institution or organisation"
  ],
  "implications": [
    "Implication 1",
    "Implication 2"
  ],
  "possible_questions": [
    "Possible UPSC Mains question",
    "Possible Prelims question"
  ],
  "keywords": [
    "Keyword 1",
    "Keyword 2"
  ],
  "flashcards": [
    {{
      "question": "Question",
      "answer": "Answer",
      "type": "Prelims"
    }},
    {{
      "question": "Question",
      "answer": "Answer",
      "type": "Concept"
    }}
  ]
}}

Rules:
- relevant must be true or false.
- importance must be an integer from 1 to 10.
- gs_papers must contain only GS1, GS2, GS3, GS4 or Prelims.
- flashcard type must be Prelims, Mains or Concept.
- Return empty arrays where information is unavailable.
- Do not invent facts.
"""

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.1,
        max_tokens=5000,
    )

    content = (
        response.choices[0]
        .message
        .content
    )

    return extract_json(content)


def process_one(row):

    supabase = get_client()

    result = analyse_article(row)

    update = {
        "processed": True,
        "relevant": bool(
            result.get("relevant", False)
        ),
        "importance": int(
            result.get("importance", 1)
        ),
        "gs_papers": result.get(
            "gs_papers", []
        ),
        "topics": result.get(
            "topics", []
        ),
        "prelims_facts": result.get(
            "prelims_facts", []
        ),
        "mains_notes": result.get(
            "mains_notes", []
        ),
        "data_points": result.get(
            "data_points", []
        ),
        "schemes": result.get(
            "schemes", []
        ),
        "institutions": result.get(
            "institutions", []
        ),
        "implications": result.get(
            "implications", []
        ),
        "possible_questions": result.get(
            "possible_questions", []
        ),
        "keywords": result.get(
            "keywords", []
        ),
        "flashcards": result.get(
            "flashcards", []
        ),
        "processing_error": None,
    }

    (
        supabase
        .table("articles")
        .update(update)
        .eq("id", row["id"])
        .execute()
    )


def process_pending(limit=5):

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

    print(
        f"Pending articles: {len(rows)}"
    )

    processed = 0

    for row in rows:

        try:

            print(
                f"Processing: "
                f"{row['title']}"
            )

            process_one(row)

            processed += 1

            print("✓ AI analysis saved")

        except Exception as error:

            print(
                f"ERROR: {error}"
            )

            (
                supabase
                .table("articles")
                .update(
                    {
                        "processing_error":
                            str(error)[:1000]
                    }
                )
                .eq(
                    "id",
                    row["id"]
                )
                .execute()
            )

    return processed
