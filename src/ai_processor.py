import json

from openai import OpenAI

from .config import (
    XAI_API_KEY,
    XAI_MODEL,
    AI_BATCH_SIZE,
)

from .db import get_client


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an expert UPSC Civil Services current-affairs editor.

Analyze PIB releases specifically for UPSC preparation.

Your job is NOT to blindly summarize every government
announcement.

Determine whether the article contains meaningful
UPSC-relevant substance.

Consider:

- Constitutional issues
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

Routine ceremonial announcements should generally be
marked irrelevant unless they contain substantive
policy, institutional, economic, scientific, social,
environmental, security or international significance.

Be conservative.

Do not invent facts.

Only use information contained in the article.

Importance:

1-3 = low relevance
4-6 = useful background
7-8 = important UPSC material
9-10 = very important / must know

A genuinely irrelevant PIB announcement MUST have:

relevant = false
importance = 0

A relevant article should normally have importance >= 4.

Return English content even if the original PIB article
is in Hindi.
"""


# =========================================================
# CLIENT
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
# JSON EXTRACTION
# =========================================================

def extract_json(text):

    if not text:

        raise ValueError(
            "Empty AI response."
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
            "AI did not return valid JSON."
        )

    return json.loads(
        text[
            start:end + 1
        ]
    )


# =========================================================
# AI ANALYSIS
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
Analyze this PIB article for UPSC Civil Services preparation.

ORIGINAL TITLE:
{row.get("title", "")}

MINISTRY:
{row.get("ministry", "")}

PUBLICATION DATE:
{row.get("published_at", "")}

ARTICLE:
{article_text}

Return ONLY JSON.

Use exactly this structure:

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

1. relevant must be true or false.

2. importance must be an integer 0-10.

3. If the article is not substantively relevant to UPSC:
   - relevant = false
   - importance = 0
   - all analytical arrays should be empty.

4. Relevant articles should normally have importance >= 4.

5. gs_papers may contain only:
   GS1
   GS2
   GS3
   GS4
   Prelims

6. Translate the title accurately into English.

7. Write the summary in English.

8. Summary must be approximately 80-120 words.

9. Do NOT invent facts.

10. Maximum:
   prelims_facts = 5
   mains_notes = 5
   data_points = 3
   schemes = 3
   institutions = 5
   implications = 5
   possible_questions = 3
   keywords = 8
   flashcards = 5

11. Flashcards must have:

{{
    "question": "...",
    "answer": "...",
    "type": "Prelims"
}}

Allowed flashcard types:
Prelims
Mains
Concept

12. Keep all outputs concise and exam-oriented.

13. Ceremonial announcements without substantive content
should normally be irrelevant.
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
# NORMALISE AI RESULT
# =========================================================

def normalise_result(result):

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

    if importance < 0:
        importance = 0

    if importance > 10:
        importance = 10

    # Important consistency rule
    if not relevant:

        importance = 0

    if relevant and importance < 4:

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
            or "",

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
        result
    )

    # Fallback title
    if not update[
        "english_title"
    ]:

        update[
            "english_title"
        ] = row.get(
            "title",
            "",
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
        "✓ AI analysis saved | "
        f"Relevant={update['relevant']} | "
        f"Importance={update['importance']}/10"
    )


# =========================================================
# PROCESS PENDING
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
