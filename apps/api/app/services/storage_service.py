"""
S3/MinIO storage service.
Generates presigned upload/download URLs and handles bucket init.
"""
import uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=Config(signature_version="s3v4"),
    )


def _s3_public_client():
    """Client using the public-facing URL — for generating browser-accessible presigned URLs."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_PUBLIC_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket_exists() -> None:
    """Create the bucket if it doesn't exist (idempotent)."""
    client = _s3_client()
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchBucket"):
            client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
        else:
            raise


def generate_upload_url(file_key: str, content_type: str, expires_in: int = 300) -> str:
    """Generate a presigned PUT URL for direct browser-to-S3 upload."""
    ensure_bucket_exists()
    client = _s3_public_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_download_url(file_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for downloading a file."""
    client = _s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": file_key},
        ExpiresIn=expires_in,
    )


def delete_object(file_key: str) -> None:
    client = _s3_client()
    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=file_key)


def build_file_key(job_id: str, upload_id: str, file_name: str) -> str:
    """Deterministic S3 key: resumes/{job_id}/{upload_id}/{file_name}"""
    return f"resumes/{job_id}/{upload_id}/{file_name}"


def download_object(file_key: str) -> bytes:
    """Download a file from S3/MinIO and return its bytes."""
    client = _s3_client()
    response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=file_key)
    return response["Body"].read()
