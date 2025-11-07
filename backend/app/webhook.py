from __future__ import annotations

import os
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import json

from .database import get_db, save_meeting
from .processor import process_meeting_data

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


async def verify_webhook_secret(x_webhook_secret: str | None = Header(None)) -> None:
    """
    Verify webhook secret header.

    For local dev: allows empty secret if WEBHOOK_SECRET env var is not set.
    For production: requires matching secret when WEBHOOK_SECRET is set.
    """
    if not WEBHOOK_SECRET:
        # Local dev mode: allow requests but log warning
        logger.warning(
            "WEBHOOK_SECRET not set - webhook endpoint is open. "
            "Set WEBHOOK_SECRET environment variable for production."
        )
        return

    # Production mode: require matching secret
    if not x_webhook_secret or x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )


@router.post("/circleback")
async def webhook_circleback(
    request: Request,
    _: None = Depends(verify_webhook_secret),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Webhook endpoint to receive meeting data from CircleBack.

    Accepts an array of meeting objects, processes each one, and stores them in the database.
    """
    # Read raw body to see what we're actually receiving
    try:
        body = await request.body()
        logger.info(f"Raw request body received: {body.decode('utf-8')[:500]}")  # Log first 500 chars
        
        # Try to parse as JSON
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON: {str(e)}",
            )
        
        logger.info(f"Parsed payload type: {type(payload)}, value: {payload}")
        
    except Exception as e:
        logger.error(f"Error reading request body: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading request: {str(e)}",
        )
    
    # Handle both single object and array formats
    if isinstance(payload, dict):
        logger.info("Received single meeting object, converting to array")
        payload = [payload]
    elif not isinstance(payload, list):
        logger.error(f"Invalid payload type: {type(payload)}, expected list or dict")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload must be an array of meeting objects or a single meeting object, got {type(payload).__name__}",
        )
    
    logger.info(f"Webhook received: {len(payload)} meeting(s) in payload")

    processed_count = 0
    errors = []

    for meeting_data in payload:
        try:
            meeting_id = meeting_data.get("id", "unknown")
            logger.info(f"Processing meeting ID: {meeting_id}")
            
            # Validate required fields
            if "id" not in meeting_data:
                error_msg = f"Missing 'id' field in meeting: {meeting_data.get('name', 'unknown')}"
                logger.warning(error_msg)
                errors.append(error_msg)
                continue

            # Process meeting data
            logger.debug(f"Processing meeting data for ID {meeting_id}")
            processed = process_meeting_data(meeting_data)
            logger.debug(f"Meeting data processed successfully for ID {meeting_id}")

            # Save to database
            logger.info(f"Saving meeting {meeting_id} to database...")
            saved_meeting = await save_meeting(db, processed)
            logger.info(f"Successfully saved meeting {meeting_id} to database (DB ID: {saved_meeting.id})")
            processed_count += 1

        except Exception as e:
            logger.error(f"Error processing meeting {meeting_data.get('id', 'unknown')}: {e}", exc_info=True)
            errors.append(f"Error processing meeting {meeting_data.get('id', 'unknown')}: {str(e)}")

    if errors and processed_count == 0:
        # All meetings failed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process any meetings. Errors: {errors}",
        )

    return {
        "status": "success",
        "processed": processed_count,
        "total": len(payload),
        "errors": errors if errors else None,
    }


