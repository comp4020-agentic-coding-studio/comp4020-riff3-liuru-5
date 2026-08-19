// Six stations, one mechanic: summon a phenomenon, then try to hold it. The
// shared #hold-count tally is what makes six unrelated toys read as one
// argument instead of six demos — every station only taxes it on the action
// that is actually an attempt to hold on, never on the action that summons
// the thing in the first place.

const holdCountEl = document.querySelector<HTMLElement>("#hold-count");
const letGoCountEl = document.querySelector<HTMLElement>("#let-go-count");
let holdCount = 0;
let letGoCount = 0;

function tally(): void {
  holdCount += 1;
  if (holdCountEl) holdCountEl.textContent = String(holdCount);
}

function tallyLetGo(): void {
  letGoCount += 1;
  if (letGoCountEl) letGoCountEl.textContent = String(letGoCount);
}

// Wires a station's "Let it be" button: it never touches the station's own
// state, only reports that the visitor chose not to grasp this time.
function initLetGo(buttonId: string, noteId: string, message: string): void {
  const button = document.querySelector<HTMLButtonElement>(`#${buttonId}`);
  const note = document.querySelector<HTMLElement>(`#${noteId}`);
  if (!button || !note) return;
  button.addEventListener("click", () => {
    tallyLetGo();
    note.textContent = message;
  });
}

const DREAM_WORDS = ["You", "are", "standing", "in", "a", "familiar", "room."];
const DREAM_SWAPS = [
  "water",
  "your",
  "childhood",
  "the",
  "ocean",
  "school",
  "nowhere",
  "static",
  "someone",
  "else's",
  "hallway",
];

function initDream(): void {
  const sentence = document.querySelector<HTMLElement>('[data-testid="dream-sentence"]');
  const startButton = document.querySelector<HTMLButtonElement>("#dream-start");
  const note = document.querySelector<HTMLElement>("#dream-note");
  if (!sentence || !startButton || !note) return;

  let dissolveTimer: number | undefined;
  const revealTimers: number[] = [];

  function swapWord(span: HTMLElement): void {
    tally();
    span.classList.add("reforming");
    window.setTimeout(() => {
      const replacement = DREAM_SWAPS[Math.floor(Math.random() * DREAM_SWAPS.length)] ?? "something else";
      span.textContent = replacement;
      span.classList.remove("reforming");
      span.classList.add("swapped");
    }, 200);
  }

  function makeWordSpan(word: string): HTMLElement {
    const span = document.createElement("span");
    span.textContent = word;
    span.className = "dream-word";
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", `Try to hold the word "${word}"`);
    span.addEventListener("animationend", () => span.classList.add("risen"), { once: true });
    span.addEventListener("click", () => swapWord(span));
    span.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        swapWord(span);
      }
    });
    return span;
  }

  startButton.addEventListener("click", () => {
    if (dissolveTimer) window.clearTimeout(dissolveTimer);
    for (const timer of revealTimers.splice(0)) window.clearTimeout(timer);
    sentence.replaceChildren();
    sentence.classList.remove("dissolved");
    note.textContent = "";
    startButton.disabled = true;

    for (const [index, word] of DREAM_WORDS.entries()) {
      revealTimers.push(
        window.setTimeout(() => {
          sentence.append(makeWordSpan(word), document.createTextNode(" "));
        }, index * 450),
      );
    }

    const totalReveal = DREAM_WORDS.length * 450;
    dissolveTimer = window.setTimeout(() => {
      sentence.classList.add("dissolved");
      note.textContent = "The room dissolved. You were never holding it up.";
      startButton.disabled = false;
    }, totalReveal + 2200);
  });
}

