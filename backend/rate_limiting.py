"""
Rate Limiting for TimeSlot Pro
Protects against brute force attacks and API abuse
"""
import time
import logging
from typing import Dict, Optional, Tuple
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import Request, HTTPException
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter.
    For production with multiple workers, use Redis-based limiter.
    """
    
    def __init__(self):
        # {key: [(timestamp, count), ...]}
        self._requests: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()
    
    async def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request is allowed under rate limit.
        
        Returns: (allowed, remaining, reset_seconds)
        """
        now = time.time()
        window_start = now - window_seconds
        
        async with self._lock:
            # Clean old entries
            self._requests[key] = [
                ts for ts in self._requests[key]
                if ts > window_start
            ]
            
            current_count = len(self._requests[key])
            
            if current_count >= max_requests:
                # Find when the oldest request in window will expire
                if self._requests[key]:
                    oldest = min(self._requests[key])
                    reset_in = int(oldest + window_seconds - now) + 1
                else:
                    reset_in = window_seconds
                    
                return False, 0, reset_in
            
            # Allow request
            self._requests[key].append(now)
            remaining = max_requests - current_count - 1
            
            return True, remaining, window_seconds
    
    async def cleanup(self, max_age_seconds: int = 3600):
        """Remove old entries to prevent memory bloat"""
        now = time.time()
        cutoff = now - max_age_seconds
        
        async with self._lock:
            keys_to_delete = []
            for key, timestamps in self._requests.items():
                self._requests[key] = [ts for ts in timestamps if ts > cutoff]
                if not self._requests[key]:
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                del self._requests[key]


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


# Rate limit configurations
RATE_LIMITS = {
    "auth_login": {"max_requests": 5, "window_seconds": 60},      # 5 per minute
    "auth_register": {"max_requests": 3, "window_seconds": 60},   # 3 per minute
    "auth_password_reset": {"max_requests": 3, "window_seconds": 300},  # 3 per 5 min
    "public_booking": {"max_requests": 10, "window_seconds": 60}, # 10 per minute
    "api_general": {"max_requests": 100, "window_seconds": 60},   # 100 per minute
}


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies"""
    # Check X-Forwarded-For header (for reverse proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP in the chain (original client)
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct connection
    if request.client:
        return request.client.host
    
    return "unknown"


async def check_rate_limit(
    request: Request,
    limit_type: str,
    identifier: Optional[str] = None
) -> None:
    """
    Check rate limit and raise HTTPException if exceeded.
    
    Args:
        request: FastAPI request object
        limit_type: Key in RATE_LIMITS dict
        identifier: Optional additional identifier (e.g., email for login)
    """
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["api_general"])
    
    # Build rate limit key
    ip = get_client_ip(request)
    if identifier:
        key = f"{limit_type}:{ip}:{identifier}"
    else:
        key = f"{limit_type}:{ip}"
    
    allowed, remaining, reset_in = await rate_limiter.is_allowed(
        key,
        config["max_requests"],
        config["window_seconds"]
    )
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for {key}")
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Too many requests",
                "retry_after": reset_in,
                "message": f"Rate limit exceeded. Try again in {reset_in} seconds."
            },
            headers={
                "Retry-After": str(reset_in),
                "X-RateLimit-Limit": str(config["max_requests"]),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + reset_in)
            }
        )


async def add_rate_limit_headers(
    request: Request,
    limit_type: str,
    identifier: Optional[str] = None
) -> Dict[str, str]:
    """Get rate limit headers without blocking (for successful requests)"""
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["api_general"])
    ip = get_client_ip(request)
    
    if identifier:
        key = f"{limit_type}:{ip}:{identifier}"
    else:
        key = f"{limit_type}:{ip}"
    
    # Just check without adding a request
    async with rate_limiter._lock:
        now = time.time()
        window_start = now - config["window_seconds"]
        current = [ts for ts in rate_limiter._requests.get(key, []) if ts > window_start]
        remaining = max(0, config["max_requests"] - len(current))
    
    return {
        "X-RateLimit-Limit": str(config["max_requests"]),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(int(now + config["window_seconds"]))
    }


# Background task to periodically clean up old rate limit entries
async def rate_limit_cleanup_task():
    """Run periodically to clean up old rate limit entries"""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        await rate_limiter.cleanup()
        logger.debug("Rate limiter cleanup completed")
