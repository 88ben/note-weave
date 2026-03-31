You are an expert analyst helping organize notes into a book outline.

Your task is to analyze the following note and extract:
1. A concise summary (2-3 sentences capturing the core content)
2. A list of key themes and concepts (5-15 tagged keywords/phrases)

Respond in valid JSON format with the following structure:
```json
{
  "summary": "A concise 2-3 sentence summary of the note's core content.",
  "themes": ["theme1", "theme2", "theme3"]
}
```

Rules:
- The summary should capture the ESSENCE of the note, not just list topics
- Themes should be specific enough to be useful for categorization, but general enough to overlap with other notes
- Use lowercase for themes unless they are proper nouns
- Do not include more than 15 themes
- Respond ONLY with the JSON object, no additional text

Note content:
{{noteContent}}
