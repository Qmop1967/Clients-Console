// ============================================
// TSH Clients Console - AI Model Router
// Intelligent model selection based on query complexity
// ============================================

import OpenAI from 'openai';

// ============================================
// Model Definitions
// ============================================

export const AI_MODELS = {
  // Fast & cost-effective for simple queries
  MINI: 'llama-3.1-8b-instant',

  // Main model for conversations
  STANDARD: 'llama-3.3-70b-versatile',

  // Complex reasoning (recommendations, analytics)
  REASONING: 'llama-3.3-70b-versatile',

  // Mini reasoning model (faster, cheaper)
  REASONING_MINI: 'llama-3.3-70b-versatile',
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

// ============================================
// Cost per 1M tokens (input / output)
// ============================================

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
};

// ============================================
// Query Intent Types
// ============================================

export enum QueryIntent {
  // Simple queries (gpt-4o-mini)
  STOCK_CHECK = 'stock_check',
  SIMPLE_QUESTION = 'simple_question',
  GREETING = 'greeting',

  // Standard queries (gpt-4o)
  PRODUCT_SEARCH = 'product_search',
  PRODUCT_DETAILS = 'product_details',
  GENERAL_CONVERSATION = 'general_conversation',

  // Complex reasoning (o1-preview/o1-mini)
  ORDER_ANALYSIS = 'order_analysis',
  RECOMMENDATIONS = 'recommendations',
  PRICE_COMPARISON = 'price_comparison',
  ANALYTICS = 'analytics',
  MULTI_STEP_REASONING = 'multi_step_reasoning',
}

// ============================================
// Model Router
// ============================================

export class ModelRouter {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
  }

  /**
   * Analyze query intent to determine best model
   */
  async analyzeIntent(message: string): Promise<QueryIntent> {
    const messageLower = message.toLowerCase();

    // Simple patterns for quick routing
    const simplePatterns = {
      [QueryIntent.STOCK_CHECK]: [
        /متوفر/,
        /موجود/,
        /مخزون/,
        /stock/i,
        /available/i,
        /في عندكم/,
      ],
      [QueryIntent.GREETING]: [
        /^(هلا|سلام|هاي|مرحبا|hello|hi)/,
        /شلونك/,
        /كيف حالك/,
      ],
      [QueryIntent.SIMPLE_QUESTION]: [
        /^(شنو|ماذا|what|متى|when)/,
        /كم سعر/,
        /شكد/,
      ],
    };

    // Check simple patterns first
    for (const [intent, patterns] of Object.entries(simplePatterns)) {
      if (patterns.some((pattern) => pattern.test(messageLower))) {
        return intent as QueryIntent;
      }
    }

    // Complex patterns
    const complexPatterns = {
      [QueryIntent.ORDER_ANALYSIS]: [
        /طلبيات/,
        /طلبية/,
        /فاتورة/,
        /order/i,
        /invoice/i,
        /purchase/i,
        /رصيد/,
        /balance/i,
      ],
      [QueryIntent.RECOMMENDATIONS]: [
        /وريني/,
        /اقترح/,
        /recommend/i,
        /suggest/i,
        /شنو تنصح/,
        /شنو أفضل/,
        /frequently.*bought/i,
      ],
      [QueryIntent.ANALYTICS]: [
        /تحليل/,
        /إحصائيات/,
        /analytics/i,
        /stats/i,
        /trends/i,
        /مبيعات/,
        /sales/i,
      ],
      [QueryIntent.PRICE_COMPARISON]: [
        /قارن/,
        /compare/i,
        /أرخص/,
        /cheaper/i,
        /بديل/,
        /alternative/i,
      ],
    };

    for (const [intent, patterns] of Object.entries(complexPatterns)) {
      if (patterns.some((pattern) => pattern.test(messageLower))) {
        return intent as QueryIntent;
      }
    }

    // Default to standard conversation
    return QueryIntent.GENERAL_CONVERSATION;
  }

  /**
   * Select best model for query intent
   */
  selectModel(intent: QueryIntent): AIModel {
    const modelMap: Record<QueryIntent, AIModel> = {
      // Simple queries → Mini model
      [QueryIntent.STOCK_CHECK]: AI_MODELS.MINI,
      [QueryIntent.SIMPLE_QUESTION]: AI_MODELS.MINI,
      [QueryIntent.GREETING]: AI_MODELS.MINI,

      // Standard queries → Main model
      [QueryIntent.PRODUCT_SEARCH]: AI_MODELS.STANDARD,
      [QueryIntent.PRODUCT_DETAILS]: AI_MODELS.STANDARD,
      [QueryIntent.GENERAL_CONVERSATION]: AI_MODELS.STANDARD,

      // Complex reasoning → Reasoning models
      [QueryIntent.ORDER_ANALYSIS]: AI_MODELS.REASONING_MINI,
      [QueryIntent.RECOMMENDATIONS]: AI_MODELS.REASONING_MINI,
      [QueryIntent.PRICE_COMPARISON]: AI_MODELS.REASONING_MINI,
      [QueryIntent.ANALYTICS]: AI_MODELS.REASONING,
      [QueryIntent.MULTI_STEP_REASONING]: AI_MODELS.REASONING,
    };

    return modelMap[intent] || AI_MODELS.STANDARD;
  }

  /**
   * Calculate cost for a completion
   */
  calculateCost(
    model: AIModel,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = MODEL_COSTS[model];
    if (!costs) return 0;

    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;

    return inputCost + outputCost;
  }

  /**
   * Get model with fallback on rate limits
   */
  async chatWithFallback(
    params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>,
    preferredModel: AIModel
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      const completion = await this.openai.chat.completions.create({
        ...params,
        model: preferredModel,
        stream: false,
      });
      return completion as OpenAI.Chat.Completions.ChatCompletion;
    } catch (error: any) {
      // Rate limit error → Fallback to mini model
      if (error?.status === 429 && preferredModel !== AI_MODELS.MINI) {
        console.warn(
          `⚠️  Rate limit on ${preferredModel}, falling back to ${AI_MODELS.MINI}`
        );

        const fallback = await this.openai.chat.completions.create({
          ...params,
          model: AI_MODELS.MINI,
          stream: false,
        });
        return fallback as OpenAI.Chat.Completions.ChatCompletion;
      }

      throw error;
    }
  }

  /**
   * Smart routing: Analyze intent and select model
   */
  async smartRoute(
    message: string
  ): Promise<{ model: AIModel; intent: QueryIntent }> {
    const intent = await this.analyzeIntent(message);
    const model = this.selectModel(intent);

    console.log(`🧠 Intent: ${intent} → Model: ${model}`);

    return { model, intent };
  }
}
