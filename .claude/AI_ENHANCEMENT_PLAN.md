# TSH AI Assistant - Comprehensive Enhancement Plan

**Version:** 2.0
**Date:** 2026-01-23
**Status:** Implementation Ready

---

## 🎯 **Enhancement Goals**

1. **Upgrade to Latest AI Models** (GPT-4o, o1-preview, o1-mini)
2. **Business Intelligence** - Train AI on products, customers, orders
3. **Advanced Features** - Order tracking, recommendations, analytics
4. **Multi-language** - Enhanced Iraqi dialect + English
5. **Performance** - Caching, streaming, cost optimization

---

## 📊 **Current State Analysis**

### ✅ **What We Have:**
- OpenAI GPT-4o integration
- Iraqi dialect support
- Product search with vector embeddings
- Function calling (search, details, stock)
- Session management with Redis
- Basic conversation history

### ❌ **What's Missing:**
- Customer order history integration
- Personalized recommendations
- Business analytics (sales trends, popular products)
- Invoice/payment status checks
- Multi-turn context (cart management)
- Proactive suggestions
- Voice input/output
- Rich media responses (charts, tables)
- A/B testing and analytics
- Cost tracking and optimization

---

## 🚀 **Enhancement Roadmap**

### **Phase 1: Model Upgrade & Optimization** (Week 1)

#### 1.1 Multi-Model Strategy
```yaml
Purpose: Use best model for each task
Models:
  - gpt-4o: Main conversational AI (fast, accurate)
  - o1-preview: Complex reasoning (order analysis, recommendations)
  - gpt-4o-mini: Simple queries (stock check, quick answers) - Cost-effective
  - text-embedding-3-large: Product embeddings (better semantic search)

Implementation:
  - Model router based on query complexity
  - Automatic fallback on rate limits
  - Cost tracking per model
```

#### 1.2 Streaming Responses
```yaml
Purpose: Faster perceived response time
Benefits:
  - Users see responses as they're generated
  - Better UX for long responses
  - Reduced timeout issues

Implementation:
  - Server-Sent Events (SSE)
  - Token-by-token streaming
  - Progressive product card rendering
```

#### 1.3 Response Caching
```yaml
Purpose: Reduce costs and latency
Strategy:
  - Cache common queries (\"what's available\", \"show me chargers\")
  - Cache product descriptions (TTL: 24h)
  - Cache embeddings (permanent with versioning)

Storage: Upstash Redis
TTL: 1h for queries, 24h for products
```

---

### **Phase 2: Business Intelligence** (Week 2)

#### 2.1 Customer Context Integration
```typescript
// New Functions
interface CustomerContext {
  customerId: string;
  priceListId: string;
  priceListName: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string;
  preferredCategories: string[];
  creditLimit?: number;
  outstandingBalance?: number;
}

// AI Can Now:
- \"شكد رصيدي؟\" → Check outstanding balance
- \"شنو آخر طلبية حقي؟\" → Show last order details
- \"شكد صرفت هالشهر؟\" → Monthly spending analytics
- \"وريني المنتجات المفضلة حقي\" → Show frequently ordered items
```

#### 2.2 Order Management
```typescript
// New Functions
- getCustomerOrders(): Fetch order history
- getOrderStatus(orderId): Track specific order
- getInvoiceStatus(invoiceId): Check payment status
- getCreditNotes(): View returns/credits
- getPaymentHistory(): View payment transactions

// AI Can Now:
- \"وين طلبيتي؟\" → Track order status
- \"متى توصل؟\" → Delivery ETA
- \"شكد باقي عندي فلوس؟\" → Outstanding invoices
- \"ابي الفاتورة رقم 12345\" → Fetch invoice details
```

