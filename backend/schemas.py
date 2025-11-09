from typing import List, Optional
from pydantic import BaseModel, Field

class UserTaste(BaseModel):
    user_id: str
    likes: List[str] = []
    dislikes: List[str] = []
    vibes: List[str] = []
    budget_max: Optional[float] = None
    distance_km_max: Optional[float] = None
    tags: List[str] = []

class GroupRequest(BaseModel):
    query_text: str
    user_ids: List[str]
    location_hint: Optional[str] = None
    time_window: Optional[str] = None
    vibe_hint: Optional[str] = None
    budget_cap: Optional[float] = None
    distance_km: Optional[float] = None
    custom_likes: List[str] = Field(default_factory=list)
    custom_tags: List[str] = Field(default_factory=list)

class FriendOverride(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    vibes: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    budget_max: Optional[float] = None
    distance_km_max: Optional[float] = None

class PlanCard(BaseModel):
    title: str
    subtitle: Optional[str] = None
    time: Optional[str] = None
    price: Optional[str] = None
    vibe: Optional[str] = None
    energy: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distance_km: Optional[float] = None
    booking_url: Optional[str] = None
    maps_url: Optional[str] = None
    summary: Optional[str] = None
    group_score: float
    reasons: List[str]
    source: str

class PlanResponse(BaseModel):
    query_normalized: str
    merged_vibe: Optional[str] = None
    energy_profile: Optional[str] = None
    candidates: List[PlanCard]
    action_log: List[str]
