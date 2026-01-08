"""Authentication utilities for Supabase JWT validation."""

from __future__ import annotations

import os
import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Initialize Supabase client (if configured)
supabase_client: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase_client = None
else:
    logger.warning(
        "SUPABASE_URL or SUPABASE_SERVICE_KEY not set. "
        "Authentication will not work. Set these in your .env file."
    )

# HTTP Bearer token security
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Validate Supabase JWT token and return user ID.

    This dependency extracts the JWT token from the Authorization header,
    validates it with Supabase, and returns the authenticated user's ID.

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        str: User ID (UUID) from Supabase auth.users

    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    # Check if Supabase is configured
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
        )

    # Check if credentials were provided
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Validate token with Supabase
        # This calls Supabase's auth.get_user() which verifies the JWT
        user_response = supabase_client.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = user_response.user.id

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.debug(f"Authenticated user: {user_id}")
        return user_id

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    """
    Optional authentication dependency.

    Returns user ID if valid token is provided, None otherwise.
    Useful for endpoints that work for both authenticated and anonymous users.

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        Optional[str]: User ID if authenticated, None if not
    """
    if not credentials or not supabase_client:
        return None

    try:
        user_response = supabase_client.auth.get_user(credentials.credentials)
        if user_response and user_response.user:
            return user_response.user.id
    except Exception as e:
        logger.debug(f"Optional auth failed (non-fatal): {e}")

    return None
