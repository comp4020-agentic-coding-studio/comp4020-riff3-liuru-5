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
    const replacement = DREAM_SWAPS[Math.floor(Math.random() * DREAM_SWAPS.length)] ?? "something else";
    span.textContent = replacement;
    span.classList.add("swapped");
  }

  function makeWordSpan(word: string): HTMLElement {
    const span = document.createElement("span");
    span.textContent = word;
    span.className = "dream-word";
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", `Try to hold the word "${word}"`);
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
    note.textContent = flipped
      ? "The far side isn't there. It never needed one to look solid from here."
      : "From the front, it's convincing again.";
  });
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
    if (popped) return;
    popped = true;
    tally();
    bubbleEl.classList.add("popped");
    noteEl.textContent = "However carefully you held it, it popped anyway.";
  }

  function startBlowing(): void {
    reset();
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

function initShadow(): void {
  const stage = document.querySelector<HTMLElement>("#shadow-stage");
  const light = document.querySelector<HTMLElement>("#shadow-light");
  const cast = document.querySelector<HTMLElement>("#shadow-cast");
  const note = document.querySelector<HTMLElement>("#shadow-note");
  if (!stage || !light || !cast || !note) return;
  const stageEl = stage;
  const lightEl = light;
  const castEl = cast;

  let lightX = 20;
  const STEP = 6;

  function render(): void {
    lightEl.style.left = `${lightX}%`;
    const offset = (50 - lightX) * 1.1;
    castEl.style.transform = `translateX(${offset}%)`;
  }

  function moveLight(delta: number): void {
    lightX = Math.min(90, Math.max(10, lightX + delta));
    render();
  }

  function updateFromPointer(event: PointerEvent): void {
    const rect = stageEl.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    lightX = Math.min(90, Math.max(10, percent));
    render();
  }

  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      moveLight(-STEP);
      event.preventDefault();
    }
    if (event.key === "ArrowRight") {
      moveLight(STEP);
      event.preventDefault();
    }
  });

  let dragging = false;
  stage.addEventListener("pointerdown", (event) => {
    dragging = true;
    updateFromPointer(event);
  });
  window.addEventListener("pointermove", (event) => {
    if (dragging) updateFromPointer(event);
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });

  cast.addEventListener("click", () => {
    tally();
    note.textContent = "Nothing there. It's just where the light doesn't reach.";
  });

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

function initLightning(): void {
  const stage = document.querySelector<HTMLElement>("#lightning-stage");
  const strikeButton = document.querySelector<HTMLButtonElement>("#lightning-strike");
  const replayButton = document.querySelector<HTMLButtonElement>("#lightning-replay");
  const note = document.querySelector<HTMLElement>("#lightning-note");
  if (!stage || !strikeButton || !replayButton || !note) return;
  const stageEl = stage;
  const noteEl = note;
  const replayButtonEl = replayButton;

  function flash(slow: boolean): void {
    stageEl.classList.remove("flash", "flash-slow");
    // Force a reflow so re-adding the class restarts the animation.
    void stageEl.offsetWidth;
    stageEl.classList.add(slow ? "flash-slow" : "flash");
    noteEl.textContent = slow
      ? "Stretched to a second and a half. Still nothing in the middle to hold onto."
      : "That took under a fifth of a second. Hit replay to look slower.";
    replayButtonEl.disabled = false;
  }

  strikeButton.addEventListener("click", () => flash(false));
  replayButton.addEventListener("click", () => {
    tally();
    flash(true);
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
