# src/models.py
# Re-export để thống nhất các entity và tránh duplicate SQLAlchemy Base metadata
from src.conference.models import Conference
from src.conference.tracks.models import Track
from src.conference.topics.models import Topic
from src.conference.reviewers.models import ConferenceReviewer, ReviewerStatus

__all__ = ["Conference", "Track", "Topic", "ConferenceReviewer", "ReviewerStatus"]