#### 2.3 Smart Recommendations
```typescript
// Recommendation Engine
interface RecommendationEngine {
  // Collaborative filtering
  frequentlyBoughtTogether(itemId: string): Product[];

  // Customer behavior
  reorderSuggestions(customerId: string): Product[];

  // Seasonal trends
  trendingProducts(category?: string): Product[];

  // Price-based
  alternativesInBudget(itemId: string, maxPrice: number): Product[];

  // Stock-based
  lowStockAlerts(customerId: string): Product[];
}

// AI Can Now:
- \"شنو الأكثر مبيعاً هالأسبوع؟\" → Trending products
- \"ابي بديل أرخص\" → Budget alternatives
- \"شنو الزبائن الثانيين اشتروا معاه؟\" → Frequently bought together
- \"ذكرني باللي أطلبها دايماً\" → Reorder suggestions
```

---

### **Phase 3: Advanced Features** (Week 3)

#### 3.1 Multi-Turn Context & Cart Management
```typescript
// Conversation Memory
interface ConversationContext {
  activeCart: {
    items: CartItem[];
    total: number;
    minimumQuantityIssues: string[];
  };
  lastSearchQuery: string;
  lastViewedProducts: Product[];
  intentHistory: string[];
  pendingActions: Action[];
}

// AI Can Now:
- \"ضيف ٥٠ محول\" → Add to cart
- \"بعد ضيف ٣٠ بطارية\" → Add more items
- \"شيل المحول\" → Remove item
- \"شكد المجموع؟\" → Show cart summary
- \"أكمل الطلبية\" → Proceed to checkout
```

#### 3.2 Business Analytics
```typescript
// Analytics Functions
- getSalesAnalytics(period: string): SalesReport
- getTopProducts(limit: number): Product[]
- getPriceComparison(itemId: string): PriceHistory
- getStockTrends(itemId: string): StockHistory
- getCustomerSegmentation(): CustomerStats

// AI Can Now:
- \"شكد بعت هالشهر؟\" → Monthly sales
- \"شنو أكثر منتج مبيع؟\" → Top selling products
- \"وريني تطور الأسعار\" → Price trends
- \"متى يوصل المخزون؟\" → Stock replenishment forecast
```

#### 3.3 Proactive Assistance
```typescript
// Proactive Triggers
- Low stock alerts for frequently ordered items
- Payment reminders (overdue invoices)
- Reorder suggestions based on purchase cycles
- Special offers/promotions
- Price drop notifications

// Example Flow:
User opens chat → AI: \"هلا خالي! لاحظت إنك تطلب محولات Type-C كل شهر.
المخزون قل واجد، تبي أحجز لك كمية؟\"
```

---

### **Phase 4: Enhanced UX** (Week 4)

#### 4.1 Rich Media Responses
```typescript
// Response Types
- Product Cards (images, prices, stock badges)
- Comparison Tables (side-by-side product comparison)
- Charts (sales trends, price history)
- Interactive Buttons (Add to cart, View details)
- Quick Actions (✓ Confirm order, ✗ Cancel)
```

#### 4.2 Voice Input/Output
```yaml
Input: OpenAI Whisper API
  - Iraqi dialect speech-to-text
  - Background noise filtering

Output: Text-to-Speech (Arabic)
  - Natural-sounding Iraqi accent
  - Adjustable speed

Use Cases:
  - Hands-free ordering (while driving/working)
  - Accessibility for non-literate users
```

#### 4.3 Multi-Language Toggle
```yaml
Modes:
  - Iraqi Dialect (default)
  - Formal Arabic (for reports/invoices)
  - English (for technical specs)

Auto-Detection: AI detects user language and switches
```

---

## 🏗️ **Technical Architecture**

### **New AI Service Layer**

