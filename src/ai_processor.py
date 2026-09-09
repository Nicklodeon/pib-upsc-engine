import json
import time

from openai import OpenAI

from .config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    AI_BATCH_SIZE,
)
from .db import get_client


# =========================================================
# GROQ CLIENT
# =========================================================

def get_groq_client():
    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is missing. "
            "Add it to your .env file or GitHub Actions secrets."
        )

    return OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )


# =========================================================
# SAFE BOOLEAN CONVERSION
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
# SAFE INTEGER CONVERSION
# =========================================================

def as_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# =========================================================
# AI PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an expert UPSC Civil Services Examination current-affairs analyst.

Your job is to analyse official Press Information Bureau (PIB) releases
and convert them into useful UPSC preparation material.

Be selective.

A PIB release should be marked relevant ONLY if it has meaningful value
for UPSC preparation.

High-value areas include:

- Government policies
- Government schemes
- Acts and laws
- Constitutional issues
- Governance
- International relations
- Economy
- Environment
- Ecology
- Science and technology
- Defence and security
- Social issues
- Agriculture
- Infrastructure
- Important institutions
- Reports and indices
- Important committees
- Major government programmes
- Important data
- International organisations
- Important places/species/geographical features
- Significant developments that can directly contribute to Prelims or Mains

Generally mark routine ceremonial material as NOT relevant, including:

- Congratulatory messages
- Birthday greetings
- Routine tributes
- Routine condolences
- Routine courtesy meetings
- Routine event announcements
- Generic publicity material

However, do NOT reject an article merely because it is a press release.
Assess its actual UPSC value.

Importance score:

0-3 = Very low UPSC value
4-6 = Moderate UPSC value
7-8 = Important
9-10 = Very important / highly exam-relevant

Return ONLY valid JSON.
Do not include markdown.
"""


USER_PROMPT_TEMPLATE = """
Analyse the following PIB release.

TITLE:
{title}

MINISTRY:
{ministry}

DATE:
{published_at}

FULL PIB TEXT:
{raw_text}

Return JSON with EXACTLY these fields:

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

1. "relevant" must be true or false.
2. "importance" must be an integer from 0 to 10.
3. "english_title" must be a clean English title suitable for a UPSC current-affairs website.
4. "english_summary" should be approximately 80-120 words.
5. "gs_papers" may contain one or more of:
   "GS1", "GS2", "GS3", "GS4", "Prelims"
6. "topics" should contain concise topic labels.
7. "prelims_points" should contain factual/conceptual points useful for Prelims.
8. "mains_points" should contain analytical points useful for Mains.
9. "data_points" should contain important statistics, targets, percentages,
   dates, numbers or quantitative facts. Do not invent data.
10. "schemes" should contain relevant government schemes/programmes.
11. "institutions" should contain relevant organisations/institutions.
12. "implications" should explain important consequences where applicable.
13. "possible_questions" should contain potential UPSC-style questions.
14. "keywords" should contain important searchable terms.
15. "flashcards" should contain useful question-answer pairs.
16. Do NOT invent information that is not supported by the PIB text.
17. If the release is not relevant, still return all fields but keep the
    UPSC-specific arrays mostly empty.
18. Use null/empty arrays rather than inventing information.
"""


# =========================================================
# JSON EXTRACTION
# =========================================================

def parse_json_response(content):
    if not content:
        raise ValueError("Groq returned an empty response.")

    content = content.strip()

    # Remove accidental markdown fences.
    if content.startswith("```"):
        lines = content.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        content = "\n".join(lines).strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Groq returned invalid JSON: {content[:1000]}"
        ) from exc


# =========================================================
# NORMALISE AI RESULT
# =========================================================

def normalise_result(result):
    if not isinstance(result, dict):
        raise ValueError("AI result is not a JSON object.")

    importance = as_int(result.get("importance"), 0)

    importance = max(0, min(10, importance))

    gs_papers = result.get("gs_papers") or []
    topics = result.get("topics") or []
    prelims_points = result.get("prelims_points") or []
    mains_points = result.get("mains_points") or []
    data_points = result.get("data_points") or []
    schemes = result.get("schemes") or []
    institutions = result.get("institutions") or []
    implications = result.get("implications") or []
    possible_questions = result.get("possible_questions") or []
    keywords = result.get("keywords") or []
    flashcards = result.get("flashcards") or []

    if not isinstance(gs_papers, list):
        gs_papers = [str(gs_papers)]

    if not isinstance(topics, list):
        topics = [str(topics)]

    if not isinstance(prelims_points, list):
        prelims_points = [str(prelims_points)]

    if not isinstance(mains_points, list):
        mains_points = [str(mains_points)]

    if not isinstance(data_points, list):
        data_points = [str(data_points)]

    if not isinstance(schemes, list):
        schemes = [str(schemes)]

    if not isinstance(institutions, list):
        institutions = [str(institutions)]

    if not isinstance(implications, list):
        implications = [str(implications)]

    if not isinstance(possible_questions, list):
        possible_questions = [str(possible_questions)]

    if not isinstance(keywords, list):
        keywords = [str(keywords)]

    if not isinstance(flashcards, list):
        flashcards = []

    return {
        "relevant": as_bool(result.get("relevant")),
        "importance": importance,
        "english_title": str(
            result.get("english_title") or ""
        ).strip(),
        "english_summary": str(
            result.get("english_summary") or ""
        ).strip(),
        "gs_papers": gs_papers,
        "topics": topics,
        "prelims_points": prelims_points,
        "mains_points": mains_points,
        "data_points": data_points,
        "schemes": schemes,
        "institutions": institutions,
        "implications": implications,
        "possible_questions": possible_questions,
        "keywords": keywords,
        "flashcards": flashcards,
    }


# =========================================================
# PROCESS ONE ARTICLE
# =========================================================

def process_article(article):
    client = get_groq_client()

    article_id = article["id"]

    title = article.get("title") or ""

    ministry = article.get("ministry") or ""

    published_at = article.get("published_at") or ""

    raw_text = article.get("raw_text") or ""

    if not raw_text.strip():
        raise ValueError(
            f"Article {article_id} has no raw_text."
        )

    # Prevent extremely large requests.
    raw_text = raw_text[:30000]

    user_prompt = USER_PROMPT_TEMPLATE.format(
        title=title,
        ministry=ministry,
        published_at=published_at,
        raw_text=raw_text,
    )

    print(
        f"Processing article {article_id}: "
        f"{title[:100]}"
    )

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        response_format={
            "type": "json_object"
        },
    )

    content = response.choices[0].message.content

    result = parse_json_response(content)

    return normalise_result(result)


# =========================================================
# SAVE AI RESULT
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
# SAVE PROCESSING ERROR
# =========================================================

def save_processing_error(article_id, error):
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
# PROCESS PENDING ARTICLES
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

    for article in articles:
        article_id = article.get("id")

        try:
            ai_result = process_article(article)

            save_ai_result(
                article_id,
                ai_result,
            )

            processed_count += 1

            print(
                f"Successfully processed article "
                f"{article_id} | "
                f"relevant={ai_result['relevant']} | "
                f"importance={ai_result['importance']}"
            )

            # Small delay to avoid hammering the API.
            time.sleep(0.5)

        except Exception as exc:
            print(
                f"FAILED article {article_id}: {exc}"
            )

            save_processing_error(
                article_id,
                exc,
            )

    return processed_count
