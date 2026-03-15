"""Unit tests for JWT token issuance and verification."""

import time

import pytest

from api.services.token import issue_token, verify_token


def test_issue_and_verify_token():
    """Token should be valid and contain correct claims."""
    token = issue_token("user123", "product456")
    payload = verify_token(token)

    assert payload["sub"] == "user123"
    assert payload["pid"] == "product456"
    assert payload["scope"] == "reserve"
    assert "jti" in payload
    assert "exp" in payload


def test_token_contains_jti():
    """Each token should have a unique JTI."""
    token1 = issue_token("user1", "prod1")
    token2 = issue_token("user1", "prod1")

    p1 = verify_token(token1)
    p2 = verify_token(token2)

    assert p1["jti"] != p2["jti"]