function initIllusion(): void {
  const card = document.querySelector<HTMLElement>("#illusion-card");
  const flipButton = document.querySelector<HTMLButtonElement>("#illusion-flip");
  const note = document.querySelector<HTMLElement>("#illusion-note");
  if (!card || !flipButton || !note) return;

  let flipped = false;
  flipButton.addEventListener("click", () => {
    tally();
    flipped = !flipped;
    card.classList.toggle("flipped", flipped);
    card.classList.remove("glitching");
    void card.offsetWidth;
    card.classList.add("glitching");
    window.setTimeout(() => card.classList.remove("glitching"), 350);
    note.textContent = flipped
      ? "The far side isn't there. It never needed one to look solid from here."
      : "From the front, it's convincing again.";
  });
}

// Sound is synthesised, not loaded: there is no clip to 404 on the deployed
// path, and the blow tone has to rise over whatever lifetime this particular
// bubble drew, which a fixed-length file can't do.
let audioCtx: AudioContext | undefined;

function getAudio(): AudioContext | undefined {
  if (typeof AudioContext === "undefined") return undefined;
  // Built lazily, inside the pointerdown/keydown that starts a blow, so
  // autoplay policy lets it run. A browser that refuses just stays silent.
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function initBubble(): void {
  const bubble = document.querySelector<HTMLElement>("#bubble");
  const blowButton = document.querySelector<HTMLButtonElement>("#bubble-blow");
  const note = document.querySelector<HTMLElement>("#bubble-note");
  if (!bubble || !blowButton || !note) return;
  const bubbleEl = bubble;
  const noteEl = note;

  let growTimer: number | undefined;
  let popAt = 0;
  let popped = false;
  // Distinct from `growTimer`: it says a blow is genuinely in progress, so a
  // stray pointerup or keyup landing on the button can't pop a bubble that was
  // never blown (and can't tax the tally for it).
  let blowing = false;
  let breath: { osc: OscillatorNode; gain: GainNode } | undefined;

  // A sine rising 160→520Hz across exactly this bubble's lifetime, so the pitch
  // is a second read-out of the scale the circle is already drawing.
  function startBreath(ctx: AudioContext, lifetimeMs: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(520, now + lifetimeMs / 1000);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    breath = { osc, gain };
  }

  function stopBreath(ctx: AudioContext): void {
    if (!breath) return;
    const { osc, gain } = breath;
    breath = undefined;
    const now = ctx.currentTime;
    // Ramped to zero rather than stopped dead: cutting a running oscillator
    // mid-cycle is an audible click.
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.02);
    osc.stop(now + 0.04);
  }

  function playPop(ctx: AudioContext): void {
    const length = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      // Noise under a steep decay — the whole burst is gone inside 90ms, which
      // is what makes it read as a pop rather than a hiss.
      samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 7;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 950;
    band.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(band).connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime);
  }

  function reset(): void {
    popped = false;
    bubbleEl.style.setProperty("--scale", "0");
    bubbleEl.classList.remove("popped");
    // Always pops within a couple of seconds — care and timing don't change that.
    popAt = 1200 + Math.random() * 1800;
  }

  function stopGrowing(): void {
    if (growTimer !== undefined) {
      window.clearInterval(growTimer);
      growTimer = undefined;
    }
  }

  function pop(): void {
    stopGrowing();
    if (popped || !blowing) return;
    popped = true;
    blowing = false;
    const ctx = getAudio();
    if (ctx) {
      stopBreath(ctx);
      playPop(ctx);
    }
    tally();
    bubbleEl.classList.add("popped");
    noteEl.textContent = "However carefully you held it, it popped anyway.";
  }

  function startBlowing(): void {
    if (blowing) return;
    blowing = true;
    reset();
    const ctx = getAudio();
    if (ctx) startBreath(ctx, popAt);
    const start = performance.now();
    growTimer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const size = Math.min(1, elapsed / popAt);
      bubbleEl.style.setProperty("--scale", size.toFixed(3));
      if (elapsed >= popAt) pop();
    }, 30);
  }

  blowButton.addEventListener("pointerdown", startBlowing);
  blowButton.addEventListener("pointerup", () => {
    if (!popped) pop();
  });
  blowButton.addEventListener("pointerleave", () => {
    if (!popped && growTimer !== undefined) pop();
  });
  blowButton.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat && growTimer === undefined) {
      event.preventDefault();
      startBlowing();
    }
  });
  blowButton.addEventListener("keyup", (event) => {
    if ((event.key === " " || event.key === "Enter") && !popped) {
      event.preventDefault();
      pop();
    }
  });
}

