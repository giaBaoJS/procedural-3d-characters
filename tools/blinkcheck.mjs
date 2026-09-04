/** Freeze the idle clip at exact times so the blink can be inspected frame by frame. */
import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:5199/", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2500));
for (const t of [0.6, 1.04, 1.1, 1.16]) {
  await page.evaluate((time) => {
    const { mixer } = window.__mochi;
    // setTime routes through update(), which scales by timeScale — so seek first,
    // then freeze, or the seek is multiplied by zero and goes nowhere.
    mixer.timeScale = 1;
    mixer.setTime(time);
    mixer.timeScale = 0;
  }, t);
  await new Promise(r => setTimeout(r, 350));
  await page.screenshot({ path: `shots/blink-${String(t).replace(".","_")}.png` });
}
console.log("done");
await b.close();
