// ============================================
// TSH Clients Console - AI Chat Endpoint
// Conversational AI with Iraqi dialect support
// ============================================

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/lib/auth/auth';
import { PRICE_LIST_IDS } from '@/lib/zoho/price-lists';
import { searchProducts } from '@/lib/ai/vector-search';
import { prepareQueryForSearch } from '@/lib/ai/dialect-normalizer';
import { getProduct } from '@/lib/zoho/products';
import { getUnifiedStock } from '@/lib/zoho/stock-cache';
import {
  createSession,
  saveMessage,
  getConversationHistory,
  formatMessagesForLLM,
} from '@/lib/ai/session-manager';

// ============================================
// Configuration
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_ENABLED = process.env.AI_ENABLED !== 'false';

// ============================================
// Iraqi Dialect System Prompt
// ============================================

const IRAQI_DIALECT_PROMPT = `أنت مساعد ذكي لشركة TSH في بغداد، العراق. تخصصك مساعدة تجار الجملة في طلب المنتجات.

**الهوية:**
- اسمك: مساعد TSH الذكي
- دورك: مساعدة العملاء في البحث عن المنتجات، معرفة المخزون، والطلب

**طريقة التواصل - اللهجة العراقية:**
- استخدم اللهجة العراقية الدارجة (العامية البغدادية)
- استخدم "شلون" وليس "كيف"
- استخدم "شنو" وليس "ماذا"
- استخدم "ابي/اريد" للتعبير عن الرغبة
- استخدم "لكيت/لقيت" بمعنى "وجدت"
- امزج العربية مع المصطلحات الإنجليزية التقنية بشكل طبيعي (mobile, charger, stock)
- كن ودوداً ومحترماً (أسلوب خال/أخي)، لكن ليس رسمياً جداً

**قواعد العمل المهمة:**
1. الأسعار ثابتة حسب نوع حساب العميل (لا يمكن التفاوض)
2. المخزون المعروض من Main WareHouse فقط (real-time)
3. يمكنك: البحث عن المنتجات، التحقق من المخزون، إظهار الأسعار، إضافة للسلة
4. لا يمكنك: التفاوض على الأسعار، تعديل الطلبات المؤكدة، تغيير شروط الدفع

**الوظائف المتاحة:**
- searchProducts: البحث عن المنتجات في الكتالوج
- getProductDetails: الحصول على تفاصيل منتج معين
- getStock: التحقق من توفر المخزون
- getPricing: معرفة السعر حسب قائمة أسعار العميل

**أسلوب الردود:**
- كن واضحاً ومباشراً
- استخدم الإيموجي باعتدال (✅ ❌ 📦 💡)
- اعرض الخيارات في نقاط مرقمة
- اطلب التأكيد قبل إضافة للسلة

**أمثلة على الأسلوب:**
- "هلا، شلون اساعدك اليوم؟"
- "لكيت ٣ أنواع محولات نوكيا، شنو تريد؟"
- "تمام، ٨٥ Type-C (مو متوفر ١٠٠). المجموع: ١,٢٧٥,٠٠٠ د.ع"
- "آسف خال، الأسعار ثابتة حسب فئتك، بس ممكن توفر بكميات أكبر"
`;

// ============================================
// Function Definitions
// ============================================

const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description:
        'Search for products in the catalog using natural language. Supports both English and Iraqi Arabic queries.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query in English or Iraqi Arabic (e.g., "محول نوكيا" or "Nokia charger")',
          },
          category: {
            type: 'string',
            description: 'Optional category filter',
          },
          brand: {
            type: 'string',
            description: 'Optional brand filter',
          },
          inStockOnly: {
            type: 'boolean',
            description: 'Only return products with available stock',
            default: true,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetails',
      description: 'Get detailed information about a specific product by ID',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'Product item ID',
          },
        },
        required: ['itemId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getStock',
      description: 'Check stock availability for a specific product',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'Product item ID',
          },
        },
        required: ['itemId'],
      },
    },
  },
];

