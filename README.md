# PIB → UPSC Current Affairs Engine

A starter system that:
1. Fetches PIB press-release RSS items.
2. Deduplicates them in SQLite.
3. Fetches and extracts the article text.
4. Uses an LLM to classify UPSC relevance, GS paper/topic, importance, facts, mains angles and flashcards.
5. Produces a weekly UPSC digest and flashcards CSV.
6. Can be scheduled with GitHub Actions.

## Data flow

PIB RSS → SQLite raw archive → AI UPSC processor → weekly digest / flashcards

## Requirements

- Python 3.11+
- An OpenAI API key for AI processing
- Internet access from the machine running the collector

## Setup

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your API key.

Then:

```bash
python -m src.run_pipeline --hours 24
```

For a weekly digest:

```bash
python -m src.weekly_digest --days 7
```

For a quick database report:

```bash
python -m src.stats
```

## Important design choice

The SQLite database is the source of truth. Generated Markdown/CSV files are outputs. This prevents the system from becoming a fragile collection of spreadsheets.

## PIB feed

The default feed is the official PIB English press-release RSS feed for region 1:

https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1

PIB exposes RSS feeds from its RSS page; additional regional feeds can be added in `src/config.py`.

## Recommended next phase

Add:
- PIB Features / Backgrounders
- PRS Legislative Research
- RBI
- MEA
- ISRO
- NITI Aayog
- Economic Survey / Union Budget
- spaced-repetition scheduling
- a small web dashboard
