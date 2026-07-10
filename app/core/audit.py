from datetime import UTC, datetime
from typing import Any

import structlog

# Create a logger dedicated to security/audit logs
audit_logger = structlog.get_logger("security.audit")


def log_audit_event(
    action: str,
    actor: str,
    ip_address: str,
    request_id: str | None = None,
    resource: str | None = None,
    status: str = "success",
    details: dict[str, Any] | None = None,
) -> None:
    """Log a security audit event with structured payload.

    Args:
        action: The name of the action performed (e.g. 'user.login', 'favorite.create').
        actor: Identifier of the user performing the action (e.g. user ID or email).
        ip_address: Client IP address.
        request_id: Optional UUID tracing the request.
        resource: Optional name/ID of the resource being acted on.
        status: The outcome of the action ('success' or 'failure').
        details: Optional context parameters. Sensitive data MUST be excluded.
    """
    event_payload = {
        "event_type": "security_audit",
        "timestamp": datetime.now(UTC).isoformat(),
        "action": action,
        "actor": actor,
        "ip_address": ip_address,
        "request_id": request_id,
        "resource": resource,
        "status": status,
        "details": details or {},
    }

    # Log the audit payload at INFO level
    audit_logger.info(f"Audit event: {action}", **event_payload)
