"""
Storage abstraction layer.

Provides a unified interface for file upload/retrieval/deletion
that works with local filesystem (development) and can be extended
to cloud object storage (production).

Usage:
    from storage import storage
    url = await storage.upload_file(content, filename, content_type)
    full_url = storage.get_file_url(relative_url)
    await storage.delete_file(relative_url)
"""

import os
import uuid
import logging
from abc import ABC, abstractmethod

from config import settings

logger = logging.getLogger("storage")


class StorageBackend(ABC):
    """Abstract storage backend."""

    @abstractmethod
    async def upload_file(self, content: bytes, filename: str, content_type: str = "") -> str:
        """Upload a file. Returns the relative URL path."""
        ...

    @abstractmethod
    def get_file_url(self, relative_url: str) -> str:
        """Get the full accessible URL for a stored file."""
        ...

    @abstractmethod
    async def delete_file(self, relative_url: str) -> bool:
        """Delete a file. Returns True if successful."""
        ...

    @abstractmethod
    def get_absolute_path(self, relative_url: str) -> str:
        """Get the absolute filesystem path for a stored file (for AI processing)."""
        ...


class LocalStorage(StorageBackend):
    """Local filesystem storage for development."""

    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    async def upload_file(self, content: bytes, filename: str, content_type: str = "") -> str:
        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(self.upload_dir, unique_name)
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"Stored file locally: {unique_name} ({len(content)} bytes)")
        return f"/uploads/{unique_name}"

    def get_file_url(self, relative_url: str) -> str:
        # For local, files are served via FastAPI StaticFiles mount
        return relative_url

    async def delete_file(self, relative_url: str) -> bool:
        filename = relative_url.split("/")[-1]
        file_path = os.path.join(self.upload_dir, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
            logger.info(f"Deleted file: {filename}")
            return True
        return False

    def get_absolute_path(self, relative_url: str) -> str:
        filename = relative_url.split("/")[-1]
        return os.path.abspath(os.path.join(self.upload_dir, filename))


class CloudStorage(StorageBackend):
    """
    Cloud object storage placeholder.

    To use with a real cloud provider (GCS, S3, Azure Blob):
    1. Set STORAGE_BACKEND=cloud in .env
    2. Set CLOUD_STORAGE_BUCKET and CLOUD_STORAGE_CREDENTIALS
    3. Implement the methods below with the provider's SDK

    This class currently raises NotImplementedError to clearly
    indicate that cloud storage is not yet configured.
    """

    def __init__(self, bucket: str = ""):
        self.bucket = bucket
        logger.warning("CloudStorage backend selected but not configured. "
                        "Set CLOUD_STORAGE_BUCKET and implement provider SDK.")

    async def upload_file(self, content: bytes, filename: str, content_type: str = "") -> str:
        raise NotImplementedError(
            "Cloud storage is not configured. "
            "Set STORAGE_BACKEND=local in .env or implement CloudStorage."
        )

    def get_file_url(self, relative_url: str) -> str:
        raise NotImplementedError("Cloud storage is not configured.")

    async def delete_file(self, relative_url: str) -> bool:
        raise NotImplementedError("Cloud storage is not configured.")

    def get_absolute_path(self, relative_url: str) -> str:
        raise NotImplementedError(
            "Cloud storage does not have local filesystem paths. "
            "Download the file first for AI processing."
        )


def _create_storage() -> StorageBackend:
    """Factory: create the appropriate storage backend based on configuration."""
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "cloud":
        bucket = os.getenv("CLOUD_STORAGE_BUCKET", "")
        return CloudStorage(bucket=bucket)
    return LocalStorage(upload_dir=settings.UPLOAD_DIR)


# Singleton instance
storage = _create_storage()
