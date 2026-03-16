"""
bot.py — Tralalerito Marketing Bot
Hauptdatei: Orchestriert alles, läuft 24/7 auf Hetzner
"""

import os
import sys
import time
import random
import logging
import schedule
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import memory
import ai
import price
from character import CONTENT_TYPES, FALLBACK_TWEETS, get_prompt

# ─── LOGGING ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("tralalerito.log"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

# ─── KONFIGURATION ───────────────────────────────────────────────────────────
MAX_POSTS_PER_DAY = 7
TWITTER_ENABLED   = os.getenv("TWITTER_ENABLED", "false").lower() == "true"

# Post-Zeiten UTC — menschlich verteilt
BASE_SCHEDULE = ["07:15", "09:50", "12:30", "15:10", "17:45", "20:20", "22:40"]

# ─── TWITTER POSTING ─────────────────────────────────────────────────────────
def post_to_twitter(text: str) -> bool:
    if not TWITTER_ENABLED:
        log.info("🔕 Twitter deaktiviert (TWITTER_ENABLED=false) — nur Logging")
        return True
    try:
        import tweepy
        client = tweepy.Client(
            consumer_key=os.getenv("TWITTER_API_KEY"),
            consumer_secret=os.getenv("TWITTER_API_SECRET"),
            access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
            access_token_secret=os.getenv("TWITTER_ACCESS_SECRET"),
        )
        response = client.create_tweet(text=text)
        log.info(f"🐦 Tweet live! ID: {response.data['id']}")
        return True
    except Exception as e:
        log.error(f"❌ Twitter Fehler: {e}")
        return False

# ─── CONTENT-TYP AUSWÄHLEN ───────────────────────────────────────────────────
def pick_content_type() -> str:
    """
    Wählt Content-Typ gewichtet aus.
    Vermeidet Wiederholung von kürzlich genutzten Typen.
    """
    recent = memory.get_recent_content_types(hours=4)

    types   = [t for t, _, _ in CONTENT_TYPES]
    weights = [w for _, w, _ in CONTENT_TYPES]

    # Kürzlich genutzte Typen bekommen weniger Gewicht
    adjusted = []
    for t, w in zip(types, weights):
        if t in recent:
            adjusted.append(max(1, w // 3))  # stark reduzieren, aber nicht 0
        else:
            adjusted.append(w)

    chosen = random.choices(types, weights=adjusted, k=1)[0]
    log.info(f"📝 Content-Typ: {chosen}")
    return chosen

# ─── EINEN POST ERSTELLEN & SENDEN ───────────────────────────────────────────
def make_post(dry_run: bool = False):
    log.info("─" * 50)
    log.info(f"⏰ Post-Zeit! | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    log.info(memory.get_stats_summary())

    # Tageslimit prüfen
    if memory.get_posts_today() >= MAX_POSTS_PER_DAY:
        log.info(f"🛑 Tageslimit ({MAX_POSTS_PER_DAY}) erreicht — kein Post")
        return

    # Preis holen
    price_data = price.get_price()
    if price_data.get("price_usd"):
        memory.save_price_snapshot(price_data["price_usd"])

    # Content-Typ wählen
    content_type = pick_content_type()

    # Prompt bauen & Text generieren
    prompt = get_prompt(content_type, price_data)
    tweet_text = ai.generate(prompt)

    # Fallback wenn AI versagt
    if not tweet_text:
        tweet_text = FALLBACK_TWEETS.get(content_type, "tralala... 🦈 $TRALALA")
        log.info("⚠️  Fallback-Tweet genutzt")

    # Länge sicherstellen
    if len(tweet_text) > 280:
        tweet_text = tweet_text[:277] + "..."

    # Duplikat-Check
    if memory.was_posted(tweet_text):
        log.warning("⚠️  Duplikat erkannt — überspringe diesen Post")
        return

    log.info(f"📤 Tweet ({len(tweet_text)} Zeichen):\n{tweet_text}")

    # Posten
    if not dry_run:
        success = post_to_twitter(tweet_text)
        if success:
            memory.save_post(content_type, tweet_text)
            log.info("💾 Im Gedächtnis gespeichert")
    else:
        log.info("🧪 DRY RUN — nicht gepostet, nicht gespeichert")

# ─── SCHEDULE EINRICHTEN ─────────────────────────────────────────────────────
def setup_schedule():
    for base_time in BASE_SCHEDULE:
        h, m = map(int, base_time.split(":"))
        # ±7 Minuten zufällig verschieben (einmalig beim Start)
        offset = random.randint(-7, 7)
        m_new = (m + offset) % 60
        h_new = (h + (m + offset) // 60) % 24
        sched_time = f"{h_new:02d}:{m_new:02d}"
        schedule.every().day.at(sched_time).do(make_post)
        log.info(f"⏰ Geplant: {sched_time} UTC")

# ─── MAIN ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("🦈 Tralalerito Bot startet...")
    log.info(f"Twitter aktiv: {TWITTER_ENABLED}")

    # Datenbank initialisieren
    memory.init_db()
    log.info("💾 Gedächtnis initialisiert")

    # CLI Argumente
    if "--test" in sys.argv:
        log.info("🧪 TEST-MODUS")
        make_post(dry_run=True)
        sys.exit(0)

    if "--post-now" in sys.argv:
        log.info("🚀 Sofortiger Post")
        make_post(dry_run=False)
        sys.exit(0)

    # Normaler Betrieb
    setup_schedule()
    log.info("✅ Bot läuft. Warte auf nächsten Zeitpunkt...")
    log.info("Tipp: 'python bot.py --test' für sofortigen Test")

    while True:
        schedule.run_pending()
        time.sleep(30)
