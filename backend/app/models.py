from typing import Literal
from pydantic import BaseModel, EmailStr, Field, model_validator


class Location(BaseModel):
    raw: str | None = None
    city: str | None = None
    country: str | None = None


class LeadCreateRequest(BaseModel):
    agency_id: str = Field(min_length=4)
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    budget: int | None = None
    currency: str | None = None
    location: Location | None = None
    property_type: str | None = None
    timeline: str | None = None
    preferred_channel: Literal["whatsapp", "sms", "email"] | None = None

    @model_validator(mode="after")
    def validate_contact(self):
        if not self.email and not self.phone:
            raise ValueError("email or phone is required")
        return self


class LeadEvent(BaseModel):
    type: Literal["lead.created", "lead.updated", "lead.hot", "lead.booked"]
    payload: dict