```typescript
// src/lib/ai/ai-service.ts
export class AIService {
  // Model Management
  private modelRouter: ModelRouter;
  private costTracker: CostTracker;

  // Business Intelligence
  private customerAnalytics: CustomerAnalytics;
  private productRecommender: ProductRecommender;
  private orderManager: OrderManager;

  // Context Management
  private conversationManager: ConversationManager;
  private cacheManager: CacheManager;

  // Core Methods
  async chat(message: string, context: Context): Promise<AIResponse>
  async streamChat(message: string, context: Context): AsyncIterator<AIChunk>
  async analyzeIntent(message: string): Promise<Intent>
  async generateRecommendations(customerId: string): Promise<Product[]>
}
```

### **Database Schema Updates**

```sql
-- AI Sessions (existing, enhanced)
CREATE TABLE ai_sessions (
  session_id UUID PRIMARY KEY,
  user_id TEXT,
  customer_id TEXT, -- NEW: Link to Zoho customer
  metadata JSONB,
  created_at TIMESTAMP,
  last_activity TIMESTAMP,
  total_tokens INTEGER DEFAULT 0, -- NEW: Track usage
  total_cost DECIMAL(10,4) DEFAULT 0 -- NEW: Track cost
);

-- AI Conversations (enhanced)
CREATE TABLE ai_conversations (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions,
  role TEXT,
  content TEXT,
  function_calls JSONB, -- NEW: Track function usage
  tokens INTEGER, -- NEW: Per-message tokens
  model TEXT, -- NEW: Which model was used
  timestamp TIMESTAMP
);

-- Product Embeddings
CREATE TABLE product_embeddings (
  item_id TEXT PRIMARY KEY,
  embedding VECTOR(3072), -- text-embedding-3-large
  metadata JSONB,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMP
);

-- AI Analytics
CREATE TABLE ai_analytics (
  id SERIAL PRIMARY KEY,
  date DATE,
  total_queries INTEGER,
  total_tokens INTEGER,
  total_cost DECIMAL(10,4),
  avg_response_time DECIMAL(6,2),
  success_rate DECIMAL(5,2),
  top_intents JSONB
);
```

---

## 💰 **Cost Optimization Strategy**

### **Model Usage Matrix**

| Use Case | Model | Cost/1M Tokens | When to Use |
|----------|-------|----------------|-------------|
| Simple queries | gpt-4o-mini | $0.15 | Stock check, yes/no questions |
| Conversations | gpt-4o | $2.50 | Main chat, product search |
| Complex reasoning | o1-preview | $15.00 | Order analysis, recommendations |
| Embeddings | text-embedding-3-large | $0.13 | Product search (one-time) |

### **Cost Controls**

```typescript
// src/lib/ai/cost-manager.ts
export class CostManager {
  // Daily limits
  MAX_TOKENS_PER_DAY = 500_000;
  MAX_COST_PER_DAY = 50.00; // $50/day

  // Per-user limits
  MAX_TOKENS_PER_USER_PER_DAY = 10_000;

  // Warnings
  async checkLimits(userId: string): Promise<LimitStatus>;
  async trackUsage(tokens: number, model: string): Promise<void>;
  async generateCostReport(period: string): Promise<CostReport>;
}
```

### **Caching Strategy**

```yaml
L1 - Memory Cache (Node.js):
  - Active sessions (5 min)
  - Model responses (1 min)

L2 - Redis Cache (Upstash):
  - Common queries (1 hour)
  - Product descriptions (24 hours)
  - Embeddings (permanent)

L3 - Database:
  - Conversation history (30 days)
  - Analytics (permanent)
```

---

## 📈 **Success Metrics**

### **User Experience**
- ✅ Average response time < 2 seconds
- ✅ User satisfaction > 85%
- ✅ Conversion rate (search → add to cart) > 30%
- ✅ Repeat usage rate > 60%

### **Business Impact**
- ✅ +20% in order completion via AI
- ✅ +15% average order value (recommendations)
- ✅ -30% support inquiries (self-service)
- ✅ +40% user engagement time

### **Technical Performance**
- ✅ 99.9% uptime
- ✅ < $2 per 1000 conversations
- ✅ 95% cache hit rate
- ✅ < 500ms P95 latency

