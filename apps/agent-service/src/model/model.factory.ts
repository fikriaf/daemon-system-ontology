import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { TenantAgentConfig } from '../config/tenant-config.store.js';

/**
 * Config env yang dibaca oleh model factory.
 *
 * Provider detection dari AGENT_MODEL format "provider:model-name":
 *   openai:gpt-4o
 *   anthropic:claude-sonnet-4-6
 *   google-genai:gemini-2.0-flash
 *   openrouter:anthropic/claude-sonnet-4-6
 *   ollama:llama3
 *   lmstudio:llama-3-8b   (OpenAI-compatible local)
 *   custom:any-model-name  (OpenAI-compatible custom endpoint)
 *
 * Base URL override per provider (opsional):
 *   OPENAI_BASE_URL        — override OpenAI API endpoint
 *   ANTHROPIC_BASE_URL     — override Anthropic API endpoint
 *   GOOGLE_BASE_URL        — override Google API endpoint
 *   OPENROUTER_BASE_URL    — default: https://openrouter.ai/api/v1
 *   OLLAMA_BASE_URL        — default: http://localhost:11434/v1
 *   LMSTUDIO_BASE_URL      — default: http://localhost:1234/v1
 *   CUSTOM_BASE_URL        — wajib diset jika pakai provider "custom"
 */
export interface ModelConfig {
  /** Format "provider:model-name", e.g. "openai:gpt-4o" */
  agentModel: string;
  /** Optional temperature override (default: 0) */
  temperature?: number;
}

type ParsedModel = {
  provider: string;
  modelName: string;
};

function parseAgentModel(agentModel: string): ParsedModel {
  const colonIdx = agentModel.indexOf(':');
  if (colonIdx === -1) {
    // No provider prefix — assume openai
    return { provider: 'openai', modelName: agentModel };
  }
  return {
    provider: agentModel.slice(0, colonIdx),
    modelName: agentModel.slice(colonIdx + 1),
  };
}

/**
 * Resolve model dari per-tenant config, dengan fallback ke env vars.
 * Urutan prioritas: tenantConfig > env > default
 */
export function createModelFromConfig(
  tenantConfig: TenantAgentConfig | null,
  envConfig: ModelConfig = { agentModel: process.env.AGENT_MODEL ?? 'openai:gpt-4o' }
): BaseChatModel {
  const effectiveModel = tenantConfig?.agentModel ?? envConfig.agentModel;
  const effectiveTemp = tenantConfig?.temperature ?? envConfig.temperature;
  return createModelFromEnv({ agentModel: effectiveModel, temperature: effectiveTemp });
}

/**
 * Resolve a ChatOpenAI-compatible model instance from env config.
 *
 * Semua provider yang OpenAI-compatible (OpenRouter, Ollama, LM Studio, Groq,
 * Mistral, Together, dll) menggunakan ChatOpenAI dengan baseURL yang sesuai.
 * Provider yang butuh SDK sendiri (Anthropic, Google) memerlukan package
 * tambahan dan bisa ditambahkan di sini.
 */
export function createModelFromEnv(config: ModelConfig = {
  agentModel: process.env.AGENT_MODEL ?? 'openai:gpt-4o',
}): BaseChatModel {
  const { provider, modelName } = parseAgentModel(config.agentModel);
  const temperature = config.temperature ?? 0;

  switch (provider) {
    case 'openai': {
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.OPENAI_API_KEY,
        ...(process.env.OPENAI_BASE_URL && { configuration: { baseURL: process.env.OPENAI_BASE_URL } }),
        temperature,
      });
    }

    case 'openrouter': {
      // OpenRouter adalah OpenAI-compatible — pakai ChatOpenAI + custom baseURL
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://daemon-system.local',
            'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Daemon System Ontology',
          },
        },
        temperature,
      });
    }

    case 'ollama': {
      // Ollama expose OpenAI-compatible endpoint di /v1
      return new ChatOpenAI({
        model: modelName,
        apiKey: 'ollama', // Ollama tidak perlu real API key
        configuration: {
          baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
        },
        temperature,
      });
    }

    case 'lmstudio': {
      // LM Studio local inference server
      return new ChatOpenAI({
        model: modelName,
        apiKey: 'lm-studio', // tidak perlu real API key
        configuration: {
          baseURL: process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1',
        },
        temperature,
      });
    }

    case 'groq': {
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.GROQ_API_KEY,
        configuration: {
          baseURL: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
        },
        temperature,
      });
    }

    case 'together': {
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.TOGETHER_API_KEY,
        configuration: {
          baseURL: process.env.TOGETHER_BASE_URL ?? 'https://api.together.xyz/v1',
        },
        temperature,
      });
    }

    case 'mistral': {
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.MISTRAL_API_KEY,
        configuration: {
          baseURL: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
        },
        temperature,
      });
    }

    case 'custom': {
      // Generic OpenAI-compatible endpoint — wajib set CUSTOM_BASE_URL dan CUSTOM_API_KEY
      const baseURL = process.env.CUSTOM_BASE_URL;
      if (!baseURL) {
        throw new Error(
          'CUSTOM_BASE_URL harus diset jika menggunakan provider "custom". ' +
          'Contoh: CUSTOM_BASE_URL=http://localhost:8080/v1'
        );
      }
      return new ChatOpenAI({
        model: modelName,
        apiKey: process.env.CUSTOM_API_KEY ?? 'custom',
        configuration: { baseURL },
        temperature,
      });
    }

    case 'anthropic': {
      // Anthropic perlu @langchain/anthropic — akan throw dengan pesan jelas
      throw new Error(
        `Provider "anthropic" memerlukan package @langchain/anthropic. ` +
        `Jalankan: pnpm add @langchain/anthropic --filter @daemon/agent-service\n` +
        `Atau gunakan OpenRouter: AGENT_MODEL=openrouter:anthropic/${modelName}`
      );
    }

    case 'google-genai': {
      throw new Error(
        `Provider "google-genai" memerlukan package @langchain/google-genai. ` +
        `Jalankan: pnpm add @langchain/google-genai --filter @daemon/agent-service\n` +
        `Atau gunakan OpenRouter: AGENT_MODEL=openrouter:google/${modelName}`
      );
    }

    default: {
      throw new Error(
        `Provider tidak dikenal: "${provider}". ` +
        `Provider yang didukung: openai, openrouter, ollama, lmstudio, groq, together, mistral, custom\n` +
        `Format AGENT_MODEL: "provider:model-name", contoh: "openai:gpt-4o"`
      );
    }
  }
}