// The shadow is projected, not drawn: every frame casts a ray from the lamp
// past the object's two top corners onto the floor line, and the quad between
// those rays is the shadow. Nothing about the shape is authored, which is the
// whole point of the station — there is no shadow object, only geometry left
// over from where the light isn't.
function initShadow(): void {
  const stage = document.querySelector<HTMLElement>("#shadow-stage");
  const light = document.querySelector<HTMLElement>("#shadow-light");
  const object = document.querySelector<HTMLElement>("#shadow-object");
  const umbra = document.querySelector<SVGPathElement>("#shadow-umbra");
  const cast = document.querySelector<SVGPathElement>("#shadow-cast");
  const contact = document.querySelector<SVGEllipseElement>("#shadow-contact");
  const falloff = document.querySelector<SVGLinearGradientElement>("#shadow-falloff");
  const penumbra = document.querySelector<SVGFEGaussianBlurElement>("#shadow-penumbra-blur");
  const note = document.querySelector<HTMLElement>("#shadow-note");
  if (!stage || !light || !object || !umbra || !cast || !falloff || !penumbra || !note) return;
  if (!contact) return;
  const stageEl = stage;
  const objectEl = object;
  const umbraEl = umbra;
  const castEl = cast;
  const contactEl = contact;
  const falloffEl = falloff;
  const penumbraEl = penumbra;
  const noteEl = note;

  // Percentages of the stage, so the lamp survives a resize. The Y ceiling
  // keeps the lamp above the object's own head: at or below it the projection
  // inverts (the shadow would fly upward to infinity), which is real physics
  // but reads as a bug.
  let lightX = 22;
  let lightY = 15;
  const STEP = 5;
  const MIN_X = 5;
  const MAX_X = 95;
  const MIN_Y = 5;
  const MAX_Y = 34;

  function render(): void {
    const stageW = stageEl.clientWidth;
    const stageH = stageEl.clientHeight;
    const lampX = (lightX / 100) * stageW;
    const lampY = (lightY / 100) * stageH;

    stageEl.style.setProperty("--light-x", `${lightX}%`);
    stageEl.style.setProperty("--light-y", `${lightY}%`);

    // Measured, not assumed: CSS owns the object's size, this owns the optics.
    const objW = objectEl.offsetWidth;
    const objH = objectEl.offsetHeight;
    const objX = objectEl.offsetLeft;
    const floorY = objectEl.offsetTop + objH;

    // Similar triangles. A ray from the lamp through a point at the object's
    // height lands on the floor scaled by height / (lampHeight - height).
    const lampHeight = Math.max(floorY - lampY, objH * 1.15);
    const scale = lampHeight / (lampHeight - objH);
    const project = (x: number): number => lampX + (x - lampX) * scale;
    const tipX = project(objX);
    const length = Math.abs(tipX - objX);
    const away = tipX >= objX ? 1 : -1;

    // The 2D scene has no depth, so the floor plane is faked with thickness:
    // the shadow is a lozenge as wide as the object's feet at one end and as
    // wide as the projected top edge at the other.
    const nearHalf = objW * 0.28;
    const farHalf = Math.min(nearHalf * scale, stageH * 0.14);
    const sweep = away > 0 ? 1 : 0;
    const d = [
      `M ${objX} ${floorY - nearHalf}`,
      `L ${tipX} ${floorY - farHalf}`,
      `A ${farHalf * 1.15} ${farHalf} 0 0 ${sweep} ${tipX} ${floorY + farHalf}`,
      `L ${objX} ${floorY + nearHalf}`,
      `A ${nearHalf * 1.15} ${nearHalf} 0 0 ${sweep} ${objX} ${floorY - nearHalf}`,
      "Z",
    ].join(" ");
    umbraEl.setAttribute("d", d);
    castEl.setAttribute("d", d);

    contactEl.setAttribute("cx", String(objX + away * objW * 0.16));
    contactEl.setAttribute("cy", String(floorY));
    contactEl.setAttribute("rx", String(objW * 0.56));
    contactEl.setAttribute("ry", String(nearHalf * 0.8));

    // Gradient along the shadow's own axis. The floor is at least a couple of
    // object-widths of run-out even when the shadow is short, or a lamp
    // straight overhead would collapse the gradient onto a point and paint the
    // whole shape in the final (transparent) stop.
    const reach = Math.max(length * 1.45 + farHalf, objW * 3);
    falloffEl.setAttribute("x1", String(objX));
    falloffEl.setAttribute("y1", String(floorY));
    falloffEl.setAttribute("x2", String(objX + away * reach));
    falloffEl.setAttribute("y2", String(floorY));

    // Far from the lamp the edge goes soft and the whole thing goes weak —
    // the two cues that separate a cast shadow from a sticker of one.
    penumbraEl.setAttribute("stdDeviation", String(Math.min(0.9 + length * 0.018, 7)));
    umbraEl.style.opacity = String(Math.max(0.48, 1 - length / (stageW * 2.6)));

    // Light the object from wherever the lamp actually is: 0deg is "to top" in
    // a CSS gradient, so this points the dark end directly away from it.
    const angle = (Math.atan2(objX - lampX, lampY - (floorY - objH / 2)) * 180) / Math.PI;
    objectEl.style.setProperty("--lit-angle", `${angle.toFixed(1)}deg`);
  }

  function moveLight(deltaX: number, deltaY: number): void {
    lightX = Math.min(MAX_X, Math.max(MIN_X, lightX + deltaX));
    lightY = Math.min(MAX_Y, Math.max(MIN_Y, lightY + deltaY));
    render();
  }

  function updateFromPointer(event: PointerEvent): void {
    const rect = stageEl.getBoundingClientRect();
    lightX = Math.min(MAX_X, Math.max(MIN_X, ((event.clientX - rect.left) / rect.width) * 100));
    lightY = Math.min(MAX_Y, Math.max(MIN_Y, ((event.clientY - rect.top) / rect.height) * 100));
    render();
  }

  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-STEP, 0],
    ArrowRight: [STEP, 0],
    ArrowUp: [0, -STEP],
    ArrowDown: [0, STEP],
  };

  stageEl.addEventListener("keydown", (event) => {
    const delta = ARROWS[event.key];
    if (!delta) return;
    moveLight(delta[0], delta[1]);
    event.preventDefault();
  });

  let dragging = false;
  stageEl.addEventListener("pointerdown", (event) => {
    dragging = true;
    updateFromPointer(event);
  });
  window.addEventListener("pointermove", (event) => {
    if (dragging) updateFromPointer(event);
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });

  // Grabbing at the shadow must not double as moving the lamp: the one gesture
  // aimed at the shadow itself is the one that has to come back empty.
  castEl.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  castEl.addEventListener("click", () => {
    tally();
    noteEl.textContent = "Nothing there. It's just where the light doesn't reach.";
  });

  // Geometry is in pixels, so it has to be recomputed whenever the box changes.
  new ResizeObserver(() => render()).observe(stageEl);
  render();
}

