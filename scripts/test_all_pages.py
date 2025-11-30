#!/usr/bin/env python3
"""
TSH Clients Console - Comprehensive Page Testing with Playwright
Tests all public pages in English and Arabic, including dark mode
"""

import os
import time
from playwright.sync_api import sync_playwright, Page

# Test configuration
BASE_URL = "https://www.tsh.sale"
SCREENSHOT_DIR = "/tmp/tsh-screenshots"

# Pages to test
PAGES = [
    {"path": "/en/shop", "name": "shop_en", "description": "Shop Page (English)"},
    {"path": "/ar/shop", "name": "shop_ar", "description": "Shop Page (Arabic/RTL)"},
    {"path": "/en/login", "name": "login_en", "description": "Login Page (English)"},
    {"path": "/ar/login", "name": "login_ar", "description": "Login Page (Arabic/RTL)"},
    {"path": "/en/dashboard", "name": "dashboard_en", "description": "Dashboard (English) - requires auth"},
    {"path": "/en/orders", "name": "orders_en", "description": "Orders (English) - requires auth"},
    {"path": "/en/invoices", "name": "invoices_en", "description": "Invoices (English) - requires auth"},
]

def ensure_screenshot_dir():
    """Create screenshot directory if it doesn't exist"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"📁 Screenshots will be saved to: {SCREENSHOT_DIR}")

def capture_console_errors(page: Page) -> list:
    """Capture console errors"""
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    return errors

def test_page(page: Page, path: str, name: str, description: str, dark_mode: bool = False) -> dict:
    """Test a single page and capture screenshot"""
    result = {
        "name": name,
        "description": description,
        "path": path,
        "dark_mode": dark_mode,
        "success": False,
        "load_time": 0,
        "errors": [],
        "screenshot": None,
    }

    try:
        url = f"{BASE_URL}{path}"
        print(f"\n{'='*60}")
        print(f"🧪 Testing: {description}")
        print(f"   URL: {url}")
        print(f"   Dark Mode: {'Yes' if dark_mode else 'No'}")

        # Navigate to page
        start_time = time.time()
        response = page.goto(url, wait_until="networkidle", timeout=30000)
        load_time = time.time() - start_time
        result["load_time"] = round(load_time, 2)

        # Check response status
        if response:
            print(f"   Status: {response.status}")
            if response.status >= 400:
                result["errors"].append(f"HTTP {response.status}")

        # Wait for content to render
        page.wait_for_timeout(1000)

        # Toggle dark mode if requested
        if dark_mode:
            # Try to find and click dark mode toggle
            try:
                # Common patterns for theme toggles
                toggle_selectors = [
                    'button[aria-label*="theme"]',
                    'button[aria-label*="dark"]',
                    '[data-theme-toggle]',
                    'button:has(svg.lucide-moon)',
                    'button:has(svg.lucide-sun)',
                ]
                for selector in toggle_selectors:
                    if page.locator(selector).count() > 0:
                        page.locator(selector).first.click()
                        page.wait_for_timeout(500)
                        print("   ✓ Dark mode toggled")
                        break
            except Exception as e:
                print(f"   ⚠ Could not toggle dark mode: {e}")

        # Take screenshot
        suffix = "_dark" if dark_mode else ""
        screenshot_path = f"{SCREENSHOT_DIR}/{name}{suffix}.png"
        page.screenshot(path=screenshot_path, full_page=True)
        result["screenshot"] = screenshot_path
        print(f"   📸 Screenshot: {screenshot_path}")

        # Check for visible content
        body_text = page.locator("body").inner_text()
        if len(body_text) < 50:
            result["errors"].append("Page appears empty or has minimal content")

        # Check RTL for Arabic pages
        if "/ar/" in path:
            html_dir = page.locator("html").get_attribute("dir")
            if html_dir != "rtl":
                result["errors"].append(f"RTL not set correctly (dir={html_dir})")
            else:
                print("   ✓ RTL layout confirmed")

        result["success"] = len(result["errors"]) == 0
        print(f"   ⏱ Load time: {result['load_time']}s")
        print(f"   {'✅ PASSED' if result['success'] else '❌ FAILED'}")

    except Exception as e:
        result["errors"].append(str(e))
        print(f"   ❌ Error: {e}")

    return result

def test_shop_functionality(page: Page) -> dict:
    """Test shop page specific functionality"""
    result = {
        "name": "shop_functionality",
        "description": "Shop Page Functionality",
        "tests": [],
    }

    print(f"\n{'='*60}")
    print("🛒 Testing Shop Page Functionality")

    try:
        page.goto(f"{BASE_URL}/en/shop", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)

        # Test 1: Check if products are loaded
        products = page.locator('[class*="card"]').all()
        product_count = len(products)
        test_passed = product_count > 0
        result["tests"].append({
            "name": "Products Loaded",
            "passed": test_passed,
            "details": f"Found {product_count} product cards"
        })
        print(f"   {'✓' if test_passed else '✗'} Products Loaded: {product_count} products")

        # Test 2: Check search input exists
        search_input = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]')
        test_passed = search_input.count() > 0
        result["tests"].append({
            "name": "Search Input",
            "passed": test_passed,
            "details": "Search input found" if test_passed else "Search input not found"
        })
        print(f"   {'✓' if test_passed else '✗'} Search Input: {'Found' if test_passed else 'Not found'}")

        # Test 3: Check category filters
        category_buttons = page.locator('button:has-text("All"), button:has-text("الكل")').all()
        test_passed = len(category_buttons) > 0
        result["tests"].append({
            "name": "Category Filters",
            "passed": test_passed,
            "details": f"Found {len(category_buttons)} category buttons"
        })
        print(f"   {'✓' if test_passed else '✗'} Category Filters: {len(category_buttons)} buttons")

        # Test 4: Check hero section
        hero = page.locator('.gradient-hero, [class*="hero"]')
        test_passed = hero.count() > 0
        result["tests"].append({
            "name": "Hero Section",
            "passed": test_passed,
            "details": "Hero section found" if test_passed else "Hero section not found"
        })
        print(f"   {'✓' if test_passed else '✗'} Hero Section: {'Found' if test_passed else 'Not found'}")

        # Test 5: Check price display
        prices = page.locator('[class*="price"], :text("IQD"), :text("د.ع")')
        test_passed = prices.count() > 0
        result["tests"].append({
            "name": "Prices Displayed",
            "passed": test_passed,
            "details": f"Found {prices.count()} price elements"
        })
        print(f"   {'✓' if test_passed else '✗'} Prices Displayed: {prices.count()} elements")

        # Test 6: Check stock badges
        stock_badges = page.locator('[class*="badge"]:has-text("Stock"), [class*="badge"]:has-text("متوفر")')
        test_passed = stock_badges.count() > 0
        result["tests"].append({
            "name": "Stock Badges",
            "passed": test_passed,
            "details": f"Found {stock_badges.count()} stock badges"
        })
        print(f"   {'✓' if test_passed else '✗'} Stock Badges: {stock_badges.count()} badges")

    except Exception as e:
        result["tests"].append({
            "name": "Shop Functionality",
            "passed": False,
            "details": str(e)
        })
        print(f"   ❌ Error: {e}")

    return result

def test_responsive_design(page: Page) -> dict:
    """Test responsive design at different viewport sizes"""
    result = {
        "name": "responsive_design",
        "description": "Responsive Design",
        "tests": [],
    }

    print(f"\n{'='*60}")
    print("📱 Testing Responsive Design")

    viewports = [
        {"width": 375, "height": 812, "name": "mobile", "device": "iPhone X"},
        {"width": 768, "height": 1024, "name": "tablet", "device": "iPad"},
        {"width": 1920, "height": 1080, "name": "desktop", "device": "Desktop"},
    ]

    try:
        for viewport in viewports:
            page.set_viewport_size({"width": viewport["width"], "height": viewport["height"]})
            page.goto(f"{BASE_URL}/en/shop", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1000)

            # Take screenshot
            screenshot_path = f"{SCREENSHOT_DIR}/responsive_{viewport['name']}.png"
            page.screenshot(path=screenshot_path, full_page=False)

            # Check if content is visible
            body = page.locator("body")
            is_visible = body.is_visible()

            result["tests"].append({
                "name": f"{viewport['device']} ({viewport['width']}x{viewport['height']})",
                "passed": is_visible,
                "screenshot": screenshot_path
            })
            print(f"   {'✓' if is_visible else '✗'} {viewport['device']}: {viewport['width']}x{viewport['height']} - Screenshot saved")

    except Exception as e:
        result["tests"].append({
            "name": "Responsive Design",
            "passed": False,
            "details": str(e)
        })
        print(f"   ❌ Error: {e}")

    # Reset viewport
    page.set_viewport_size({"width": 1280, "height": 720})

    return result

def test_product_detail_page(page: Page) -> dict:
    """Test product detail page"""
    result = {
        "name": "product_detail",
        "description": "Product Detail Page",
        "tests": [],
    }

    print(f"\n{'='*60}")
    print("📦 Testing Product Detail Page")

    try:
        # First go to shop page to get a product link
        page.goto(f"{BASE_URL}/en/shop", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)

        # Find first product link
        product_links = page.locator('a[href*="/shop/"]').all()
        if len(product_links) > 0:
            # Click the first product
            first_product = product_links[0]
            href = first_product.get_attribute("href")
            print(f"   Navigating to product: {href}")

            page.goto(f"{BASE_URL}{href}" if href.startswith("/") else href, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1000)

            # Take screenshot
            screenshot_path = f"{SCREENSHOT_DIR}/product_detail.png"
            page.screenshot(path=screenshot_path, full_page=True)

            # Check for product elements
            checks = [
                ("Product Image", 'img[alt], [class*="image"]'),
                ("Product Name", 'h1, h2'),
                ("Price", '[class*="price"], :text("IQD")'),
                ("Add to Cart", 'button:has-text("Add"), button:has-text("أضف")'),
            ]

            for check_name, selector in checks:
                element = page.locator(selector)
                passed = element.count() > 0
                result["tests"].append({
                    "name": check_name,
                    "passed": passed,
                })
                print(f"   {'✓' if passed else '✗'} {check_name}")
        else:
            result["tests"].append({
                "name": "Product Links",
                "passed": False,
                "details": "No product links found"
            })
            print("   ✗ No product links found")

    except Exception as e:
        result["tests"].append({
            "name": "Product Detail",
            "passed": False,
            "details": str(e)
        })
        print(f"   ❌ Error: {e}")

    return result

def print_summary(results: list):
    """Print test summary"""
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")

    total_passed = 0
    total_failed = 0

    for result in results:
        if "tests" in result:
            # Functionality test results
            for test in result["tests"]:
                if test.get("passed"):
                    total_passed += 1
                else:
                    total_failed += 1
        else:
            # Page test results
            if result.get("success"):
                total_passed += 1
            else:
                total_failed += 1

    print(f"\n✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"📊 Total:  {total_passed + total_failed}")

    if total_failed == 0:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")

    print(f"\n📁 Screenshots saved to: {SCREENSHOT_DIR}")

def main():
    """Main test runner"""
    print("🚀 TSH Clients Console - Playwright Test Suite")
    print(f"   Testing: {BASE_URL}")
    print(f"   Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    ensure_screenshot_dir()
    results = []

    with sync_playwright() as p:
        # Launch browser in headless mode
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            locale="en-US",
        )
        page = context.new_page()

        # Test all pages
        for page_config in PAGES:
            result = test_page(
                page,
                page_config["path"],
                page_config["name"],
                page_config["description"]
            )
            results.append(result)

        # Test dark mode on shop page
        result = test_page(
            page,
            "/en/shop",
            "shop_en_dark",
            "Shop Page (English) - Dark Mode",
            dark_mode=True
        )
        results.append(result)

        # Test shop functionality
        result = test_shop_functionality(page)
        results.append(result)

        # Test responsive design
        result = test_responsive_design(page)
        results.append(result)

        # Test product detail page
        result = test_product_detail_page(page)
        results.append(result)

        browser.close()

    # Print summary
    print_summary(results)

    return results

if __name__ == "__main__":
    main()
