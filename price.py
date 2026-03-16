"""
price.py — Live Token-Preisdaten von DexScreener (kostenlos)
"""

import logging
import requests

log = logging.getLogger(__name__)

TOKEN_MINT = "89muFzE1VpotYQfKm7xsuEbhgxRLyinmsELGTCSLpump"
DEXSCREENER_URL = f"https://api.dexscreener.com/latest/dex/tokens/{TOKEN_MINT}"


def get_price() -> dict:
    """
    Holt aktuelle $TRALALA Preis-Daten.
    Gibt leeres Dict zurück wenn nicht erreichbar.
    """
    try:
        r = requests.get(DEXSCREENER_URL, timeout=10)
        r.raise_for_status()
        data = r.json()
        pairs = data.get("pairs", [])
        if not pairs:
            log.warning("DexScreener: Keine Pairs gefunden")
            return {}

        p = pairs[0]
        price_change = p.get("priceChange", {})

        result = {
            "price_usd":     p.get("priceUsd", "unknown"),
            "price_change":  price_change.get("h24", "?"),
            "market_cap":    p.get("fdv", "?"),
            "volume_24h":    p.get("volume", {}).get("h24", "?"),
            "liquidity_usd": p.get("liquidity", {}).get("usd", "?"),
            "trending_up":   _is_trending_up(price_change.get("h24")),
        }
        log.info(f"💰 Preis: ${result['price_usd']} | 24h: {result['price_change']}%")
        return result

    except Exception as e:
        log.warning(f"DexScreener Fehler: {e}")
        return {}


def _is_trending_up(change_str) -> bool | None:
    """Gibt True/False/None zurück je nach Preisrichtung"""
    try:
        return float(change_str) >= 0
    except (TypeError, ValueError):
        return None


def format_price_for_log(price_data: dict) -> str:
    if not price_data:
        return "Preis nicht verfügbar"
    return (
        f"${price_data.get('price_usd')} USD | "
        f"24h: {price_data.get('price_change')}% | "
        f"MCap: ${price_data.get('market_cap')}"
    )
