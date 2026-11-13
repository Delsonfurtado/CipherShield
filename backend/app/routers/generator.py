"""
CipherShield — Password & Entropy Generation Service
High-entropy server-side CSPRNG utilities for CLI clients and automated workflows.
"""
from __future__ import annotations

import math
import secrets
import string
from enum import Enum
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/generator", tags=["Generator"])

DICEWARE_WORDS = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
    "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
    "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
    "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
    "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
    "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
    "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
    "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
    "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
    "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
    "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
    "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
    "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
    "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume",
    "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
    "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado",
    "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball",
    "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base",
    "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
    "beef", "before", "begin", "behave", "behind", "believe", "below", "belt",
    "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
    "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black",
    "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
    "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
    "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring",
    "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain",
    "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief",
    "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother",
    "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
    "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus",
    "business", "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable",
    "cactus", "cage", "cake", "call", "calm", "camera", "camp", "can",
    "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable",
    "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry",
    "cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog",
    "catch", "category", "cattle", "caught", "cause", "caution", "cave", "ceiling",
    "celery", "cement", "census", "century", "cereal", "certain", "chair", "chalk",
    "champion", "change", "chaos", "chapter", "charge", "chase", "chat", "cheap",
    "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child",
    "chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn", "cigar",
    "cinnamon", "circle", "citizen", "city", "civil", "claim", "clap", "clarify",
    "claw", "clay", "clean", "clerk", "clever", "click", "client", "cliff",
    "climb", "clinic", "clip", "clock", "clog", "close", "cloth", "cloud",
    "clown", "club", "clump", "cluster", "clutch", "coach", "coast", "coconut",
    "code", "coffee", "coil", "coin", "collect", "color", "column", "combine",
    "comfort", "comic", "common", "company", "concert", "conduct", "confirm", "congress"
]

AMBIGUOUS_CHARS = "il1Lo0O"


class GeneratorMode(str, Enum):
    RANDOM = "random"
    PASSPHRASE = "passphrase"
    PIN = "pin"
    PRONOUNCEABLE = "pronounceable"


class PasswordResponse(BaseModel):
    password: str
    entropy_bits: float
    crack_time_display: str
    score: int  # 0 to 4


def calculate_entropy_and_crack_time(pwd: str, pool_size: int) -> tuple[float, str, int]:
    if not pwd or pool_size <= 0:
        return 0.0, "instant", 0
    entropy = len(pwd) * math.log2(pool_size)

    # Assume 100 billion guesses/second (modern GPU cluster)
    guesses_per_sec = 1e11
    guesses = 2 ** entropy
    seconds = guesses / guesses_per_sec

    if seconds < 1:
        time_str = "instant"
        score = 0
    elif seconds < 3600:
        time_str = f"{int(seconds // 60)} minutes"
        score = 1
    elif seconds < 86400 * 30:
        time_str = f"{int(seconds // 86400)} days"
        score = 2
    elif seconds < 86400 * 365 * 100:
        time_str = f"{int(seconds // (86400 * 365))} years"
        score = 3
    else:
        time_str = "centuries"
        score = 4

    return round(entropy, 1), time_str, score


@router.get("/generate", response_model=PasswordResponse)
async def generate_password(
    mode: GeneratorMode = GeneratorMode.RANDOM,
    length: int = Query(20, ge=4, le=128),
    uppercase: bool = True,
    lowercase: bool = True,
    digits: bool = True,
    symbols: bool = True,
    exclude_ambiguous: bool = True,
    word_count: int = Query(5, ge=3, le=12),
    separator: str = "-",
    capitalize_words: bool = True,
):
    """
    Generate high-entropy password or passphrase via CSPRNG.
    """
    if mode == GeneratorMode.RANDOM:
        pool = ""
        if uppercase:
            pool += string.ascii_uppercase
        if lowercase:
            pool += string.ascii_lowercase
        if digits:
            pool += string.digits
        if symbols:
            pool += "!@#$%^&*()-_=+[]{}|;:,.<>?"

        if exclude_ambiguous:
            pool = "".join(c for c in pool if c not in AMBIGUOUS_CHARS)

        if not pool:
            pool = string.ascii_letters + string.digits

        pwd = "".join(secrets.choice(pool) for _ in range(length))
        entropy, crack_time, score = calculate_entropy_and_crack_time(pwd, len(pool))

    elif mode == GeneratorMode.PASSPHRASE:
        chosen = [secrets.choice(DICEWARE_WORDS) for _ in range(word_count)]
        if capitalize_words:
            chosen = [w.capitalize() for w in chosen]
        pwd = separator.join(chosen)
        entropy, crack_time, score = calculate_entropy_and_crack_time(pwd, len(DICEWARE_WORDS))

    elif mode == GeneratorMode.PIN:
        pwd = "".join(secrets.choice(string.digits) for _ in range(length))
        entropy, crack_time, score = calculate_entropy_and_crack_time(pwd, 10)

    elif mode == GeneratorMode.PRONOUNCEABLE:
        vowels = "aeiou"
        consonants = "bcdfghjklmnpqrstvwxyz"
        parts = []
        for i in range(length):
            parts.append(secrets.choice(consonants if i % 2 == 0 else vowels))
        pwd = "".join(parts)
        entropy, crack_time, score = calculate_entropy_and_crack_time(pwd, 26)

    return PasswordResponse(
        password=pwd,
        entropy_bits=entropy,
        crack_time_display=crack_time,
        score=score,
    )
