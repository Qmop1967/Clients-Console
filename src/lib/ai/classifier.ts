// ============================================
// AI Product Classifier - Claude Vision
// ============================================
// Uses Claude Vision API to classify products
// based on name, description, and image
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import {
  AIClassification,
  CATEGORY_HIERARCHY,
  FLAT_CATEGORIES,
  findCategoryByName,
} from './categories';
import {
  getCachedClassification,
  setCachedClassification,
} from './category-cache';

// Initialize Anthropic client
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

// Classification prompt template
const CLASSIFICATION_PROMPT = `You are a product classification AI for an IT/Electronics wholesale company called TSH.

Your task is to classify products into the most appropriate category from this hierarchy:

${CATEGORY_HIERARCHY.map(
  (cat) =>
    `${cat.icon} ${cat.name}
${cat.children?.map((c) => `   - ${c.name}`).join('\n') || ''}`
).join('\n\n')}

RULES:
1. Choose the MOST SPECIFIC sub-category that fits
2. If unsure, use a broader category rather than guessing wrong
3. Base classification on product NAME and IMAGE (if available)
4. Extract relevant tags (brand, technology, specs)
5. Confidence: 90-100 = perfect match, 70-89 = likely, 50-69 = uncertain

Return ONLY valid JSON (no markdown, no explanation):
{
  "primary_category": "exact category name from hierarchy",
  "sub_category": "exact sub-category name from hierarchy",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 85,
  "reasoning": "brief explanation"
}`;

// Classify a single product
export async function classifyProduct(
  itemId: string,
  name: string,
  description?: string,
  imageUrl?: string,
  zohoCategory?: { id?: string; name?: string }
): Promise<AIClassification> {
  // Check cache first
  const cached = await getCachedClassification(itemId);
  if (cached) {
    console.log(`[AI Classifier] Cache hit for ${itemId}`);
    return cached;
  }

  const anthropic = getAnthropicClient();

  // Build message content
  const textContent = `Product Name: "${name}"
${description ? `Description: "${description}"` : ''}
${zohoCategory?.name ? `Current Zoho Category: "${zohoCategory.name}"` : ''}

Classify this product.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [{ type: 'text', text: CLASSIFICATION_PROMPT }];

  // Add image if available
  if (imageUrl) {
    try {
      // Fetch image and convert to base64
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const mediaType = contentType.split(';')[0] as
          | 'image/jpeg'
          | 'image/png'
          | 'image/gif'
          | 'image/webp';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64,
          },
        });
      }
    } catch (error) {
      console.warn(`[AI Classifier] Could not fetch image for ${itemId}:`, error);
    }
  }

  content.push({ type: 'text', text: textContent });

  try {
    console.log(`[AI Classifier] Classifying ${itemId}: "${name}"`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    });

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]) as {
      primary_category: string;
      sub_category: string;
      tags: string[];
      confidence: number;
      reasoning?: string;
    };

    // Validate categories exist in hierarchy
    const validatedPrimary = findCategoryByName(result.primary_category);
    const validatedSub = findCategoryByName(result.sub_category);

    const classification: AIClassification = {
      item_id: itemId,
      primary_category: validatedPrimary.primary?.name || result.primary_category,
      sub_category: validatedSub.sub?.name || validatedSub.primary?.name || result.sub_category,
      tags: result.tags?.slice(0, 5) || [],
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reasoning: result.reasoning,
      model: 'claude-sonnet-4-20250514',
      classified_at: new Date().toISOString(),
      zoho_category_id: zohoCategory?.id,
      zoho_category_name: zohoCategory?.name,
    };

    // Cache the result
    await setCachedClassification(classification);

    console.log(
      `[AI Classifier] Classified ${itemId} as "${classification.primary_category} > ${classification.sub_category}" (${classification.confidence}%)`
    );

    return classification;
  } catch (error) {
    console.error(`[AI Classifier] Error classifying ${itemId}:`, error);

    // Fallback to Zoho category if available
    if (zohoCategory?.name) {
      const fallback = createFallbackClassification(itemId, name, zohoCategory);
      await setCachedClassification(fallback);
      return fallback;
    }

    // Ultimate fallback
    return createFallbackClassification(itemId, name);
  }
}

// Create fallback classification using Zoho category or "Accessories > Miscellaneous"
function createFallbackClassification(
  itemId: string,
  name: string,
  zohoCategory?: { id?: string; name?: string }
): AIClassification {
  // Try to map Zoho category to our hierarchy
  let primary = 'Accessories';
  let sub = 'Miscellaneous';

  if (zohoCategory?.name) {
    const found = findCategoryByName(zohoCategory.name);
    if (found.primary) {
      primary = found.primary.name;
      sub = found.sub?.name || primary;
    }
  }

  // Extract tags from product name
  const nameLower = name.toLowerCase();
  const tags: string[] = [];

  // Common brand/tech keywords
  const keywords = [
    'ubiquiti',
    'mikrotik',
    'tp-link',
    'cisco',
    'hikvision',
    'dahua',
    'samsung',
    'lg',
    'apc',
    'asus',
    'dell',
    'hp',
    'lenovo',
    'wifi',
    'usb',
    'hdmi',
    'poe',
    'cat6',
    'cat5',
    'ssd',
    'hdd',
    'ram',
  ];

  for (const kw of keywords) {
    if (nameLower.includes(kw) && tags.length < 5) {
      tags.push(kw.toUpperCase());
    }
  }

  return {
    item_id: itemId,
    primary_category: primary,
    sub_category: sub,
    tags,
    confidence: zohoCategory?.name ? 40 : 20,
    reasoning: zohoCategory?.name
      ? `Fallback using Zoho category: ${zohoCategory.name}`
      : 'Fallback classification (AI unavailable)',
    model: 'fallback',
    classified_at: new Date().toISOString(),
    zoho_category_id: zohoCategory?.id,
    zoho_category_name: zohoCategory?.name,
  };
}

// Batch classify multiple products
export async function classifyProducts(
  products: Array<{
    item_id: string;
    name: string;
    description?: string;
    image_url?: string;
    category_id?: string;
    category_name?: string;
  }>,
  options?: {
    batchSize?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<AIClassification[]> {
  const { batchSize = 5, delayMs = 1000, onProgress } = options || {};
  const results: AIClassification[] = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((p) =>
        classifyProduct(
          p.item_id,
          p.name,
          p.description,
          p.image_url,
          { id: p.category_id, name: p.category_name }
        )
      )
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, products.length), products.length);
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// Get list of all available categories for display
export function getAvailableCategories(): typeof FLAT_CATEGORIES {
  return FLAT_CATEGORIES;
}

// Check if classifier is configured
export function isClassifierConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
