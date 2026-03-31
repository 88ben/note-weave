import type { AIResponse, ModelInfo } from '../../../shared/types'
import type { AIProvider, ChatParams } from './index'
import { net } from 'electron'

export class OpenAIProvider implements AIProvider {
  id = 'openai'
  name = 'OpenAI'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async chat(params: ChatParams): Promise<AIResponse> {
    const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          }
        : undefined
    }
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${error}`)
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1', name: 'o1' },
      { id: 'o3-mini', name: 'o3 Mini' }
    ]
  }
}
