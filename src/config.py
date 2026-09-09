import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]

load_dotenv(ROOT / ".env")

# =========================================================
# SUPABASE
# =========================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


# =========================================================
# GROQ
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)


# =========================================================
# PIB
# =========================================================

PIB_FEEDS = [
    {
        "name": "PIB English - Delhi",
        "url": "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    },
]


# =========================================================
# GENERAL SETTINGS
# =========================================================

USER_AGENT = "PIB-UPSC-Current-Affairs-Engine/1.0"

COLLECT_BATCH_SIZE = 50

AI_BATCH_SIZE = 50


# =========================================================
# TITLES TO IGNORE
# =========================================================

IGNORE_TITLE_PATTERNS = [
    "congratulates",
    "greets",
    "pays tributes",
    "pays homage",
    "condoles",
    "birthday greetings",
]
