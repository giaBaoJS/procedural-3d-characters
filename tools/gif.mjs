/** Seek one clip across its full duration and dump evenly spaced frames. */
import puppeteer from "puppeteer";
const [label, duration, frames, tag] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
const b = await puppeteer.launch({ headless: "new", args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:5199/", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 2500));

await page.evaluate((l) => {
  [...document.querySelectorAll(".clips button")].find(x => x.textContent === l)?.click();
}, label);
await new Promise(r => setTimeout(r, 900)); // let the crossfade finish before freezing

for (let i = 0; i < frames; i++) {
  await page.evaluate(({ t }) => {
    const { mixer } = window.__mochi;
    mixer.timeScale = 1;
    mixer.setTime(t);
    mixer.timeScale = 0;
  }, { t: (i / frames) * duration });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: `shots/f_${tag}_${String(i).padStart(2, "0")}.png` });
}
console.log("frames:", frames);
await b.close();
