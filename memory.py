"""
memory.py — Tralalerito's Gedächtnis (SQLite)
Merkt sich: alle Posts, was gut lief, was er schon gesagt hat
"""

import sqlite3
import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "tralalerito_memory.db"


def init_db():
    """Erstellt die Datenbank beim ersten Start"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Alle gesendeten Posts
    c.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            posted_at   TEXT NOT NULL,
            content_type TEXT NOT NULL,
            tweet_text  TEXT NOT NULL,
            text_hash   TEXT NOT NULL UNIQUE,
            char_count  INTEGER,
            platform    TEXT DEFAULT 'twitter'
        )
    """)

    # Tägliche Statistiken (für späteres "Denken")
    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            date        TEXT PRIMARY KEY,
            posts_count INTEGER DEFAULT 0,
            price_open  TEXT,
            price_close TEXT,
            notes       TEXT
        )
    """)

    conn.commit()
    conn.close()


def _hash(text: str) -> str:
    """Kurzer Hash eines Textes — erkennt exakte Duplikate"""
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


def was_posted(tweet_text: str) -> bool:
    """Prüft ob dieser exakte Tweet schon mal gepostet wurde"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM posts WHERE text_hash = ?", (_hash(tweet_text),))
    result = c.fetchone()
    conn.close()
    return result is not None


def save_post(content_type: str, tweet_text: str, platform: str = "twitter"):
    """Speichert einen gesendeten Post ins Gedächtnis"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("""
            INSERT INTO posts (posted_at, content_type, tweet_text, text_hash, char_count, platform)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            datetime.utcnow().isoformat(),
            content_type,
            tweet_text,
            _hash(tweet_text),
            len(tweet_text),
            platform,
        ))
        conn.commit()

        # Tages-Counter aktualisieren
        today = datetime.utcnow().date().isoformat()
        c.execute("""
            INSERT INTO daily_stats (date, posts_count) VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET posts_count = posts_count + 1
        """, (today,))
        conn.commit()
    except sqlite3.IntegrityError:
        pass  # Hash bereits vorhanden — kein Duplikat speichern
    finally:
        conn.close()


def get_posts_today() -> int:
    """Wie viele Posts wurden heute schon gemacht?"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    today = datetime.utcnow().date().isoformat()
    c.execute("SELECT posts_count FROM daily_stats WHERE date = ?", (today,))
    result = c.fetchone()
    conn.close()
    return result[0] if result else 0


def get_recent_content_types(hours: int = 6) -> list:
    """Welche Content-Typen wurden in den letzten X Stunden genutzt?"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    c.execute("""
        SELECT content_type FROM posts 
        WHERE posted_at > ? ORDER BY posted_at DESC
    """, (since,))
    results = [row[0] for row in c.fetchall()]
    conn.close()
    return results


def save_price_snapshot(price_usd: str, label: str = "open"):
    """Speichert einen Preis-Snapshot für heute"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    today = datetime.utcnow().date().isoformat()
    if label == "open":
        c.execute("""
            INSERT INTO daily_stats (date, price_open) VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET price_open = ?
        """, (today, price_usd, price_usd))
    else:
        c.execute("""
            INSERT INTO daily_stats (date, price_close) VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET price_close = ?
        """, (today, price_usd, price_usd))
    conn.commit()
    conn.close()


def get_last_posts(n: int = 5) -> list:
    """Die letzten N Posts — für Kontext-Awareness"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT content_type, tweet_text, posted_at 
        FROM posts ORDER BY posted_at DESC LIMIT ?
    """, (n,))
    results = c.fetchall()
    conn.close()
    return results


def get_stats_summary() -> str:
    """Übersicht für Logging"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM posts")
    total = c.fetchone()[0]
    today = get_posts_today()
    conn.close()
    return f"Gesamt: {total} Posts | Heute: {today}"
