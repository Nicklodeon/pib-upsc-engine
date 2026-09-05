import json

from openai import OpenAI

from .config import (
    XAI_API_KEY,
    XAI_MODEL,
    AI_BATCH_SIZE,
)

from .db import get_client


SYSTEM_PROMPT = """
You are an expert UPSC Civil Services current-affairs editor.

Analyze PIB releases specifically for UPSC preparation.

Do not blindly summarize every announcement.

Determine whether the article contains meaningful UPSC
relevant substance.

Relevant areas include:

- Constitution
- Governance
- Government policy
- Welfare
- Economy
- Agriculture
- Environment
- Science and technology
- Security
- International relations
- Social issues
- Important institutions
- Government schemes
- Significant statistics
- Major national programmes
- Important developments with long-term relevance

Routine ceremonial announcements should normally be
irrelevant unless they contain substantive information.

Be conservative and factual.

NEVER invent information.

Only use information contained in the article.

Importance:

0 = irrelevant
1-3 = low relevance
4-6 = useful background
7-8 = important
9-10 = must know
"""


# =========================================================
# GROK CLIENT
# =========================================================

def get_client_ai():

    if not XAI_API_KEY:

        raise RuntimeError(
            "XAI_API_KEY is missing."
        )

    return OpenAI(
        api_key=XAI_API_KEY,
        base_url="https://api.x.ai/v1",
    )


# =========================================================
# JSON
# =========================================================

def extract_json(text):

    if not text:

        raise ValueError(
            "Empty Grok response."
        )

    text = text.strip()

    if text.startswith(
        "```"
    ):

        text = (
            text
            .replace(
                "```json",
                "",
                1,
            )
            .replace(
                "```",
                "",
                1,
            )
            .strip()
        )

    start = text.find(
        "{"
    )

    end = text.rfind(
        "}"
    )

    if (
        start == -1
        or end == -1
    ):

        raise ValueError(
            "Grok did not return valid JSON."
        )

    return json.loads(
        text[
            start:end + 1
        ]
    )


# =========================================================
# ANALYSE
# =========================================================

def analyse_article(row):

    client = get_client_ai()

    article_text = (
        row.get(
            "raw_text"
        )
        or ""
    )[:12000]

    prompt = f"""
Analyze this PIB article for UPSC preparation.

ORIGINAL TITLE:
{row.get("title", "")}

MINISTRY:
{row.get("ministry", "")}

DATE:
{row.get("published_at", "")}

ARTICLE:
{article_text}

Return ONLY valid JSON.

Use exactly:

{{
    "relevant": true,
    "importance": 8,
    "english_title": "",
    "english_summary": "",
    "gs_papers": [],
    "topics": [],
    "prelims_facts": [],
    "mains_notes": [],
    "data_points": [],
    "schemes": [],
    "institutions": [],
    "implications": [],
    "possible_questions": [],
    "keywords": [],
    "flashcards": []
}}

Rules:

- relevant = true or false.
- importance = integer 0-10.
- If irrelevant:
  relevant=false
  importance=0
  analytical arrays empty.
- Relevant articles should normally have importance >= 4.
- GS values may only be:
  GS1, GS2, GS3, GS4, Prelims.
- Translate Hindi/regional titles accurately into English.
- English summary must be 80-120 words.
- Do not invent facts.
- Maximum 5 prelims facts.
- Maximum 5 mains notes.
- Maximum 3 data points.
- Maximum 3 schemes.
- Maximum 5 institutions.
- Maximum 5 implications.
- Maximum 3 possible questions.
- Maximum 8 keywords.
- Maximum 5 flashcards.
- Flashcard type must be:
  Prelims, Mains or Concept.
- Keep content concise and UPSC-oriented.
"""


    response = (
        client
        .chat
        .completions
        .create(
            model=XAI_MODEL,

            messages=[
                {
                    "role":
                        "system",
                    "content":
                        SYSTEM_PROMPT,
                },
                {
                    "role":
                        "user",
                    "content":
                        prompt,
                },
            ],

            temperature=0.1,

            max_tokens=2500,

            response_format={
                "type":
                    "json_object"
            },
        )
    )


    content = (
        response
        .choices[0]
        .message
        .content
    )


    return extract_json(
        content
    )


# =========================================================
# NORMALISE
# =========================================================

def normalise_result(
    result,
    row
):

    relevant = bool(
        result.get(
            "relevant",
            False,
        )
    )


    try:

        importance = int(
            result.get(
                "importance",
                0,
            )
        )

    except Exception:

        importance = 0


    importance = max(
        0,
        min(
            10,
            importance,
        )
    )


    if not relevant:

        importance = 0


    if (
        relevant
        and
        importance < 4
    ):

        importance = 4


    allowed_gs = {
        "GS1",
        "GS2",
        "GS3",
        "GS4",
        "Prelims",
    }


    gs_papers = [
        x
        for x in (
            result.get(
                "gs_papers",
                [],
            )
            or []
        )
        if x in allowed_gs
    ]


    return {

        "processed":
            True,

        "relevant":
            relevant,

        "importance":
            importance,

        "gs_papers":
            gs_papers,

        "topics":
            result.get(
                "topics",
                [],
            )
            or [],

        "prelims_facts":
            result.get(
                "prelims_facts",
                [],
            )
            or [],

        "mains_notes":
            result.get(
                "mains_notes",
                [],
            )
            or [],

        "data_points":
            result.get(
                "data_points",
                [],
            )
            or [],

        "schemes":
            result.get(
                "schemes",
                [],
            )
            or [],

        "institutions":
            result.get(
                "institutions",
                [],
            )
            or [],

        "implications":
            result.get(
                "implications",
                [],
            )
            or [],

        "possible_questions":
            result.get(
                "possible_questions",
                [],
            )
            or [],

        "keywords":
            result.get(
                "keywords",
                [],
            )
            or [],

        "flashcards":
            result.get(
                "flashcards",
                [],
            )
            or [],

        "english_title":
            result.get(
                "english_title",
                "",
            )
            or row.get(
                "title",
                "",
            ),

        "english_summary":
            result.get(
                "english_summary",
                "",
            )
            or "",

        "processing_error":
            None,
    }


# =========================================================
# PROCESS ONE
# =========================================================

def process_one(row):

    supabase = get_client()

    print(
        f"Processing: "
        f"{row.get('title', '')}"
    )


    result = analyse_article(
        row
    )


    update = normalise_result(
        result,
        row,
    )


    (
        supabase
        .table("articles")
        .update(update)
        .eq(
            "id",
            row["id"],
        )
        .execute()
    )


    print(
        "✓ SAVED | "
        f"Relevant={update['relevant']} | "
        f"Importance={update['importance']}/10"
    )


# =========================================================
# PENDING
# =========================================================

def process_pending(
    limit=AI_BATCH_SIZE
):

    supabase = get_client()


    response = (
        supabase
        .table("articles")
        .select("*")
        .eq(
            "processed",
            False,
        )
        .order(
            "id",
            desc=False,
        )
        .limit(
            limit
        )
        .execute()
    )


    rows = (
        response.data
        or []
    )


    print(
        f"Pending articles: "
        f"{len(rows)}"
    )


    processed = 0


    for row in rows:

        try:

            process_one(
                row
            )

            processed += 1

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
                            str(error)[
                                :1000
                            ]
                    }
                )
                .eq(
                    "id",
                    row["id"],
                )
                .execute()
            )


    return processed
