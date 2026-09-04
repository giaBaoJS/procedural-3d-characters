/** Drives the hunter with real key events and captures each state. */
import puppeteer from "puppeteer";

const steps = JSON.parse(process.argv[2]);
const b = await puppeteer.launch({
  headless: "new",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 900 });
const problems = [];
page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`[error] ${m.text()}`); });

await page.goto("http://localhost:5199/hunter.html", { waitUntil: "networkidle0" });
await page.waitForSelector(".panel");
await new Promise((r) => setTimeout(r, 2500));
await page.click("canvas", { offset: { x: 900, y: 700 } }).catch(() => {});

for (const s of steps) {
  if (s.down) for (const k of s.down) await page.keyboard.down(k);
  if (s.up) for (const k of s.up) await page.keyboard.up(k);
  if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  if (s.shot) {
    await page.screenshot({ path: `shots/${s.shot}.png` });
    const st = await page.evaluate(() => document.querySelector("#state")?.textContent);
    console.log(`${s.shot} -> state=${st}`);
  }
}
console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "PROBLEMS: none");
await b.close();
