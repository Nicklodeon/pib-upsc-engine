import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DB_PATH = ROOT / "data" / "pib_upsc.db"
OUTPUT_DIR = ROOT / "output"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")

PIB_FEEDS = [
    {
        "name": "PIB English - Region 1",
        "url": "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
    },
]

USER_AGENT = "PIB-UPSC-Current-Affairs-Engine/0.1"

# Broad first-pass filter. The LLM remains the final relevance judge.
IGNORE_TITLE_PATTERNS = [
    "congratulates",
    "greets",
    "pays tributes",
    "pays homage",
    "condoles",
    "birthday greetings",
]