function initDew(): void {
  const drop = document.querySelector<HTMLElement>("#dew-drop");
  const formButton = document.querySelector<HTMLButtonElement>("#dew-form");
  const freezeButton = document.querySelector<HTMLButtonElement>("#dew-freeze");
  const note = document.querySelector<HTMLElement>("#dew-note");
  if (!drop || !formButton || !freezeButton || !note) return;

  const LIFETIME_MS = 6000;
  let evaporateTimer: number | undefined;

  formButton.addEventListener("click", () => {
    if (evaporateTimer !== undefined) window.clearTimeout(evaporateTimer);
    drop.classList.remove("evaporated");
    drop.classList.add("forming");
    freezeButton.disabled = false;
    formButton.disabled = true;
    note.textContent = "Forming. It has until sunrise, whether you watch or not.";

    evaporateTimer = window.setTimeout(() => {
      drop.classList.remove("forming");
      drop.classList.add("evaporated");
      note.textContent = "Gone. Freezing it wasn't ever an option this page offered.";
      freezeButton.disabled = true;
      formButton.disabled = false;
    }, LIFETIME_MS);
  });

  freezeButton.addEventListener("click", () => {
    tally();
    drop.classList.add("shaken");
    window.setTimeout(() => drop.classList.remove("shaken"), 300);
    note.textContent = "It kept going. This button was always cosmetic.";
  });
}

