"""
twitter_selenium.py — Postet Tweets ohne API über echten Browser
Komplett kostenlos, keine Credits nötig
"""

import os
import time
import logging
import random
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

TWITTER_USERNAME = os.getenv("TWITTER_USERNAME")
TWITTER_PASSWORD = os.getenv("TWITTER_PASSWORD")


def post_tweet(text: str) -> bool:
    """Postet einen Tweet über Selenium (kein API Key nötig)"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        # Browser unsichtbar (headless) starten
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

        driver = webdriver.Chrome(options=options)
        wait = WebDriverWait(driver, 20)

        try:
            # 1. X.com öffnen
            log.info("🌐 Öffne X.com...")
            driver.get("https://x.com/login")
            time.sleep(random.uniform(3, 5))

            # 2. Username eingeben
            log.info("👤 Gebe Username ein...")
            username_field = wait.until(
                EC.presence_of_element_located((By.NAME, "text"))
            )
            _human_type(username_field, TWITTER_USERNAME)
            time.sleep(random.uniform(0.5, 1.5))

            # Next klicken
            next_btn = driver.find_element(By.XPATH, "//span[text()='Next']")
            next_btn.click()
            time.sleep(random.uniform(2, 3))

            # 3. Passwort eingeben
            log.info("🔑 Gebe Passwort ein...")
            password_field = wait.until(
                EC.presence_of_element_located((By.NAME, "password"))
            )
            _human_type(password_field, TWITTER_PASSWORD)
            time.sleep(random.uniform(0.5, 1.5))

            # Login klicken
            login_btn = driver.find_element(By.XPATH, "//span[text()='Log in']")
            login_btn.click()
            time.sleep(random.uniform(4, 6))

            # 4. Tweet-Box öffnen
            log.info("✍️  Öffne Tweet-Box...")
            tweet_box = wait.until(
                EC.presence_of_element_located((
                    By.XPATH,
                    "//div[@data-testid='tweetTextarea_0']"
                ))
            )
            tweet_box.click()
            time.sleep(random.uniform(1, 2))

            # 5. Text eintippen (menschlich langsam)
            log.info("📝 Tippe Tweet...")
            _human_type(tweet_box, text)
            time.sleep(random.uniform(1, 3))

            # 6. Tweet absenden
            log.info("📤 Sende Tweet...")
            post_btn = wait.until(
                EC.element_to_be_clickable((
                    By.XPATH,
                    "//button[@data-testid='tweetButtonInline']"
                ))
            )
            post_btn.click()
            time.sleep(random.uniform(3, 5))

            log.info("✅ Tweet erfolgreich gepostet!")
            return True

        finally:
            driver.quit()

    except Exception as e:
        log.error(f"❌ Selenium Fehler: {e}")
        return False


def _human_type(element, text: str):
    """Tippt Text mit kleinen zufälligen Pausen — wirkt menschlicher"""
    for char in text:
        element.send_keys(char)
        time.sleep(random.uniform(0.03, 0.12))