---

## 🔐 **Security & Privacy**

### **Data Protection**
```yaml
Customer Data:
  - Encrypt PII at rest (AES-256)
  - Mask sensitive data in logs
  - GDPR compliance (data deletion on request)

AI Interactions:
  - No training on customer data (OpenAI zero-retention)
  - Conversations expire after 30 days
  - Anonymous analytics only
```

### **Rate Limiting**
```yaml
Public Users: 10 queries/hour
Authenticated Users: 100 queries/hour
Premium Customers: 500 queries/hour
```

---

## 📋 **Implementation Checklist**

### **Phase 1: Foundation**
- [ ] Upgrade to gpt-4o (latest version)
- [ ] Add o1-preview for complex reasoning
- [ ] Implement model router
- [ ] Add streaming responses
- [ ] Set up response caching
- [ ] Implement cost tracking

### **Phase 2: Business Intelligence**
- [ ] Customer context integration
- [ ] Order history functions
- [ ] Invoice/payment status
- [ ] Smart recommendations engine
- [ ] Proactive alerts

### **Phase 3: Advanced Features**
- [ ] Multi-turn context (cart management)
- [ ] Business analytics dashboard
- [ ] Comparison tables
- [ ] Interactive buttons
- [ ] Bulk actions

### **Phase 4: Polish**
- [ ] Voice input/output
- [ ] Rich media responses
- [ ] A/B testing framework
- [ ] Analytics dashboard
- [ ] Admin panel for AI settings

---

## 🎓 **AI Training Strategy**

### **Product Knowledge Base**

```typescript
// Generate comprehensive product embeddings
interface ProductKnowledge {
  // Core attributes
  technical_specs: string; // "USB Type-C, 20W, PD 3.0"
  use_cases: string[]; // ["iPhone 12+", "Samsung Galaxy S21+"]
  compatibility: string; // "Works with all USB-C devices"

  // Business context
  popular_with: string[]; // ["Retail shops", "Phone repair shops"]
  frequently_bought_with: string[]; // [item_id1, item_id2]
  seasonal_trend: string; // "Peak in summer"
  price_tier: string; // "budget", "mid-range", "premium"

  // Customer language
  common_names: string[]; // ["محول سريع", "شاحن تايب سي", "Type-C charger"]
  search_keywords: string[]; // Tags for better matching
}

// Training Process:
1. Extract from Zoho product descriptions
2. Enrich with order history patterns
3. Add Iraqi dialect synonyms
4. Generate embeddings with text-embedding-3-large
5. Store in vector database (Upstash Vector)
```

### **Customer Behavior Training**

```typescript
// Analyze customer patterns
interface CustomerInsights {
  purchase_frequency: number; // Orders per month
  avg_order_size: number; // Items per order
  preferred_brands: string[];
  price_sensitivity: "low" | "medium" | "high";
  reorder_cycle: number; // Days between similar orders
  peak_order_times: string[]; // ["Monday morning", "Thursday afternoon"]
  cart_abandonment_reasons: string[];
}

// Use for:
- Personalized product suggestions
- Optimal timing for proactive messages
- Pricing strategy (discounts for price-sensitive customers)
- Inventory planning (predict demand)
```

---

## 🛠️ **Development Timeline**

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Model Upgrade | Multi-model support, streaming, caching |
| 2 | Business Intelligence | Customer context, order management, recommendations |
| 3 | Advanced Features | Cart management, analytics, proactive alerts |
| 4 | Polish & Testing | Voice I/O, rich media, A/B testing, docs |

**Total:** 4 weeks to full production

---

## 📞 **Next Steps**

1. **Review & Approve** this plan
2. **Set up environment** (API keys, vector DB)
3. **Start Phase 1** implementation
4. **Iterative deployment** (staging → production)
5. **Monitor & optimize** based on metrics

---

**Questions? Feedback? Let's discuss!** 🚀
