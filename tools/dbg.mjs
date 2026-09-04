import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: "new", args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:5199/hunter.html", { waitUntil: "networkidle0" });
await page.waitForSelector(".panel");
await new Promise(r => setTimeout(r, 2500));

await page.keyboard.down("j");
await new Promise(r => setTimeout(r, 1400));
const charge = await page.evaluate(() => {
  const { fx, loco, hunter } = window.__vector;
  const orb = fx.group.children.find(c => c.type === "Mesh" && c.geometry.type === "SphereGeometry");
  const m = new (window.THREE_V ?? Object)();
  void m;
  const muzzle = hunter.anchors.muzzle;
  muzzle.updateWorldMatrix(true, false);
  const e = muzzle.matrixWorld.elements;
  return {
    charging: loco.charge,
    orbVisible: orb?.visible, orbScale: orb?.scale.x,
    orbPos: orb ? [+orb.position.x.toFixed(2), +orb.position.y.toFixed(2), +orb.position.z.toFixed(2)] : null,
    muzzleWorld: [+e[12].toFixed(2), +e[13].toFixed(2), +e[14].toFixed(2)],
    chargeWeight: fx.intensity,
  };
});
await page.keyboard.up("j");
await new Promise(r => setTimeout(r, 400));

await page.keyboard.down("k");
await new Promise(r => setTimeout(r, 200));
const sabre = await page.evaluate(() => {
  const { fx } = window.__vector;
  const blade = fx.group.children.filter(c => c.type === "Mesh").map(c => ({
    geo: c.geometry.type, vis: c.visible,
    op: c.material.opacity, scale: +c.scale.y.toFixed(3),
    pos: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)],
  }));
  return { saberActive: fx.saberActive, meshes: blade };
});
console.log("CHARGE:", JSON.stringify(charge));
console.log("SABRE:", JSON.stringify(sabre, null, 1).slice(0, 1400));
await b.close();
