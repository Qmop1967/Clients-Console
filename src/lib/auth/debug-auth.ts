import { NextRequest, NextResponse } from "next/server";

/**
 * Validates debug endpoint authentication
 * Debug endpoints require a secret parameter matching DEBUG_API_SECRET env var
 *
 * Usage:
 * ```ts
 * const authResult = validateDebugAuth(request);
 * if (authResult) return authResult; // Returns 401 if unauthorized
 * // Continue with debug logic...
 * ```
 */
export function validateDebugAuth(request: NextRequest): NextResponse | null {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Check if DEBUG_API_SECRET is configured
  const expectedSecret = process.env.DEBUG_API_SECRET;

  if (!expectedSecret) {
    // Debug endpoints disabled if no secret configured
    return NextResponse.json(
      {
        error: "Debug endpoints disabled",
        message: "DEBUG_API_SECRET environment variable not configured"
      },
      { status: 503 }
    );
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Invalid or missing secret parameter"
      },
      { status: 401 }
    );
  }

  // Authentication passed
  return null;
}

/**
 * Default debug secret for development
 * In production, set DEBUG_API_SECRET env var
 */
export const DEFAULT_DEBUG_SECRET = "tsh-debug-2024";
