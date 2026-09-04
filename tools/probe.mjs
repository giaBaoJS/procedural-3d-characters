/** Sweeps the right arm through a range of Z angles and reports where the paw lands. */
import puppeteer from "puppeteer";
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const page = await browser.newPage();
await page.goto("http://localhost:5199/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));

const out = await page.evaluate(async () => {
  const { mascot, mixer } = window.__mochi;
  mixer.stopAllAction();
  // Read translation straight out of matrixWorld so the page needs no module import.
  const at = (o) => [o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]];
  const fmt = (v) => v.map((n) => n.toFixed(3)).join(", ");
  const arm = mascot.pivots.armR;
  const hand = mascot.anchors.handR;
  mascot.root.updateMatrixWorld(true);
  const shoulder = at(arm).map((n) => +n.toFixed(3));
  const rows = [];
  for (let deg = -180; deg <= 180; deg += 30) {
    arm.rotation.set(0, 0, (deg * Math.PI) / 180);
    mascot.root.updateMatrixWorld(true);
    rows.push(`${String(deg).padStart(5)}  hand=(${fmt(at(hand))})`);
  }
  return { shoulder, rows };
});
console.log("shoulder:", out.shoulder);
console.log(out.rows.join("\n"));
await browser.close();
