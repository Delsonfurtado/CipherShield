"""
CipherShield — Async Email Notification Service
Sends verification emails, security alerts, and emergency access notifications.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import List, Optional
import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Send an email using configured SMTP credentials."""
        if not self.settings.SMTP_USERNAME or not self.settings.SMTP_PASSWORD:
            logger.info("SMTP not configured. Mocking email send to %s. Subject: %s", to_email, subject)
            return True

        message = EmailMessage()
        message["From"] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject

        if text_content:
            message.set_content(text_content)
            message.add_alternative(html_content, subtype="html")
        else:
            message.set_content(html_content, subtype="html")

        try:
            await aiosmtplib.send(
                message,
                hostname=self.settings.SMTP_HOST,
                port=self.settings.SMTP_PORT,
                username=self.settings.SMTP_USERNAME,
                password=self.settings.SMTP_PASSWORD,
                start_tls=self.settings.SMTP_TLS,
                timeout=15.0,
            )
            logger.info("Email successfully sent to %s", to_email)
            return True
        except Exception as e:
            logger.error("Failed to send email to %s: %s", to_email, e)
            return False

    async def send_emergency_access_alert(
        self,
        owner_email: str,
        contact_email: str,
        wait_hours: int,
        approve_url: str,
        reject_url: str,
    ) -> bool:
        subject = f"⚠️ [ACTION REQUIRED] Emergency Access Requested for your CipherShield Vault"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #6366f1;">CipherShield Security Alert</h2>
            <p>Hello,</p>
            <p>Your designated emergency contact <strong>{contact_email}</strong> has requested access to your CipherShield vault.</p>
            <p>You have <strong>{wait_hours} hours</strong> to reject this request if it was not authorized. If you take no action, access will be granted automatically upon timer expiration.</p>
            <div style="margin: 30px 0;">
                <a href="{reject_url}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 12px;">REJECT REQUEST</a>
                <a href="{approve_url}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Approve Immediately</a>
            </div>
            <p style="color: #64748b; font-size: 13px;">If you did not set up this emergency contact or suspect account compromise, change your master password immediately.</p>
        </div>
        """
        return await self.send_email(owner_email, subject, html)

    async def send_breach_alert(
        self,
        email: str,
        breach_name: str,
        data_classes: List[str],
    ) -> bool:
        subject = f"🚨 Dark Web Alert: Your email was found in {breach_name}"
        data_str = ", ".join(data_classes)
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #ef4444;">CipherShield Breach Warning</h2>
            <p>Hello,</p>
            <p>Our continuous leak monitoring detected your email in a newly analyzed breach database: <strong>{breach_name}</strong>.</p>
            <p><strong>Compromised Information:</strong> {data_str}</p>
            <p>We recommend opening your CipherShield Security Dashboard immediately to identify any exposed or reused passwords.</p>
        </div>
        """
        return await self.send_email(email, subject, html)


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
