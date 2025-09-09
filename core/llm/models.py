from pydantic import BaseModel
from typing import List, Literal, Optional


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QueryRequest(BaseModel):
    message: str
    role: Literal["Default", "Policy-Maker", "Researcher", "Student"]
    history: List[ChatMessage] 

class QCObject(BaseModel):
    number: int
    variable: str


class QueryResponse(BaseModel):
    text: str
    links: Optional[str] = None
    QC: QCObject