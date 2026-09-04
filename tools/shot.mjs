/** Headless capture: loads the app, optionally picks a clip, waits, screenshots. */
import puppeteer from "puppeteer";

const url = process.env.URL ?? "http://localhost:5199/";
const jobs = JSON.parse(process.argv[2] ?? '[{"name":"idle","wait":1200}]');

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
    "--no-sandbox",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") problems.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(process.env.READY ?? ".clips button", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 2500)); // let the first frames and the probe settle

for (const job of jobs) {
  if (job.label) {
    await page.evaluate((label) => {
      const btn = [...document.querySelectorAll(".clips button")].find((b) => b.textContent === label);
      btn?.click();
    }, job.label);
  }
  if (job.slider) {
    await page.evaluate(({ id, value }) => {
      const el = document.querySelector(`#${id}`);
      el.value = String(value);
      el.dispatchEvent(new Event("input"));
    }, job.slider);
  }
  await new Promise((r) => setTimeout(r, job.wait ?? 1200));
  await page.screenshot({ path: `shots/${job.name}.png` });
  console.log("captured", job.name);
}

const stats = await page.evaluate(() => document.querySelector("#stats")?.textContent ?? "");
console.log("STATS:", stats);
console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "PROBLEMS: none");

await browser.close();