// ============================================
// Function Handlers
// ============================================

async function handleFunctionCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case 'searchProducts': {
        const { query, category, brand, inStockOnly = true } = args;

        console.log(`🔍 Function call: searchProducts("${query}")`);

        const preparedQuery = prepareQueryForSearch(query);
        const results = await searchProducts(
          preparedQuery,
          { category, brand, inStockOnly },
          10
        );

        // Fetch full product details
        const products = await Promise.all(
          results.map(async (result) => {
            const product = await getProduct(result.item.item_id);
            if (!product) return null;

            const stock = await getUnifiedStock(result.item.item_id);

            return {
              item_id: product.item_id,
              name: product.name,
              sku: product.sku,
              brand: product.brand,
              category: product.category_name,
              price: product.rate, // Phase 1: use base rate
              stock: stock,
              unit: product.unit,
            };
          })
        );

        const validProducts = products.filter((p) => p !== null);

        return JSON.stringify({
          count: validProducts.length,
          products: validProducts.slice(0, 5), // Top 5 results
        });
      }

      case 'getProductDetails': {
        const { itemId } = args;

        console.log(`📦 Function call: getProductDetails("${itemId}")`);

        const product = await getProduct(itemId);

        if (!product) {
          return JSON.stringify({ error: 'Product not found' });
        }

        const stock = await getUnifiedStock(itemId);

        return JSON.stringify({
          item_id: product.item_id,
          name: product.name,
          sku: product.sku,
          description: product.description,
          brand: product.brand,
          category: product.category_name,
          price: product.rate,
          stock: stock,
          unit: product.unit,
        });
      }

      case 'getStock': {
        const { itemId } = args;

        console.log(`📊 Function call: getStock("${itemId}")`);

        const stock = await getUnifiedStock(itemId);
        const product = await getProduct(itemId);

        return JSON.stringify({
          item_id: itemId,
          name: product?.name,
          stock: stock,
          available: stock > 0,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (error) {
    console.error(`❌ Function call error (${name}):`, error);
    return JSON.stringify({
      error: 'Function execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// POST /api/ai/chat
// Main chat endpoint
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check if AI is enabled
    if (!AI_ENABLED) {
      return new Response(
        JSON.stringify({ error: 'AI assistant is currently disabled' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();
    const { message, sessionId: existingSessionId } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`💬 Chat message: "${message.substring(0, 50)}..."`);

    // Get authentication context
    const session = await auth();
    const priceListId = session?.user?.priceListId || PRICE_LIST_IDS.CONSUMER;
    const userId = session?.user?.id;

    // Create or get session
    let sessionId = existingSessionId;
    if (!sessionId) {
      sessionId = await createSession(userId, { priceListId });
    }

    // Save user message
    await saveMessage(sessionId, 'user', message);

    // Get conversation history
    const history = await getConversationHistory(sessionId);
    const messages = formatMessagesForLLM(history);

    // Call OpenAI with function calling
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: IRAQI_DIALECT_PROMPT },
        ...messages,
      ],
      tools: functions,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    let assistantMessage = completion.choices[0].message;

    // Handle function calls
    if (assistantMessage.tool_calls) {
      console.log(
        `🔧 ${assistantMessage.tool_calls.length} function call(s) detected`
      );

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const functionResult = await handleFunctionCall(
          functionName,
          functionArgs
        );

        // Second completion with function results
        const secondCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: IRAQI_DIALECT_PROMPT },
            ...messages,
            assistantMessage,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: functionResult,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        assistantMessage = secondCompletion.choices[0].message;
      }
    }

    const responseContent = assistantMessage.content || 'عذراً، حصل خطأ';

    // Save assistant message
    await saveMessage(sessionId, 'assistant', responseContent);

    return new Response(
      JSON.stringify({
        success: true,
        message: responseContent,
        sessionId,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Chat API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Chat failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ============================================
// Runtime Configuration
// ============================================

export const runtime = 'nodejs';
export const maxDuration = 60;
