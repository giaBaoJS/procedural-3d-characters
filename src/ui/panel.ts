/** The control panel. Pure DOM, built here so index.html stays a single mount point. */
export interface PanelHandlers {
  onClip: (key: string) => void;
  onExplode: (value: number) => void;
  onIntensity: (value: number) => void;
  onSpeed: (value: number) => void;
}

export function buildPanel(
  labels: Record<string, string>,
  order: string[],
  handlers: PanelHandlers
): { setActive: (key: string) => void } {
  const panel = document.createElement("aside");
  panel.className = "panel";

  panel.innerHTML = `
    <header>
      <h1>Mochi</h1>
      <p class="sub">Procedural mascot — geometry, rig, every keyframe and the whole
      effect layer are TypeScript. Nothing is fetched.</p>
    </header>
    <section>
      <div class="label-row"><span>Animations</span><span class="current" id="current">Idle</span></div>
      <div class="clips" id="clips"></div>
    </section>
    <section>
      <label class="slider">Explode parts <input type="range" id="explode" min="0" max="100" value="0"></label>
      <label class="slider">Effects <input type="range" id="intensity" min="0" max="150" value="100"></label>
      <label class="slider">Speed <input type="range" id="speed" min="10" max="200" value="100"></label>
    </section>
    <footer><span id="stats"></span><a href="/hunter.html">Vector →</a></footer>`;

  document.body.appendChild(panel);

  const clips = panel.querySelector<HTMLDivElement>("#clips")!;
  const current = panel.querySelector<HTMLSpanElement>("#current")!;
  const buttons = new Map<string, HTMLButtonElement>();

  for (const key of order) {
    const btn = document.createElement("button");
    btn.textContent = labels[key] ?? key;
    btn.onclick = () => handlers.onClip(key);
    clips.appendChild(btn);
    buttons.set(key, btn);
  }

  const bind = (id: string, fn: (v: number) => void) => {
    const el = panel.querySelector<HTMLInputElement>(`#${id}`)!;
    el.oninput = () => fn(Number(el.value) / 100);
  };
  bind("explode", handlers.onExplode);
  bind("intensity", handlers.onIntensity);
  bind("speed", handlers.onSpeed);

  return {
    setActive(key: string) {
      for (const [k, btn] of buttons) btn.classList.toggle("on", k === key);
      current.textContent = labels[key] ?? key;
    },
  };
}
