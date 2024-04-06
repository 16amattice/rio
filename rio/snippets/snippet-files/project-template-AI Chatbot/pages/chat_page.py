from __future__ import annotations

from dataclasses import KW_ONLY, field
import openai
from typing import *  # type: ignore
from datetime import datetime, timezone

import rio

from .. import components as comps
from .. import conversation


class ChatPage(rio.Component):
    conversation: conversation.Conversation = field(
        default_factory=conversation.Conversation
    )

    user_message_text: str = ""

    is_loading: bool = False

    async def on_text_input_confirm(self, *_) -> None:
        # If the user hasn't typed anything, do nothing
        message_text = self.user_message_text.strip()

        if not message_text:
            return

        # Empty the text input so the user can type another message
        self.user_message_text = ""

        # A question was asked!
        await self.on_question(message_text)

    async def on_question(self, message_text: str) -> None:
        # Add the user's message to the chat history
        self.conversation.messages.append(
            conversation.ChatMessage(
                role="user",
                timestamp=datetime.now(tz=timezone.utc),
                text=message_text,
            )
        )

        # Indicate to the user that the app is doing something
        self.is_loading = True
        await self.force_refresh()

        # Generate a response
        try:
            await self.conversation.respond(
                client=self.session[openai.AsyncOpenAI],
            )

        # Don't get stuck in loading state if an error occurs
        finally:
            self.is_loading = False

    def build(self) -> rio.Component:
        # If there aren't any messages yet, display a placeholder
        if not self.conversation.messages:
            return comps.EmptyChatPlaceholder(
                user_message_text=self.user_message_text,
                on_question=self.on_question,
                align_x=0.5,
                align_y=0.5,
            )

        # If the screen is wide, center the chat
        if self.session.window_width > 40:
            column_width = 40
            column_align_x = 0.5
        else:
            column_width = 0
            column_align_x = None

        # Prepare the message components
        message_components: list[rio.Component] = [
            comps.ChatMessage(msg) for msg in self.conversation.messages
        ]

        if self.is_loading:
            message_components.append(
                comps.GeneratingResponsePlaceholder(
                    align_x=0.5,
                )
            )

        return rio.Stack(
            rio.Icon(
                "rio/logo:fill",
                width=3,
                height=3,
                align_x=0,
                margin=2,
                align_y=0,
            ),
            rio.Icon(
                "castle",
                width=3,
                height=3,
                align_x=1,
                margin=2,
                align_y=0,
            ),
            rio.Column(
                # Messages
                rio.ScrollContainer(
                    rio.Column(
                        # Display the messages
                        *message_components,
                        # Take up superfluous space
                        rio.Spacer(),
                        spacing=1,
                        # Center the column on wide screens
                        width=column_width,
                        margin=2,
                        align_x=column_align_x,
                    ),
                    scroll_x="never",
                    scroll_y="auto",
                    height="grow",
                ),
                # User input
                rio.Row(
                    rio.MultiLineTextInput(
                        label="Ask something...",
                        text=self.bind().user_message_text,
                        on_confirm=self.on_text_input_confirm,
                        is_sensitive=not self.is_loading,
                        width="grow",
                        height=8,
                    ),
                    rio.IconButton(
                        icon="navigate-next",
                        size=4,
                        on_press=self.on_text_input_confirm,
                        is_sensitive=not self.is_loading,
                        align_y=0.5,
                    ),
                    spacing=1,
                    width=column_width,
                    margin_bottom=1,
                    align_x=column_align_x,
                ),
                spacing=0.5,
            ),
        )
