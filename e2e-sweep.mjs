// Real-world sweep of app.thedanceexclusive.co.uk: anonymous parent journeys
// + Amie-style admin journeys via the developer login. Read-only — no
// payments, no data mutations beyond signing in.
import { chromium } from "playwright";

const BASE = "https://app.thedanceexclusive.co.uk";
const DEV_EMAIL = "louis@nullshift.co.uk";
const DEV_PASSWORD = process.env.DEV_PASSWORD;

const findings = [];
const note = (page, severity, msg) => findings.push({ page, severity, msg });

async function collectPageHealth(page, label, { ignoreConsole = [] } = {}) {
  const consoleErrors = [];
  const failedRequests = [];
  const onConsole = (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  };
  const onResponse = (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) {
      failedRequests.push(`${r.status()} ${r.url().slice(0, 160)}`);
    }
  };
  page.on("console", onConsole);
  page.on("response", onResponse);
  return {
    finish: async () => {
      page.off("console", onConsole);
      page.off("response", onResponse);
      for (const e of consoleErrors) {
        if (ignoreConsole.some((p) => e.includes(p))) continue;
        note(label, "console", e);
      }
      for (const f of failedRequests) note(label, "network", f);
      // broken images (guarded — SPA may have navigated mid-check)
      try {
        const broken = await page.evaluate(() =>
          [...document.querySelectorAll("img")]
            .filter((i) => i.src && !i.src.startsWith("data:") && i.complete && i.naturalWidth === 0)
            .map((i) => i.src.slice(0, 160)),
        );
        for (const b of broken) note(label, "broken-image", b);
      } catch { /* navigation raced the check */ }
    },
  };
}


async function robustGoto(page, url, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500); // let the SPA hydrate + fetch
      return true;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(4000 * attempt);
    }
  }
  note(label, "fatal", `navigation failed after 3 attempts: ${String(lastErr).slice(0, 160)}`);
  return false;
}

async function visit(page, path, label, waitFor = null, opts = {}) {
  const health = await collectPageHealth(page, label, opts);
  try {
    const ok = await robustGoto(page, `${BASE}${path}`, label);
    if (!ok) { await health.finish(); return; }
    if (waitFor) {
      const ok = await page.locator(waitFor).first().isVisible({ timeout: 15000 }).catch(() => false);
      if (!ok) note(label, "missing", `expected element not visible: ${waitFor}`);
    }
  } catch (e) {
    note(label, "fatal", `navigation failed: ${String(e).slice(0, 200)}`);
  }
  await health.finish();
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  process.on("exit", () => {
    // last-resort dump so a crash never loses collected findings
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone-ish, Amie is mobile-first
  const page = await ctx.newPage();

  // ── Anonymous parent journeys ──────────────────────────────────────────
  await visit(page, "/", "landing", "text=Stand Out");
  // Live stats should have replaced fallbacks
  const statsText = await page.textContent("body").catch(() => "");
  if (!/Essex Venues/i.test(statsText ?? "")) note("landing", "missing", "stats band not found");

  await visit(page, "/classes/children", "classes-children", "text=Book Now");
  const cards = await page.locator("text=More Info").count();
  if (cards === 0) note("classes-children", "missing", "no class cards rendered");
  const termStrip = await page.locator("text=Term Dates").first().isVisible().catch(() => false);
  if (!termStrip) note("classes-children", "missing", "term-dates strip not visible");

  // Book Now while signed out must route to /auth
  try {
    await page.locator("button:has-text('Book Now')").first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    if (!page.url().includes("/auth")) note("classes-children", "flow", `anon Book Now did not route to /auth (at ${page.url()})`);
  } catch (e) {
    note("classes-children", "flow", `could not click Book Now: ${String(e).slice(0, 120)}`);
  }

  await visit(page, "/classes/adult", "classes-adult", "text=Adults");
  await visit(page, "/about", "about", "text=Our");
  await visit(page, "/team", "team", "text=Crew");
  const crewCount = await page.locator("article").count();
  if (crewCount < 5) note("team", "missing", `expected ~10 crew cards, found ${crewCount}`);
  await visit(page, "/venues", "venues", "text=Venues");
  await visit(page, "/shop", "shop", "text=Bag", { ignoreConsole: [] });
  const shopImgs = await page.locator("img").count();
  if (shopImgs === 0) note("shop", "missing", "no product images at all");
  await visit(page, "/contact", "contact", "text=Essex Venues");
  await visit(page, "/parent-info", "parent-info");
  await visit(page, "/auth", "auth", "input[type=email]");

  // ── Amie-style admin journeys via the dev login ────────────────────────
  const health = await collectPageHealth(page, "login");
  await robustGoto(page, `${BASE}/auth`, "login");
  await page.fill("input[type=email]", DEV_EMAIL);
  await page.fill("input[type=password]", DEV_PASSWORD);
  await page.locator("button[type=submit], button:has-text('Sign In')").first().click();
  try {
    await page.waitForURL("**/admin**", { timeout: 20000 });
  } catch {
    note("login", "fatal", `dev admin login did not reach /admin (at ${page.url()})`);
  }
  await health.finish();

  if (page.url().includes("/admin")) {
    await visit(page, "/admin", "admin-dashboard");
    await visit(page, "/admin/bookings", "admin-bookings", "text=Memberships & Plans");
    // Open the memberships tab and check the family grouping
    try {
      await page.locator("text=Memberships & Plans").first().click();
      await page.waitForTimeout(2500);
      const family = await page.locator("text=/£\\d+\\.\\d{2}\\/mo/").first().isVisible().catch(() => false);
      if (!family) note("admin-bookings", "missing", "family £/mo headline not visible in Memberships & Plans");
      const natalie = await page.locator("text=Natalie George").first().isVisible().catch(() => false);
      if (!natalie) note("admin-bookings", "missing", "expected family card (Natalie George) not visible");
    } catch (e) {
      note("admin-bookings", "flow", `memberships tab interaction failed: ${String(e).slice(0, 150)}`);
    }
    await visit(page, "/admin/registers", "admin-registers", "text=Pick a date");
    await visit(page, "/admin/classes", "admin-classes", "text=Add");
    await visit(page, "/admin/staff", "admin-staff", "text=Invite");
    await visit(page, "/admin/customers", "admin-customers");
    await visit(page, "/admin/settings/company", "admin-settings-company", "text=Public Website Stats");
    await visit(page, "/admin/merchandise", "admin-merch");
  }

  await browser.close();

  console.log(JSON.stringify({ findings, total: findings.length }, null, 1));
};

run().catch((e) => {
  console.error("SWEEP CRASHED:", String(e).slice(0, 300));
  console.log(JSON.stringify({ findings, total: findings.length, crashed: true }, null, 1));
  process.exit(1);
});
