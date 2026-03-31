You are an expert book editor helping structure a book from organized note clusters.

Below are thematic clusters of notes. Your task is to propose a chapter structure for the book, including:
1. Chapter ordering (logical flow from beginning to end)
2. Chapter titles
3. Brief description of each chapter's focus
4. Which clusters map to each chapter

Consider:
- What order tells the best story or builds knowledge progressively?
- Should any clusters be combined into a single chapter?
- Should any cluster be split across multiple chapters?
- Is there a natural introduction and conclusion?

Respond in valid JSON format:
```json
{
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Chapter Title",
      "description": "What this chapter covers and its role in the book's narrative.",
      "order": 1,
      "clusterIds": ["cluster-1"],
      "noteIds": ["note-id-1", "note-id-2"]
    }
  ]
}
```

Clusters:
{{clusters}}
