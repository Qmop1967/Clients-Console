// ============================================
// TSH Clients Console - Enhanced AI Chat Endpoint
// Multi-model strategy with business intelligence
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
import { ModelRouter } from '@/lib/ai/model-router';
import { generateSystemPrompt } from '@/lib/ai/system-prompts';
import {
  getCustomerContext,
  getCustomerOrders,
  getOrderStatus,
  getCustomerInvoices,
  getReorderSuggestions,
  getFrequentlyBoughtTogether,
  getLowStockAlerts,
} from '@/lib/ai/customer-intelligence';

// ============================================
// Configuration
// ============================================

const modelRouter = new ModelRouter(process.env.OPENAI_API_KEY || '');
const AI_ENABLED = process.env.AI_ENABLED !== 'false';

// ============================================
// Enhanced Function Definitions
// ============================================

const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // Existing functions
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
  // NEW: Customer & Order Management
  {
    type: 'function',
    function: {
      name: 'getCustomerOrders',
      description:
        'Get customer order history with details. Use when customer asks about their orders or purchase history.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of orders to return (default: 10)',
            default: 10,
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOrderStatus',
      description:
        'Track a specific order by ID. Use when customer asks "where is my order" or provides order number.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'Sales order ID or order number',
          },
        },
        required: ['orderId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerInvoices',
      description:
        'Get customer invoices and payment status. Use when customer asks about their balance, bills, or payments.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['paid', 'unpaid', 'overdue'],
            description: 'Filter by invoice status (optional)',
          },
        },
      },
    },
  },
  // NEW: Smart Recommendations
  {
    type: 'function',
    function: {
      name: 'getReorderSuggestions',
      description:
        'Get smart reorder suggestions based on customer purchase history. Products they used to order regularly.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFrequentlyBoughtTogether',
      description:
        'Get products frequently bought together with a specific item. Use for cross-sell recommendations.',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'Product item ID to find related products for',
          },
        },
        required: ['itemId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLowStockAlerts',
      description:
        "Get low stock alerts for customer's favorite products. Use proactively to warn about stock issues.",
      parameters: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Stock threshold to alert at (default: 10)',
            default: 10,
          },
        },
      },
    },
  },
];

// ============================================
// Enhanced Function Handlers
// ============================================

