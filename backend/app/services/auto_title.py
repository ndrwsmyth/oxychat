import os
from openai import AsyncOpenAI

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def generate_title(first_message: str) -> str:
    """
    Generate a concise 3-5 word title for a conversation based on the first user message.

    Uses GPT-4o-mini for speed and cost efficiency.

    Args:
        first_message: The first user message in the conversation

    Returns:
        A concise title string (3-5 words)
    """
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a concise 3-5 word title for this conversation. Do not use quotes or punctuation. Make it descriptive and specific."
                },
                {
                    "role": "user",
                    "content": first_message
                }
            ],
            max_tokens=20,
            temperature=0.7,
        )

        title = response.choices[0].message.content.strip()

        # Remove quotes if the model added them
        title = title.strip('"').strip("'")

        # Ensure it's not too long (max 500 chars as per DB constraint)
        if len(title) > 500:
            title = title[:497] + "..."

        return title

    except Exception as e:
        # Fallback to a generic title if API fails
        import logging
        logging.error(f"Failed to generate title: {e}")
        return "New conversation"
