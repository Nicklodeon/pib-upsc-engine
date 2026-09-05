import os
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]

load_dotenv(ROOT / ".env")


# =========================================================
# SUPABASE
# =========================================================

SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    ""
)

SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    ""
)


# =========================================================
# XAI / GROK
# =========================================================

XAI_API_KEY = os.getenv(
    "XAI_API_KEY",
    ""
)

XAI_MODEL = os.getenv(
    "XAI_MODEL",
    "grok-4.3"
)


# =========================================================
# PIB
# =========================================================

PIB_FEEDS = [
    {
        "name": "PIB English - Delhi",
        "url": (
            "https://www.pib.gov.in/"
            "RssMain.aspx?ModId=6&Lang=1&Regid=3"
        ),
    },
]


USER_AGENT = (
    "PIB-UPSC-Current-Affairs-Engine/1.0"
)


# =========================================================
# ARTICLES TO IGNORE
# =========================================================

IGNORE_TITLE_PATTERNS = [
    "congratulates",
    "greets",
    "pays tributes",
    "pays homage",
    "condoles",
    "birthday greetings",
]


# =========================================================
# PROCESSING
# =========================================================

COLLECT_BATCH_SIZE = 50

AI_BATCH_SIZE = 50
