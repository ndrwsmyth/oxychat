from __future__ import annotations

from datetime import datetime


def format_timestamp(timestamp: str | float | int) -> str:
    """
    Format timestamp from decimal seconds to [mm:ss] or [hh:mm:ss] format.
    
    Args:
        timestamp: Timestamp as decimal seconds (string, float, or int)
        
    Returns:
        Formatted timestamp string like [mm:ss] or [hh:mm:ss]
    """
    try:
        # Parse timestamp as float (handles decimal seconds)
        total_seconds = float(timestamp)
        
        # Convert to hours, minutes, seconds
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        
        # Format based on whether we have hours
        if hours > 0:
            return f"[{hours:02d}:{minutes:02d}:{seconds:02d}]"
        else:
            return f"[{minutes:02d}:{seconds:02d}]"
    except (ValueError, TypeError):
        # If timestamp can't be parsed, return empty string
        return ""


def process_meeting_data(raw_json: dict) -> dict:
    """
    Process raw meeting JSON into structured format for database storage.

    Args:
        raw_json: Raw meeting data from webhook

    Returns:
        Dictionary ready for database insertion
    """
    meeting_id = raw_json["id"]
    doc_id = f"doc_{meeting_id}"

    # Extract title
    title = raw_json.get("name", "")

    # Extract and format date (YYYY-MM-DD)
    created_at_str = raw_json.get("createdAt", "")
    date_str = ""
    if created_at_str:
        try:
            # Parse ISO format datetime and extract date part
            dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            date_str = dt.strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            # Fallback: try to extract date substring if parsing fails
            date_str = created_at_str[:10] if len(created_at_str) >= 10 else ""

    # Extract attendees (preserve as list of dicts)
    attendees = raw_json.get("attendees", [])

    # Extract notes
    notes = raw_json.get("notes", "")

    # Extract transcript (preserve as list of dicts)
    transcript = raw_json.get("transcript", [])

    # Generate formatted markdown content
    formatted_content = _generate_formatted_content(
        title=title, date=date_str, attendees=attendees, notes=notes, transcript=transcript
    )

    return {
        "meeting_id": meeting_id,
        "doc_id": doc_id,
        "title": title,
        "date": date_str,
        "attendees": attendees,
        "transcript": transcript,
        "raw_payload": raw_json,
        "formatted_content": formatted_content,
        "source": "circleback",
        "processed": True,
    }


def _generate_formatted_content(
    title: str, date: str, attendees: list[dict], notes: str, transcript: list[dict]
) -> str:
    """Generate markdown-formatted content string."""
    parts = [f"# {title}", ""]

    if date:
        parts.append(f"**Date:** {date}")
        parts.append("")

    if attendees:
        parts.append("**Attendees:**")
        for attendee in attendees:
            name = attendee.get("name", "")
            email = attendee.get("email", "")
            if name and email:
                parts.append(f"- {name} ({email})")
            elif name:
                parts.append(f"- {name}")
            elif email:
                parts.append(f"- {email}")
        parts.append("")

    if notes:
        parts.append("## Notes")
        parts.append(notes)
        parts.append("")

    if transcript:
        parts.append("## Transcript")
        for entry in transcript:
            speaker = entry.get("speaker", "")
            text = entry.get("text", "")
            timestamp = entry.get("timestamp", "")
            if timestamp:
                formatted_timestamp = format_timestamp(timestamp)
                parts.append(f"{formatted_timestamp} {speaker}: {text}")
            else:
                parts.append(f"{speaker}: {text}")
        parts.append("")

    return "\n".join(parts)


