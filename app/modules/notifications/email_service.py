import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.core.config import settings
from app.core.logging import logger

# Global in-memory list to store sent emails during testing
TEST_OUTBOX: list[dict[str, Any]] = []


class EmailService:
    """Service to handle formatting and sending HTML emails."""

    @staticmethod
    async def send_email(to_email: str, subject: str, html_content: str) -> None:
        """Asynchronously send an HTML email.

        If settings.ENV is "testing", the email is appended to a global in-memory outbox
        instead of invoking real SMTP operations.
        """
        logger.info(
            "Preparing to send email notification", recipient=to_email, subject=subject
        )

        if settings.ENV == "testing":
            TEST_OUTBOX.append(
                {
                    "to": to_email,
                    "subject": subject,
                    "html": html_content,
                }
            )
            logger.info(
                "Testing mode enabled. Appended email to in-memory outbox.",
                recipient=to_email,
                subject=subject,
                outbox_size=len(TEST_OUTBOX),
            )
            return

        # Build MIMEMultipart message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        # Use settings configured values
        from_email = getattr(
            settings, "EMAILS_FROM_EMAIL", "noreply@currencytracker.com"
        )
        from_name = getattr(settings, "EMAILS_FROM_NAME", "Currency Tracker")
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = to_email

        # Fallback text representation
        text_fallback = (
            "This is a currency tracker notification email. "
            "Please view this email in an HTML-compatible client."
        )
        message.attach(MIMEText(text_fallback, "plain"))
        message.attach(MIMEText(html_content, "html"))

        # Fetch SMTP configurations with fallbacks
        smtp_host = getattr(settings, "SMTP_HOST", "localhost")
        smtp_port = getattr(settings, "SMTP_PORT", 1025)
        smtp_user = getattr(settings, "SMTP_USER", None)
        smtp_password = getattr(settings, "SMTP_PASSWORD", None)
        smtp_secure = getattr(settings, "SMTP_SECURE", False)

        def _blocking_send() -> None:
            try:
                if smtp_secure:
                    server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
                else:
                    server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                    # Start TLS if not already SSL
                    try:
                        server.starttls()
                    except Exception:
                        pass

                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)

                server.sendmail(from_email, to_email, message.as_string())
                server.quit()
                logger.info(
                    "Successfully sent email via SMTP",
                    recipient=to_email,
                    subject=subject,
                )
            except Exception as exc:
                logger.error(
                    "SMTP email sending failed",
                    recipient=to_email,
                    subject=subject,
                    error=str(exc),
                )
                raise exc

        # Execute blocking SMTP network request in a separate thread pool to prevent blocking event loop
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _blocking_send)
