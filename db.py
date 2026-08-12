import sqlite3
from pathlib import Path
from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE,
    title TEXT NOT NULL,
    link TEXT,
    published_at TEXT,
    source TEXT,
    ministry TEXT,
    raw_text TEXT,
    fetched_at TEXT,
    processed INTEGER DEFAULT 0,
    relevant INTEGER,
    importance INTEGER,
    gs_papers TEXT,
    topics TEXT,
    prelims_facts TEXT,
    mains_notes TEXT,
    data_points TEXT,
    schemes TEXT,
    institutions TEXT,
    implications TEXT,
    possible_questions TEXT,
    keywords TEXT,
    flashcards_json TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_processed ON articles(processed);
CREATE INDEX IF NOT EXISTS idx_articles_relevant ON articles(relevant);
"""

def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con

def insert_article(con, item):
    cur = con.execute(
        """INSERT OR IGNORE INTO articles
        (guid,title,link,published_at,source,ministry,raw_text,fetched_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (
            item["guid"], item["title"], item.get("link"), item.get("published_at"),
            item.get("source"), item.get("ministry"), item.get("raw_text"),
            item.get("fetched_at"),
        ),
    )
    con.commit()
    return cur.rowcount == 1
