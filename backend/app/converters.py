from __future__ import annotations

from inspect import cleandoc
from typing import Any, Sequence

from chatkit.agents import ThreadItemConverter
from chatkit.types import (
    Attachment,
    UserMessageItem,
    UserMessageTagContent,
    UserMessageTextContent,
)
from openai.types.responses import (
    ResponseInputContentParam,
    ResponseInputTextParam,
)
from openai.types.responses.response_input_item_param import Message

from . import transcripts as transcripts_store


class TranscriptAwareConverter(ThreadItemConverter):
    async def attachment_to_message_content(
        self, attachment: Attachment
    ) -> ResponseInputContentParam:
        # Attachments are not supported in this demo backend.
        raise RuntimeError("File attachments are not supported in this build.")

    async def tag_to_message_content(self, tag: UserMessageTagContent) -> ResponseInputContentParam:
        # Only transcripts (doc_*) are supported for now.
        transcript = None
        if tag.id and tag.id.startswith("doc_"):
            # Try database first, then fall back to files
            from .database import async_session_maker, get_meeting_by_doc_id

            try:
                async with async_session_maker() as session:
                    meeting = await get_meeting_by_doc_id(session, tag.id)
                    if meeting:
                        transcript = transcripts_store.Transcript(
                            id=meeting.doc_id,
                            title=meeting.title,
                            date=meeting.date,
                            content=meeting.formatted_content,
                            summary=None,
                        )
            except Exception:
                # Fall through to file-based lookup
                pass

            # Fall back to file-based transcripts
            if transcript is None:
                transcript = transcripts_store.get_transcript(tag.id)

        if transcript is None:
            text = f"Transcript not found for id: {tag.id}"
            return ResponseInputTextParam(type="input_text", text=text)

        # Full transcript context (title, id, date, optional summary, content)
        parts: list[str] = [
            "---",
            f"Title: {transcript.title}",
            f"ID: {transcript.id}",
            f"Date: {transcript.date}",
        ]
        if transcript.summary:
            parts.append(f"Summary: {transcript.summary}")
        parts.append(f"Transcript:\n{transcript.content}")
        text = "\n".join(parts) + "\n"
        return ResponseInputTextParam(type="input_text", text=text)

    async def user_message_to_input(
        self, item: UserMessageItem, is_last_message: bool = True
    ) -> Message | list[Message] | None:
        # Build the user text exactly as typed, rendering tags as @key
        message_text_parts: list[str] = []
        # Track tags separately to add context
        raw_tags: list[UserMessageTagContent] = []

        for part in item.content:
            if isinstance(part, UserMessageTextContent):
                message_text_parts.append(part.text)
            elif isinstance(part, UserMessageTagContent):
                message_text_parts.append(f"@{part.text}")
                raw_tags.append(part)
            else:
                # Ignore unknown parts
                continue

        user_text_item = Message(
            role="user",
            type="message",
            content=[
                ResponseInputTextParam(type="input_text", text="".join(message_text_parts)),
                *[
                    await self.attachment_to_message_content(a)
                    for a in item.attachments
                ],
            ],
        )

        # Prepare context message with instructions and per-tag transcript content
        context_items: list[Message] = []

        if raw_tags:
            # Dedupe by tag.text, preserve order, cap at 5
            seen: set[str] = set()
            uniq: list[UserMessageTagContent] = []
            for t in raw_tags:
                if t.text not in seen:
                    seen.add(t.text)
                    uniq.append(t)
                if len(uniq) >= 5:
                    break

            tag_contents: list[ResponseInputContentParam] = []
            for tag in uniq:
                content = await self.tag_to_message_content(tag)
                tag_contents.append(content)

            if tag_contents:
                context_items.append(
                    Message(
                        role="user",
                        type="message",
                        content=[
                            ResponseInputTextParam(
                                type="input_text",
                                text=cleandoc(
                                    """
                                    # User-provided context for @-mentions
                                    - When referencing resolved entities, use their canonical names without '@'.
                                    - The '@' form appears only in user text and should not be echoed.
                                    - Each block below contains transcript context referenced by the user.
                                    """
                                ).strip(),
                            ),
                            *tag_contents,
                        ],
                    )
                )

        return [user_text_item, *context_items]


