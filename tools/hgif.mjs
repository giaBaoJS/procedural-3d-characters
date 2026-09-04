/** Captures a burst of real frames while driving the hunter, for an animated preview. */
import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 820, height: 560 });
await page.goto("http://localhost:5199/hunter.html", { waitUntil: "networkidle0" });
await page.waitForSelector(".panel");
await new Promise(r => setTimeout(r, 2200));

// swing the camera round to a three-quarter front view of the approach
await page.evaluate(() => {
  const { camera, controls } = window.__vector;
  camera.position.set(3.4, 1.9, 4.6);
  controls.update();
});

const shot = async (i) => page.screenshot({ path: `shots/g_${String(i).padStart(2,"0")}.png` });
let i = 0;
await page.keyboard.down("s");
await page.keyboard.down("Shift");
for (; i < 8; i++) { await shot(i); }
await page.keyboard.down("l");
for (; i < 20; i++) { await shot(i); }
await page.keyboard.up("l");
await page.keyboard.up("Shift");
await page.keyboard.up("s");
for (; i < 26; i++) { await shot(i); }
console.log("frames", i);
await b.close();