// A bolt is generated per strike (never the same channel twice) and played
// through an intensity envelope of three return strokes, which is what makes
// the flicker read as lightning rather than as a light switch. Slow motion
// replays the identical event at 1/8 speed — the point of the station is that
// stretching it doesn't hand you a middle to hold, and reusing one envelope for
// both speeds is what makes that claim honest rather than staged.
const LIGHTNING_HORIZON = 118;
const LIGHTNING_MS = 260;
const LIGHTNING_STROKES = [
  { at: 0, amp: 1, decay: 46 },
  { at: 78, amp: 0.6, decay: 32 },
  { at: 138, amp: 0.85, decay: 60 },
];

function boltIntensity(t: number): number {
  let peak = 0;
  for (const stroke of LIGHTNING_STROKES) {
    if (t < stroke.at) continue;
    peak = Math.max(peak, stroke.amp * Math.exp(-(t - stroke.at) / stroke.decay));
  }
  return peak;
}

// Returns the main channel and its forks separately: they are stroked at
// different weights, the way a real channel outruns what branches off it.
function drawBolt(): { channel: string; forks: string; midX: number } {
  let x = 80 + Math.random() * 240;
  let y = -8;
  const lean = (Math.random() - 0.5) * 7;
  const channel = [`M ${x.toFixed(1)} ${y.toFixed(1)}`];
  const nodes: { x: number; y: number }[] = [];

  while (y < LIGHTNING_HORIZON) {
    y = Math.min(y + 7 + Math.random() * 12, LIGHTNING_HORIZON);
    x = Math.min(384, Math.max(16, x + lean + (Math.random() - 0.5) * 26));
    channel.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    nodes.push({ x, y });
  }

  const forks: string[] = [];
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    // Forks leave from the upper channel; one splitting a step above the
    // ground looks like a mistake rather than a fork.
    const node = nodes[Math.floor(Math.random() * Math.max(nodes.length - 3, 1))];
    if (!node) continue;
    let fx = node.x;
    let fy = node.y;
    const away = Math.random() < 0.5 ? -1 : 1;
    const parts = [`M ${fx.toFixed(1)} ${fy.toFixed(1)}`];
    const steps = 2 + Math.floor(Math.random() * 4);
    for (let step = 0; step < steps; step += 1) {
      fx += away * (5 + Math.random() * 15);
      fy += 4 + Math.random() * 11;
      parts.push(`L ${fx.toFixed(1)} ${fy.toFixed(1)}`);
    }
    forks.push(parts.join(" "));
  }

  const midX = nodes[Math.floor(nodes.length / 2)]?.x ?? 200;
  return { channel: channel.join(" "), forks: forks.join(" "), midX };
}

