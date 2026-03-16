# 🦈 Tralalerito Bot — Setup-Anleitung

## Dateien auf einen Blick
```
tralalerito_bot/
├── bot.py          ← Hauptdatei, startet den Bot
├── character.py    ← Tralalerito's Persönlichkeit & alle Prompts
├── memory.py       ← Gedächtnis (SQLite, verhindert Duplikate)
├── ai.py           ← AI Fallback-Kette (Groq→Gemini→Mistral)
├── price.py        ← Live-Preise von DexScreener
├── .env.example    ← API Keys Vorlage
├── requirements.txt
└── tralalerito.service  ← Systemd (läuft für immer)
```

---

## SCHRITT 1 — Neuen X Account erstellen
1. Neue Handynummer oder Wegwerf-SIM
2. twitter.com → "Sign up" → Name: **Tralalerito**
3. Handle: `@tralalerito` oder `@tralalerito_sol`
4. Profilbild hochladen (dein Tralalerito-Bild)
5. **3–5 Tage manuell 1–2 Tweets posten** bevor der Bot übernimmt
   → X sperrt neue Accounts die sofort automatisch posten

---

## SCHRITT 2 — Twitter Developer App
1. Mit dem **@tralalerito Account** einloggen auf developer.twitter.com
2. "Sign up for Free Account" → kurze Beschreibung: *"Automated posts for my Solana memecoin community project"*
3. App erstellen → **App Permissions auf "Read and Write"** setzen
4. Keys and Tokens → alles notieren:
   - API Key & API Secret
   - Access Token & Access Token Secret (auf "Generate" klicken!)

---

## SCHRITT 3 — Kostenlose AI Keys (10 Minuten)

| Service | URL | Was du tust |
|---------|-----|-------------|
| Groq | console.groq.com | Sign up → API Keys → Create |
| Gemini | aistudio.google.com/app/apikey | Create API Key |
| Mistral | console.mistral.ai | Sign up → API Keys → New Key |

---

## SCHRITT 4 — Auf Hetzner deployen

```bash
# 1. Per SSH einloggen
ssh root@DEINE_HETZNER_IP

# 2. Dateien hochladen (auf deinem PC ausführen, nicht auf dem Server)
scp -r tralalerito_bot/ root@DEINE_HETZNER_IP:/root/

# 3. Auf dem Server: Dependencies installieren
cd /root/tralalerito_bot
apt install -y python3 python3-pip python3-venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. API Keys eintragen
cp .env.example .env
nano .env
# Alle HIER_EINTRAGEN ersetzen, dann CTRL+X → Y → Enter
```

---

## SCHRITT 5 — Testen (TWITTER_ENABLED=false lassen!)

```bash
cd /root/tralalerito_bot
source venv/bin/activate

# Einen Tweet generieren und anzeigen (postet NICHT)
python bot.py --test
```

Schau dir die Ausgabe an. Wenn ein Tweet generiert wurde → alles funktioniert ✅

Beispiel-Ausgabe:
```
[INFO] 📝 Content-Typ: fear_moment
[INFO] ✅ AI: Groq
[INFO] 📤 Tweet (187 Zeichen):
tralalerito see big red candle on chart... is that... a BEAR?? 😱 
papa always say stay calm but papa is not here right now...
okay tralalerito hold $TRALALA. is okay. tralala 🦈
[INFO] 🔕 Twitter deaktiviert — nur Logging
```

---

## SCHRITT 6 — Live schalten

In `.env` ändern:
```
TWITTER_ENABLED=true
```

Einmal manuell posten zum Test:
```bash
python bot.py --post-now
```

Auf Twitter prüfen ob der Tweet erschienen ist ✅

---

## SCHRITT 7 — Als Dienst einrichten (läuft für immer)

```bash
cp tralalerito.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable tralalerito
systemctl start tralalerito

# Status prüfen
systemctl status tralalerito
```

---

## Nützliche Befehle

```bash
# Live-Logs anschauen
journalctl -u tralalerito -f

# Bot neustarten (nach Änderungen an character.py etc.)
systemctl restart tralalerito

# Alle gespeicherten Posts anschauen
sqlite3 /root/tralalerito_bot/tralalerito_memory.db \
  "SELECT posted_at, content_type, tweet_text FROM posts ORDER BY posted_at DESC LIMIT 10;"

# Wie viele Posts heute?
sqlite3 /root/tralalerito_bot/tralalerito_memory.db \
  "SELECT posts_count FROM daily_stats WHERE date = date('now');"
```

---

## Post-Zeiten (UTC, ±7 Min zufällig)
`07:15 | 09:50 | 12:30 | 15:10 | 17:45 | 20:20 | 22:40`

Maximum 7 Posts/Tag — X Free Tier erlaubt 500/Monat, du nutzt ~210.

---

## Kosten
| Service | Kosten |
|---------|--------|
| Hetzner CX11 | ~4€/Monat |
| Alle AI APIs | 0€ |
| Twitter Free Tier | 0€ |
| DexScreener API | 0€ |
| **Gesamt** | **~4€/Monat** |

---

## Was kommt als Nächstes (Phase 2)
- Bilder aus Dropbox automatisch auswählen & posten
- Tralalerito plant seinen Tag selbst (Abend-Review + Morgen-Plan)
- Chat-Interface wo Fans mit Tralalerito schreiben können
