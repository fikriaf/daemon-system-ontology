import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ModelConfig {
  provider: 'openai' | 'openrouter';
  modelName: string;
  temperature: number;
  maxTokens?: number;
}

export function createModel(config: ModelConfig): BaseChatModel {
  const modelName = config.modelName.startsWith('openrouter:')
    ? config.modelName.replace('openrouter:', '')
    : config.modelName;

  const isOpenRouter = config.modelName.startsWith('openrouter:');

  const baseOptions: ConstructorParameters<typeof ChatOpenAI>[0] = {
    model: modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };

  if (isOpenRouter) {
    return new ChatOpenAI({
      ...baseOptions,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.INTERNAL_AGENT_REFERRER ?? 'daemon-control-plane',
          'X-Title': 'Daemon Control Plane Internal Agent',
        },
      },
    });
  }

  return new ChatOpenAI(baseOptions);
}

export function getModelConfigFromEnv(): ModelConfig {
  const modelString = process.env.INTERNAL_AGENT_MODEL ?? 'openai/gpt-4o-mini';
  const isOpenRouter = modelString.startsWith('openrouter:');

  return {
    provider: isOpenRouter ? 'openrouter' : 'openai',
    modelName: modelString,
    temperature: Number(process.env.INTERNAL_AGENT_TEMPERATURE ?? '0.2'),
    maxTokens: Number(process.env.INTERNAL_AGENT_MAX_TOKENS ?? '2048'),
  };
}