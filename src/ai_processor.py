import json
import time
import requests

from .config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    AI_BATCH_SIZE,
)
from .db import get_client


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


# =========================================================
# BOOLEAN
# =========================================================

def as_bool(value):
    if value is True:
        return True

    if value is False:
        return False

    if value is None:
        return False

    return str(value).strip().lower() in {
        "true",
        "1",
        "yes",
        "y",
    }


# =========================================================
# INTEGER
# =========================================================

def as_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an expert UPSC Civil Services Examination current-affairs analyst.

Analyse official Press Information Bureau (PIB) releases and convert them
into useful UPSC preparation material.

Be selective about relevance.

Relevant areas include:

- Government policies and schemes
- Acts and laws
- Constitution
- Governance
- International relations
- Economy
- Environment and ecology
- Science and technology
- Defence and security
- Agriculture
- Social issues
- Infrastructure
- Important institutions
- Reports and indices
- Committees
- Government programmes
- Important data
- International organisations
- Geography
- Important species and places
- Developments useful for UPSC Prelims or Mains

Generally mark routine ceremonial material as NOT relevant:

- Congratulatory messages
- Birthday greetings
- Routine tributes
- Routine condolences
- Routine courtesy meetings
- Generic publicity material

Importance:

0-3 = Very low
4-6 = Moderate
7-8 = Important
9-10 = Very important / highly exam relevant

Do not invent information.

Return ONLY valid JSON.
"""


# =========================================================
# USER PROMPT
# =========================================================

def build_prompt(article):
    title = article.get("title") or ""
    ministry = article.get("ministry") or ""
    published_at = article.get("published_at") or ""
    raw_text = article.get("raw_text") or ""

    # Keep requests safely bounded.
    raw_text = raw_text[:30000]

    return f"""
Analyse this PIB release for UPSC preparation.

TITLE:
{title}

MINISTRY:
{ministry}

DATE:
{published_at}

FULL PIB TEXT:
{raw_text}

Return JSON with exactly these fields:

{{
  "relevant": true,
  "importance": 0,
  "english_title": "",
  "english_summary": "",
  "gs_papers": [],
  "topics": [],
  "prelims_points": [],
  "mains_points": [],
  "data_points": [],
  "schemes": [],
  "institutions": [],
  "implications": [],
  "possible_questions": [],
  "keywords": [],
  "flashcards": [
    {{
      "question": "",
      "answer": ""
    }}
  ]
}}

Rules:

1. relevant must be true or false.
2. importance must be an integer from 0 to 10.
3. english_title must be a clean English UPSC-style title.
4. english_summary should be approximately 80-120 words.
5. gs_papers can contain:
   GS1, GS2, GS3, GS4, Prelims.