function initLightning(): void {
  const bolt = document.querySelector<SVGGElement>("#lightning-bolt");
  const bloom = document.querySelector<SVGPathElement>("#lightning-bloom-path");
  const core = document.querySelector<SVGPathElement>("#lightning-core-path");
  const branch = document.querySelector<SVGPathElement>("#lightning-branch-path");
  const flash = document.querySelector<SVGRectElement>("#lightning-flash");
  const halo = document.querySelector<SVGEllipseElement>("#lightning-halo-shape");
  const strikeButton = document.querySelector<HTMLButtonElement>("#lightning-strike");
  const replayButton = document.querySelector<HTMLButtonElement>("#lightning-replay");
  const note = document.querySelector<HTMLElement>("#lightning-note");
  if (!bolt || !bloom || !core || !branch || !flash || !halo) return;
  if (!strikeButton || !replayButton || !note) return;
  const boltEl = bolt;
  const bloomEl = bloom;
  const coreEl = core;
  const branchEl = branch;
  const flashEl = flash;
  const haloEl = halo;
  const strikeEl = strikeButton;
  const replayEl = replayButton;
  const noteEl = note;

  // Three flashes inside a quarter-second is at the WCAG 2.3.1 limit, so the
  // button locks until the sky is dark again: mashing it can't stack strikes
  // into a strobe, and you can't hold two bolts at once anyway.
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame: number | undefined;
  let safety: number | undefined;

  function paint(level: number): void {
    boltEl.style.opacity = level.toFixed(3);
    flashEl.style.opacity = (level * (calm.matches ? 0.12 : 0.4)).toFixed(3);
    haloEl.style.opacity = (level * 0.65).toFixed(3);
  }

  // Every exit from a strike goes through here, so the two buttons can't be
  // left disabled by one: requestAnimationFrame is suspended in a backgrounded
  // tab, and a strike fired just before a tab switch would otherwise never
  // reach its last frame.
  function finish(): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (safety !== undefined) window.clearTimeout(safety);
    frame = undefined;
    safety = undefined;
    paint(0);
    strikeEl.disabled = false;
    replayEl.disabled = false;
  }

  function play(rate: number, message: string): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (safety !== undefined) window.clearTimeout(safety);
    const { channel, forks, midX } = drawBolt();
    bloomEl.setAttribute("d", `${channel} ${forks}`.trim());
    coreEl.setAttribute("d", channel);
    branchEl.setAttribute("d", forks);
    haloEl.setAttribute("cx", midX.toFixed(1));

    // Reduced motion gets the same bolt with the flicker taken out: one slow
    // swell instead of three strokes, and a dimmed sky.
    const stretched = calm.matches ? 0.35 : rate;
    const duration = LIGHTNING_MS / stretched;
    const started = performance.now();
    strikeEl.disabled = true;
    replayEl.disabled = true;
    noteEl.textContent = message;

    const step = (now: number): void => {
      const elapsed = now - started;
      const t = elapsed * stretched;
      paint(calm.matches ? Math.sin((elapsed / duration) * Math.PI) * 0.9 : boltIntensity(t));
      if (elapsed < duration) {
        frame = requestAnimationFrame(step);
        return;
      }
      finish();
    };
    frame = requestAnimationFrame(step);
    // Wall clock, which keeps running when the frame clock doesn't.
    safety = window.setTimeout(finish, duration + 150);
  }

  strikeEl.addEventListener("click", () => {
    play(1, calm.matches
      ? "Your system asks for reduced motion, so this one swells instead of flickering. Still gone."
      : "Three return strokes in under three tenths of a second. Hit replay to look slower.");
  });

  replayEl.addEventListener("click", () => {
    tally();
    play(0.125, "Eight times slower, same event. The flicker just gets wider — there was never a middle in it.");
  });
}

initDream();
initIllusion();
initBubble();
initShadow();
initDew();
initLightning();

initLetGo("dream-let-go", "dream-note", "You didn't reach for a single word. It dissolved on schedule either way.");
initLetGo("illusion-let-go", "illusion-note", "You didn't check the back. It was never solid, checked or not.");
initLetGo("bubble-let-go", "bubble-note", "You didn't hold the button. Nothing grew, and nothing needed to pop.");
initLetGo("shadow-let-go", "shadow-note", "You didn't grab at it. It kept following the light without you.");
initLetGo("dew-let-go", "dew-note", "You didn't reach for the freeze button. It was always going to go by sunrise.");
initLetGo("lightning-let-go", "lightning-note", "You didn't ask for the replay. It was already over either way.");
