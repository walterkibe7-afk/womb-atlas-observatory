# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\debug8.spec.ts >> admin login - exact copy of debug7
- Location: tests\debug8.spec.ts:8:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e6]:
      - img "Womb Atlas" [ref=e8]
      - generic [ref=e9]:
        - heading "Womb Atlas" [level=1] [ref=e10]
        - paragraph [ref=e11]: Secure Observatory MVP
      - generic [ref=e12]:
        - generic [ref=e17]:
          - paragraph [ref=e18]: Secure & Encrypted
          - paragraph [ref=e19]: Your health data is stored securely. Womb Atlas acts as a neutral observatory, never sharing data without consent.
        - generic [ref=e20]:
          - button "Continue with Google" [ref=e21]
          - generic [ref=e28]: OR
          - generic [ref=e32]:
            - textbox "Email address" [active] [ref=e33]
            - textbox "Password" [ref=e34]
            - button "Log In" [ref=e35]
          - paragraph [ref=e36]:
            - text: Don't have an account?
            - button "Sign up" [ref=e37]
    - paragraph [ref=e38]: Womb Atlas Observatory MVP • Pre-release Candidate
  - button "Open Next.js Dev Tools" [ref=e44] [cursor=pointer]
  - alert [ref=e48]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.use({
  4  |   channel: 'chrome',
  5  |   executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  6  | });
  7  | 
  8  | test('admin login - exact copy of debug7', async ({ page }) => {
  9  |   await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  10 |   await page.waitForTimeout(2000);
  11 |   
  12 |   // Click "Log In" to reveal the inline form
  13 |   await page.click('text=Log In');
  14 |   await page.waitForTimeout(1000);
  15 |   
  16 |   // Check for form elements
  17 |   const emailInput = page.locator('input[name="email"], input[type="email"]');
  18 |   console.log('Email input visible:', await emailInput.isVisible().catch(() => false));
  19 |   console.log('Email input count:', await emailInput.count());
  20 |   
  21 |   const passwordInput = page.locator('input[name="password"], input[type="password"]');
  22 |   console.log('Password input visible:', await passwordInput.isVisible().catch(() => false));
  23 |   console.log('Password input count:', await passwordInput.count());
  24 |   
  25 |   // Now try to fill
> 26 |   await page.fill('input[name="email"]', 'admin@system.com');
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  27 |   console.log('Filled email');
  28 |   await page.fill('input[name="password"]', 'password');
  29 |   console.log('Filled password');
  30 |   await page.click('button[type="submit"]:has-text("Log In")');
  31 |   console.log('Clicked submit');
  32 |   
  33 |   // Wait for redirect to admin dashboard
  34 |   await page.waitForURL('**/admin/**');
  35 |   
  36 |   // Verify admin access
  37 |   const url = page.url();
  38 |   console.log('Admin redirect URL:', url);
  39 |   expect(url).toContain('/admin');
  40 |   
  41 |   // Check for admin sidebar/navigation
  42 |   await expect(page.locator('text=Admin')).toBeVisible();
  43 |   
  44 |   // Logout
  45 |   await page.click('text=Sign out');
  46 |   await page.waitForURL('http://localhost:3000/');
  47 |   console.log('Admin logout successful');
  48 | });
```