6. topics should be concise.
7. prelims_points should contain useful factual/conceptual points.
8. mains_points should contain analytical points.
9. data_points should contain only data actually present in the PIB text.
10. schemes should contain relevant schemes/programmes.
11. institutions should contain relevant organisations.
12. implications should explain important consequences.
13. possible_questions should contain potential UPSC questions.
14. keywords should contain useful search terms.
15. flashcards should contain useful question-answer pairs.
16. Do not invent facts.
17. If irrelevant, keep UPSC-specific fields mostly empty.
"""


# =========================================================
# PARSE JSON
# =========================================================

def parse_json(content):
    if not content:
        raise ValueError(
            "Groq returned an empty response."
        )

    content = content.strip()

    # Remove markdown fences if Groq accidentally adds them.
    if content.startswith("```"):
        lines = content.splitlines()

        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        content = "\n".join(lines).strip()

    try:
        return json.loads(content)

    except json.JSONDecodeError as exc:
        raise ValueError(
            "Groq returned invalid JSON:\n"
            + content[:2000]
        ) from exc


# =========================================================
# NORMALISE
# =========================================================

def normalise_result(result):

    if not isinstance(result, dict):
        raise ValueError(
            "Groq result is not a JSON object."
        )

    importance = as_int(
        result.get("importance"),
        0,
    )

    importance = max(
        0,
        min(10, importance),
    )

    def as_list(value):
        if value is None:
            return []

        if isinstance(value, list):
            return value

        return [str(value)]

    flashcards = result.get("flashcards") or []

    if not isinstance(flashcards, list):
        flashcards = []

    return {
        "relevant": as_bool(
            result.get("relevant")
        ),

        "importance": importance,

        "english_title": str(
            result.get("english_title") or ""
        ).strip(),

        "english_summary": str(
            result.get("english_summary") or ""
        ).strip(),

        "gs_papers": as_list(
            result.get("gs_papers")
        ),

        "topics": as_list(
            result.get("topics")
        ),

        "prelims_points": as_list(
            result.get("prelims_points")
        ),

        "mains_points": as_list(
            result.get("mains_points")
        ),

        "data_points": as_list(
            result.get("data_points")
        ),

        "schemes": as_list(
            result.get("schemes")
        ),

        "institutions": as_list(
            result.get("institutions")
        ),

        "implications": as_list(
            result.get("implications")
        ),

        "possible_questions": as_list(
            result.get("possible_questions")
        ),

        "keywords": as_list(
            result.get("keywords")
        ),

        "flashcards": flashcards,
    }


# =========================================================
# CALL GROQ
# =========================================================

def call_groq(article):

    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is missing."
        )

    if not GROQ_MODEL:
        raise RuntimeError(
            "GROQ_MODEL is missing."
        )

    payload = {
        "model": GROQ_MODEL,

        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": build_prompt(article),
            },
        ],

        "response_format": {
            "type": "json_object"
        },

        "temperature": 0.1,

        "max_tokens": 5000,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    print(
        f"Calling Groq model: {GROQ_MODEL}"
    )

    response = requests.post(
        GROQ_URL,
        headers=headers,
        json=payload,
        timeout=180,
    )

    # -----------------------------------------------------
    # EXPLICIT API ERROR
    # -----------------------------------------------------

    if response.status_code != 200:

        try:
            error_body = response.json()
        except Exception:
            error_body = response.text

        raise RuntimeError(
            f"Groq API error "
            f"{response.status_code}: "
            f"{error_body}"
        )

    data = response.json()

    choices = data.get("choices") or []

    if not choices:
        raise RuntimeError(
            f"Groq returned no choices: {data}"
        )

    message = choices[0].get("message") or {}

    content = message.get("content")

    return parse_json(content)


# =========================================================
# SAVE SUCCESS
# =========================================================

def save_ai_result(article_id, result):

    client = get_client()

    update_data = {
        "processed": True,

        "processing_error": None,

        "relevant": result["relevant"],

        "importance": result["importance"],

        "english_title": result["english_title"],

        "english_summary": result["english_summary"],

        "gs_papers": result["gs_papers"],

        "topics": result["topics"],

        "prelims_points": result["prelims_points"],

        "mains_points": result["mains_points"],

        "data_points": result["data_points"],

        "schemes": result["schemes"],

        "institutions": result["institutions"],

        "implications": result["implications"],

        "possible_questions": result["possible_questions"],

        "keywords": result["keywords"],

        "flashcards": result["flashcards"],
    }

    (
        client
        .table("articles")
        .update(update_data)
        .eq("id", article_id)
        .execute()
    )


# =========================================================
# SAVE ERROR
# =========================================================

def save_processing_error(
    article_id,
    error,
):

    client = get_client()

    error_text = str(error)

    if len(error_text) > 4000:
        error_text = error_text[:4000]

    (
        client
        .table("articles")
        .update({
            "processing_error": error_text,
        })
        .eq("id", article_id)
        .execute()
    )


# =========================================================
# PROCESS PENDING
# =========================================================

def process_pending(limit=None):

    if limit is None:
        limit = AI_BATCH_SIZE

    client = get_client()

    result = (
        client
        .table("articles")
        .select("*")
        .eq("processed", False)
        .order("id", desc=False)
        .limit(limit)
        .execute()
    )

    articles = result.data or []

    print(
        f"Pending articles found: {len(articles)}"
    )

    processed_count = 0

    failed_count = 0

    for article in articles:

        article_id = article.get("id")

        title = (
            article.get("title")
            or ""
        )

        print("")
        print("=" * 70)
        print(
            f"ARTICLE {article_id}"
        )
        print(title[:200])
        print("=" * 70)

        try:

            result = call_groq(article)

            result = normalise_result(result)

            save_ai_result(
                article_id,
                result,
            )

            processed_count += 1

            print(
                f"SUCCESS | "
                f"relevant={result['relevant']} | "
                f"importance={result['importance']}"
            )

        except Exception as exc:

            failed_count += 1

            print(
                f"FAILED | article={article_id}"
            )

            print(
                f"ERROR: {exc}"
            )

            try:
                save_processing_error(
                    article_id,
                    exc,
                )
            except Exception as db_error:
                print(
                    "Could not save processing error: "
                    f"{db_error}"
                )

        # Small pause between requests.
        time.sleep(0.5)

    print("")
    print("=" * 70)
    print(
        f"AI PROCESSING COMPLETE | "
        f"processed={processed_count} | "
        f"failed={failed_count}"
    )
    print("=" * 70)

    return processed_count
