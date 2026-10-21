"""File storage. S3-compatible storage when S3_BUCKET is set; otherwise the database (survives redeploys on
hosts like Render whose disk is wiped on every deploy). Set STORAGE=local to use the UPLOAD_DIR folder instead."""
import asyncio
import logging
from pathlib import Path
from typing import Tuple

import os

from . import config

logger = logging.getLogger("bookslot.storage")

_s3_client = None


def _s3():
    global _s3_client
    if _s3_client is None:
        import boto3  # imported lazily so boto3 is only needed when S3 is used

        _s3_client = boto3.client("s3", endpoint_url=config.S3_ENDPOINT_URL, region_name=config.S3_REGION)
    return _s3_client


def _safe_local_path(key: str) -> Path:
    base = config.UPLOAD_DIR.resolve()
    path = (base / key).resolve()
    if base not in path.parents:
        raise ValueError("Invalid storage path")
    return path


def _put_sync(key: str, data: bytes, content_type: str) -> None:
    if config.S3_BUCKET:
        _s3().put_object(Bucket=config.S3_BUCKET, Key=key, Body=data, ContentType=content_type)
        return
    path = _safe_local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def _get_sync(key: str) -> bytes:
    if config.S3_BUCKET:
        obj = _s3().get_object(Bucket=config.S3_BUCKET, Key=key)
        return obj["Body"].read()
    return _safe_local_path(key).read_bytes()


def _use_db() -> bool:
    return not config.S3_BUCKET and os.environ.get("STORAGE", "db").lower() != "local"


async def put_object(key: str, data: bytes, content_type: str) -> None:
    if _use_db():
        from bson.binary import Binary
        from .db import db
        await db.file_blobs.update_one({"_id": key}, {"$set": {"data": Binary(data), "content_type": content_type}}, upsert=True)
        return
    await asyncio.to_thread(_put_sync, key, data, content_type)


async def get_object(key: str) -> bytes:
    if _use_db():
        from .db import db
        doc = await db.file_blobs.find_one({"_id": key})
        if doc:
            return bytes(doc["data"])
        # fall back to disk for files uploaded before this change
    return await asyncio.to_thread(_get_sync, key)


def backend_name() -> str:
    if config.S3_BUCKET:
        return f"s3://{config.S3_BUCKET}"
    return "database" if _use_db() else f"local:{config.UPLOAD_DIR}"


# Magic-byte sniffing so a renamed file can't masquerade as an image
_SIGNATURES = [
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"GIF87a", "gif", "image/gif"),
    (b"GIF89a", "gif", "image/gif"),
]


def sniff_image(data: bytes) -> Tuple[str, str]:
    for sig, ext, ctype in _SIGNATURES:
        if data.startswith(sig):
            return ext, ctype
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    raise ValueError("Unsupported image type. Upload a JPG, PNG, GIF or WebP file.")
