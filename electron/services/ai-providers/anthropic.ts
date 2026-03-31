import type { AIResponse, ModelInfo } from '../../../shared/types'
import type { AIProvider, ChatParams } from './index'
import { net } from 'electron'

export class AnthropicProvider implements AIProvider {
  id = 'anthropic'
  name = 'Anthropic'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const systemMessage = params.messages.find((m) => m.role === 'system')
    const nonSystemMessages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const response = await net.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 0.7,
        ...(systemMessage ? { system: systemMessage.content } : {}),
        messages: nonSystemMessages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    return {
      content: textBlock?.text || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens
          }
        : undefined
    }
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const systemMessage = params.messages.find((m) => m.role === 'system')
    const nonSystemMessages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const response = await net.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 0.7,
        stream: true,
        ...(systemMessage ? { system: systemMessage.content } : {}),
        messages: nonSystemMessages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error (${response.status}): ${error}`)
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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text
          }
        } catch {
          // skip
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' }
    ]
  }
}
