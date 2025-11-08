import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")


def _ensure_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                avatar_url TEXT,
                likes TEXT,
                dislikes TEXT,
                vibes TEXT,
                budget_max REAL,
                distance_km_max REAL,
                tags TEXT
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                group_id TEXT,
                place_id TEXT,
                title TEXT NOT NULL,
                address TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                h3 TEXT,
                rating INTEGER,
                review TEXT,
                completed_at TEXT NOT NULL
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_visits_h3_user ON visits(h3, user_id);")
        conn.commit()


_ensure_db()


@contextmanager
def _conn() -> Iterable[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_user_profile(
    user_id: str,
    *,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    likes: Optional[List[str]] = None,
    dislikes: Optional[List[str]] = None,
    vibes: Optional[List[str]] = None,
    budget_max: Optional[float] = None,
    distance_km_max: Optional[float] = None,
    tags: Optional[List[str]] = None,
) -> None:
    with _conn() as conn:
        existing = conn.execute(
            "SELECT user_id FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        payload = {
            "name": name,
            "avatar_url": avatar_url,
            "likes": json.dumps(likes or []),
            "dislikes": json.dumps(dislikes or []),
            "vibes": json.dumps(vibes or []),
            "budget_max": budget_max,
            "distance_km_max": distance_km_max,
            "tags": json.dumps(tags or []),
        }
        if existing:
            conn.execute(
                """
                UPDATE users
                SET name=:name, avatar_url=:avatar_url, likes=:likes, dislikes=:dislikes,
                    vibes=:vibes, budget_max=:budget_max, distance_km_max=:distance_km_max, tags=:tags
                WHERE user_id = :user_id
                """,
                {**payload, "user_id": user_id},
            )
        else:
            conn.execute(
                """
                INSERT INTO users (user_id, name, avatar_url, likes, dislikes, vibes, budget_max, distance_km_max, tags)
                VALUES (:user_id, :name, :avatar_url, :likes, :dislikes, :vibes, :budget_max, :distance_km_max, :tags)
                """,
                {**payload, "user_id": user_id},
            )


def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    with _conn() as conn:
        row = conn.execute(
            """
            SELECT user_id, name, avatar_url, likes, dislikes, vibes, budget_max, distance_km_max, tags
            FROM users WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()
        if not row:
            return None
        (
            uid,
            name,
            avatar_url,
            likes,
            dislikes,
            vibes,
            budget_max,
            distance_km_max,
            tags,
        ) = row
        return {
            "user_id": uid,
            "name": name,
            "avatar_url": avatar_url,
            "likes": json.loads(likes or "[]"),
            "dislikes": json.loads(dislikes or "[]"),
            "vibes": json.loads(vibes or "[]"),
            "budget_max": budget_max,
            "distance_km_max": distance_km_max,
            "tags": json.loads(tags or "[]"),
        }


def record_visit(
    *,
    user_id: str,
    title: str,
    lat: float,
    lng: float,
    address: Optional[str] = None,
    place_id: Optional[str] = None,
    rating: Optional[int] = None,
    review: Optional[str] = None,
    group_id: Optional[str] = None,
    h3_index: Optional[str] = None,
    completed_at: Optional[str] = None,
) -> int:
    with _conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO visits(user_id, group_id, place_id, title, address, lat, lng, h3, rating, review, completed_at)
            VALUES (:user_id, :group_id, :place_id, :title, :address, :lat, :lng, :h3, :rating, :review, :completed_at)
            """,
            {
                "user_id": user_id,
                "group_id": group_id,
                "place_id": place_id,
                "title": title,
                "address": address,
                "lat": lat,
                "lng": lng,
                "h3": h3_index,
                "rating": rating,
                "review": review,
                "completed_at": completed_at or datetime.utcnow().isoformat() + "Z",
            },
        )
        return int(cur.lastrowid)


def get_user_hexes(user_ids: List[str], resolution: int) -> List[str]:
    if not user_ids:
        return []
    placeholders = ",".join("?" for _ in user_ids)
    with _conn() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT h3 FROM visits
            WHERE user_id IN ({placeholders}) AND h3 IS NOT NULL
            """,
            tuple(user_ids),
        ).fetchall()
    return [r[0] for r in rows if r and r[0]]


def list_visits(user_ids: Optional[List[str]] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with _conn() as conn:
        if user_ids:
            placeholders = ",".join("?" for _ in user_ids)
            rows = conn.execute(
                f"""
                SELECT id, user_id, group_id, place_id, title, address, lat, lng, h3, rating, review, completed_at
                FROM visits
                WHERE user_id IN ({placeholders})
                ORDER BY completed_at DESC
                LIMIT ?
                """,
                (*user_ids, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, user_id, group_id, place_id, title, address, lat, lng, h3, rating, review, completed_at
                FROM visits
                ORDER BY completed_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    out: List[Dict[str, Any]] = []
    for r in rows:
        (
            _id,
            user_id,
            group_id,
            place_id,
            title,
            address,
            lat,
            lng,
            h3_index,
            rating,
            review,
            completed_at,
        ) = r
        out.append(
            {
                "id": _id,
                "user_id": user_id,
                "group_id": group_id,
                "place_id": place_id,
                "title": title,
                "address": address,
                "lat": lat,
                "lng": lng,
                "h3": h3_index,
                "rating": rating,
                "review": review,
                "completed_at": completed_at,
            }
        )
    return out


