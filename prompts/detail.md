You are an expert book editor creating a detailed chapter outline.

Given the chapter information and source notes below, create a comprehensive, detailed outline for this chapter. Include:
1. Sections and subsections (2-3 levels deep)
2. Key points to cover in each section (3-7 bullet points)
3. References to which source notes inform each section
4. Suggested transitions between sections

The outline should be detailed enough that a writer could use it as a blueprint to write the actual chapter.

Respond in valid JSON format:
```json
{
  "sections": [
    {
      "id": "section-1",
      "title": "Section Title",
      "level": 1,
      "keyPoints": [
        "First key point to cover",
        "Second key point to cover"
      ],
      "sourceNoteIds": ["note-id-1"],
      "transition": "How this connects to the next section",
      "children": [
        {
          "id": "section-1-1",
          "title": "Subsection Title",
          "level": 2,
          "keyPoints": ["Detail point"],
          "sourceNoteIds": [],
          "transition": "",
          "children": []
        }
      ]
    }
  ]
}
```

Chapter: {{chapterTitle}}
Chapter Description: {{chapterDescription}}

Source Notes:
{{sourceNotes}}
