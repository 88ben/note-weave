import type { AIProviderConfig, Message, AIResponse, ModelInfo } from '../../../shared/types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { GoogleProvider } from './google'

export interface ChatParams {
  model: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export interface AIProvider {
  id: string
  name: string
  chat(params: ChatParams): Promise<AIResponse>
  stream(params: ChatParams): AsyncIterable<string>
  listModels(): Promise<ModelInfo[]>
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config.apiKey)
    case 'anthropic':
      return new AnthropicProvider(config.apiKey)
    case 'google':
      return new GoogleProvider(config.apiKey)
    default:
      throw new Error(`Unknown AI provider: ${config.type}`)
  }
}
