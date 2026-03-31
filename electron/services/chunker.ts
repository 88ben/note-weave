const AVG_CHARS_PER_TOKEN = 4
const DEFAULT_CHUNK_SIZE = 3000

export interface TextChunk {
  index: number
  text: string
  estimatedTokens: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
}

export function needsChunking(text: string, maxTokens = DEFAULT_CHUNK_SIZE): boolean {
  return estimateTokens(text) > maxTokens
}

export function chunkText(text: string, maxTokens = DEFAULT_CHUNK_SIZE): TextChunk[] {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN
  if (text.length <= maxChars) {
    return [{ index: 0, text, estimatedTokens: estimateTokens(text) }]
  }

  const paragraphs = text.split(/\n\s*\n/)
  const chunks: TextChunk[] = []
  let currentChunk = ''
  let chunkIndex = 0

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        estimatedTokens: estimateTokens(currentChunk)
      })
      currentChunk = ''
    }

    if (para.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          estimatedTokens: estimateTokens(currentChunk)
        })
        currentChunk = ''
      }
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para]
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
          chunks.push({
            index: chunkIndex++,
            text: currentChunk.trim(),
            estimatedTokens: estimateTokens(currentChunk)
          })
          currentChunk = ''
        }
        currentChunk += sentence
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.trim(),
      estimatedTokens: estimateTokens(currentChunk)
    })
  }

  return chunks
}