async function handleFunctionCall(
  name: string,
  args: Record<string, unknown>,
  customerId?: string
): Promise<string> {
  try {
    switch (name) {
      case 'searchProducts': {
        const { query, category, brand, inStockOnly = true } = args;

        console.log(`🔍 searchProducts("${query}")`);

        const preparedQuery = prepareQueryForSearch(String(query));
        const results = await searchProducts(
          preparedQuery,
          {
            category: category ? String(category) : undefined,
            brand: brand ? String(brand) : undefined,
            inStockOnly: Boolean(inStockOnly),
          },
          10
        );

        const products = await Promise.all(
          results.map(async (result) => {
            const product = await getProduct(result.item.item_id);
            if (!product) return null;

            const stock = await getUnifiedStock(result.item.item_id);

            return {
              item_id: product.item_id,
              name: product.name,
              description: product.description || '',
              sku: product.sku,
              brand: product.brand,
              category: product.category_name,
              price: product.rate,
              stock: stock.stock,
              unit: product.unit,
              image_url: product.image_url || '',
            };
          })
        );

        const validProducts = products.filter((p) => p !== null);

        return JSON.stringify({
          count: validProducts.length,
          products: validProducts.slice(0, 5),
        });
      }

      case 'getProductDetails': {
        const { itemId } = args;

        console.log(`📦 getProductDetails("${itemId}")`);

        const product = await getProduct(String(itemId));
        if (!product) {
          return JSON.stringify({ error: 'Product not found' });
        }

        const stock = await getUnifiedStock(String(itemId));

        return JSON.stringify({
          item_id: product.item_id,
          name: product.name,
          sku: product.sku,
          description: product.description || '',
          brand: product.brand,
          category: product.category_name,
          price: product.rate,
          stock: stock.stock,
          unit: product.unit,
          image_url: product.image_url || '',
        });
      }

      case 'getStock': {
        const { itemId } = args;

        console.log(`📊 getStock("${itemId}")`);

        const stockData = await getUnifiedStock(String(itemId));
        const product = await getProduct(String(itemId));

        return JSON.stringify({
          item_id: String(itemId),
          name: product?.name,
          stock: stockData.stock,
          available: stockData.stock > 0,
        });
      }

      // NEW: Customer & Order Management
      case 'getCustomerOrders': {
        if (!customerId) {
          return JSON.stringify({
            error: 'Customer must be logged in to view orders',
          });
        }

        console.log(`📋 getCustomerOrders(customer: ${customerId})`);

        const { limit = 10 } = args;
        const orders = await getCustomerOrders(
          customerId,
          Number(limit)
        );

        return JSON.stringify({
          count: orders.length,
          orders: orders.map((o) => ({
            order_number: o.salesorder_number,
            date: o.date,
            total: o.total,
            status: o.status,
            delivery_date: o.delivery_date,
            items: o.line_items.length,
          })),
        });
      }

      case 'getOrderStatus': {
        const { orderId } = args;

        console.log(`🔎 getOrderStatus("${orderId}")`);

        const order = await getOrderStatus(String(orderId));
        if (!order) {
          return JSON.stringify({ error: 'Order not found' });
        }

        return JSON.stringify({
          order_number: order.salesorder_number,
          date: order.date,
          total: order.total,
          status: order.status,
          delivery_date: order.delivery_date,
          items: order.line_items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            total: item.total,
          })),
        });
      }

      case 'getCustomerInvoices': {
        if (!customerId) {
          return JSON.stringify({
            error: 'Customer must be logged in to view invoices',
          });
        }

        console.log(`💰 getCustomerInvoices(customer: ${customerId})`);

        const { status } = args;
        const invoices = await getCustomerInvoices(
          customerId,
          status as 'paid' | 'unpaid' | 'overdue' | undefined
        );

        const totalBalance = invoices.reduce((sum, inv) => sum + inv.balance, 0);

        return JSON.stringify({
          count: invoices.length,
          total_balance: totalBalance,
          invoices: invoices.slice(0, 10).map((inv) => ({
            invoice_number: inv.invoice_number,
            date: inv.date,
            due_date: inv.due_date,
            total: inv.total,
            balance: inv.balance,
            status: inv.status,
          })),
        });
      }

      // NEW: Smart Recommendations
      case 'getReorderSuggestions': {
        if (!customerId) {
          return JSON.stringify({
            error: 'Customer must be logged in for recommendations',
          });
        }

        console.log(`💡 getReorderSuggestions(customer: ${customerId})`);

        const suggestions = await getReorderSuggestions(customerId);

        return JSON.stringify({
          count: suggestions.length,
          suggestions: suggestions.slice(0, 5).map((s) => ({
            item_id: s.item_id,
            name: s.name,
            last_ordered: s.lastOrdered,
          })),
        });
      }

      case 'getFrequentlyBoughtTogether': {
        const { itemId } = args;

        console.log(`🔗 getFrequentlyBoughtTogether("${itemId}")`);

        const related = await getFrequentlyBoughtTogether(
          String(itemId),
          customerId
        );

        return JSON.stringify({
          count: related.length,
          products: related.map((p) => ({
            item_id: p.item_id,
            name: p.name,
            frequency: p.frequency,
          })),
        });
      }

      case 'getLowStockAlerts': {
        if (!customerId) {
          return JSON.stringify({
            error: 'Customer must be logged in for alerts',
          });
        }

        console.log(`⚠️  getLowStockAlerts(customer: ${customerId})`);

        const { threshold = 10 } = args;
        const alerts = await getLowStockAlerts(customerId, Number(threshold));

        return JSON.stringify({
          count: alerts.length,
          alerts: alerts.map((a) => ({
            item_id: a.item_id,
            name: a.name,
            stock: a.stock,
            order_count: a.orderCount,
          })),
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
// Enhanced with multi-model strategy and business intelligence
// ============================================

export async function POST(request: NextRequest) {
  try {
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
    const customerId = session?.user?.zohoContactId;

    // Get customer context for personalization
    let customerContext;
    if (customerId) {
      customerContext = await getCustomerContext(customerId);
      console.log(`👤 Customer: ${customerContext?.name} (${customerContext?.priceListName})`);
    }

    // Smart model selection based on query intent
    const { model, intent } = await modelRouter.smartRoute(message);
    console.log(`🎯 Selected model: ${model} (intent: ${intent})`);

    // Create or get session
    let sessionId = existingSessionId;
    if (!sessionId) {
      sessionId = await createSession(userId, {
        priceListId,
        currencyCode: session?.user?.currencyCode,
      });
    }

    // Save user message
    await saveMessage(sessionId, 'user', message);

    // Get conversation history
    const history = await getConversationHistory(sessionId);
    const messages = formatMessagesForLLM(history);

    // Generate system prompt with customer context
    const systemPrompt = generateSystemPrompt(customerContext || undefined);

    // Call OpenAI with smart model selection
    const completion = await modelRouter.chatWithFallback(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: functions as any,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      },
      model
    );

    let assistantMessage = completion.choices[0].message;
    let products: any[] = [];
    let lastFunctionName = '';

    // Calculate cost
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const cost = modelRouter.calculateCost(model, inputTokens, outputTokens);

    console.log(
      `💰 Cost: $${cost.toFixed(6)} (${inputTokens} in + ${outputTokens} out)`
    );

    // Handle function calls
    if (assistantMessage.tool_calls) {
      console.log(
        `🔧 ${assistantMessage.tool_calls.length} function call(s) detected`
      );

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        lastFunctionName = functionName;

        const functionResult = await handleFunctionCall(
          functionName,
          functionArgs,
          customerId
        );

        // Extract products from function results
        if (
          functionName === 'searchProducts' ||
          functionName === 'getProductDetails'
        ) {
          try {
            const result = JSON.parse(functionResult);
            if (result.products && Array.isArray(result.products)) {
              products = result.products.slice(0, 3).map((p: any) => ({
                itemId: p.item_id,
                name: p.name,
                imageUrl: p.image_url,
                price: p.price,
                stock: p.stock,
              }));
            } else if (result.item_id) {
              products = [
                {
                  itemId: result.item_id,
                  name: result.name,
                  imageUrl: result.image_url,
                  price: result.price,
                  stock: result.stock,
                },
              ];
            }
          } catch (e) {
            console.error('Failed to parse function result for products:', e);
          }
        }

        // Second completion with function results
        const secondCompletion = await modelRouter.chatWithFallback(
          {
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
              assistantMessage as any,
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: functionResult,
              } as any,
            ],
            temperature: 0.7,
            max_tokens: 500,
            stream: false,
          },
          model
        );

        assistantMessage = secondCompletion.choices[0].message;
      }
    }

    const responseContent = assistantMessage.content || 'عذراً، حصل خطأ';

    // Generate context-aware quick replies
    const quickReplies: Array<{ label: string; value: string }> = [];

    if (lastFunctionName === 'searchProducts' && products.length > 0) {
      quickReplies.push(
        { label: 'شنو مواصفاته؟', value: 'شنو مواصفات المنتج؟' },
        { label: 'في منتجات مشابهة؟', value: 'وريني منتجات مشابهة' },
        { label: 'شكد بالجملة؟', value: 'شكد سعره بالجملة؟' }
      );
    } else if (lastFunctionName === 'getProductDetails') {
      quickReplies.push(
        { label: 'في بديل؟', value: 'في منتج بديل؟' },
        { label: 'شنو يشترون معاه؟', value: 'شنو الزبائن يشترون معاه؟' },
        { label: 'متوفر؟', value: 'شكد المخزون متوفر؟' }
      );
    } else if (lastFunctionName === 'getCustomerOrders') {
      quickReplies.push(
        { label: 'آخر طلبية', value: 'وريني تفاصيل آخر طلبية' },
        { label: 'الطلبيات المعلقة', value: 'شنو الطلبيات المعلقة؟' },
        { label: 'طلب جديد', value: 'ابي أسوي طلبية جديدة' }
      );
    } else if (lastFunctionName === 'getCustomerInvoices') {
      quickReplies.push(
        { label: 'الفواتير المستحقة', value: 'وريني الفواتير المستحقة' },
        { label: 'سجل المدفوعات', value: 'ابي أشوف سجل المدفوعات' },
        { label: 'رصيدي الكلي', value: 'شكد رصيدي الكلي؟' }
      );
    } else if (
      lastFunctionName === 'getReorderSuggestions' ||
      lastFunctionName === 'getFrequentlyBoughtTogether'
    ) {
      quickReplies.push(
        { label: 'ضيفهم للسلة', value: 'ضيف هذه المنتجات للسلة' },
        { label: 'شنو الأسعار؟', value: 'شكد أسعار هذه المنتجات؟' },
        { label: 'متوفرين؟', value: 'كلهم متوفرين بالمخزون؟' }
      );
    } else if (products.length === 0 && !lastFunctionName) {
      // Default suggestions for new conversation
      quickReplies.push(
        { label: 'ابي محولات', value: 'ابي محول سريع' },
        { label: 'طلبياتي', value: 'وريني طلبياتي' },
        { label: 'رصيدي', value: 'شكد رصيدي؟' }
      );
    }

    // Save assistant message (metadata tracked separately in response)
    await saveMessage(sessionId, 'assistant', responseContent);

    return new Response(
      JSON.stringify({
        success: true,
        message: responseContent,
        sessionId,
        products: products.length > 0 ? products : undefined,
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
        metadata: {
          model,
          intent,
          tokens: inputTokens + outputTokens,
          cost: cost.toFixed(6),
        },
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
