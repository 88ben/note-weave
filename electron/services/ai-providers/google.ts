import type { AIResponse, ModelInfo } from '../../../shared/types'
import type { AIProvider, ChatParams } from './index'
import { net } from 'electron'

export class GoogleProvider implements AIProvider {
  id = 'google'
  name = 'Google Gemini'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const systemMessage = params.messages.find((m) => m.role === 'system')
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${this.apiKey}`

    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemMessage
          ? { systemInstruction: { parts: [{ text: systemMessage.content }] } }
          : {}),
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens || 4096
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return {
      content: text,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0
          }
        : undefined
    }
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const systemMessage = params.messages.find((m) => m.role === 'system')
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`

    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemMessage
          ? { systemInstruction: { parts: [{ text: systemMessage.content }] } }
          : {}),
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens || 4096
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google API error (${response.status}): ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) yield text
        } catch {
          // skip
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash' }
    ]
  }
}
