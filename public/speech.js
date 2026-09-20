// Automatic messages use screen pixels and retain their speaker for a full reading interval.
export const SPEECH_VISIBLE_SECONDS = 6;
export const SPEECH_FADE_SECONDS = .4;

function hashId(id) {
  let hash = 2166136261;
  for (const char of String(id ?? 'guest')) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
}

function messageText(message) {
  const text = Array.from(String(message || '').replace(/\s+/g, ' ').trim());
  return text.length > 40 ? text.slice(0, 38).join('') + '…' : text.join('');
}

export function speechDuration(message) {
  return Math.min(7, SPEECH_VISIBLE_SECONDS + Math.max(0, Array.from(messageText(message)).length - 16) * .045);
}

function settings(options) {
  const { width = 390, height = 844, measureText = text => Array.from(text).length * 12,
    top = 70, bottom = 130, maxVisible = width < 960 ? 2 : 3, reduced = false } = options;
  return { width, height, measureText, top, bottom, reduced,
    maxVisible: Math.max(0, Math.min(3, Math.floor(maxVisible))),
    maxWidth: Math.min(190, width - 24), availableHeight: height - top - bottom };
}

function eligible(guest, config) {
  return guest && messageText(guest.message) && Number.isFinite(guest.x) && Number.isFinite(guest.y) &&
    guest.x >= 0 && guest.x <= config.width && guest.y >= config.top + 22 &&
    guest.y <= config.height - config.bottom + 70;
}

function wrapMessage(message, maxWidth, measureText) {
  const lines = [];
  let line = '';
  for (const char of messageText(message)) {
    if (line && measureText(line + char) > maxWidth) { lines.push(line); line = ''; }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

function overlaps(a, b) {
  return a.x < b.x + b.width + 8 && a.x + a.width + 8 > b.x &&
    a.y < b.y + b.height + 8 && a.y + a.height + 8 > b.y;
}

function bubbleFor(guest, config) {
  const lines = wrapMessage(guest.message, config.maxWidth - 24, config.measureText);
  if (!lines.length) return null;
  const width = Math.min(config.maxWidth, Math.max(72, ...lines.map(line => config.measureText(line))) + 24);
  const height = lines.length * 17 + 18;
  if (height > config.availableHeight) return null;
  const x = Math.max(12, Math.min(config.width - width - 12, guest.x - width / 2));
  const y = Math.max(config.top, Math.min(config.height - config.bottom - height, guest.y - height - 10));
  return { id: guest.id, x, y, width, height, lines,
    tailX: Math.max(x + 12, Math.min(x + width - 12, guest.x)) };
}

function placeBubble(bubble, guest, occupied, config, previous) {
  const step = bubble.height + 10;
  // Collision moves a box a little; it never changes which active speaker owns a slot.
  const choices = previous ? [{ ...bubble, x: previous.x, y: previous.y }, bubble] : [bubble];
  choices.push(...[-step, step, -2 * step].map(dy => ({ ...bubble, y: bubble.y + dy })));
  for (const choice of choices) {
    if (choice.y < config.top || choice.y + choice.height > config.height - config.bottom ||
      choice.x < 12 || choice.x + choice.width > config.width - 12) continue;
    if (!occupied.some(other => overlaps(choice, other))) return { ...choice,
      tailX: Math.max(choice.x + 12, Math.min(choice.x + choice.width - 12, guest.x)) };
  }
  return null;
}

/** Geometry only. Use createSpeechScheduler() once per garden for animated messages. */
export function layoutSpeechBubbles(candidates, seconds, options = {}) {
  const config = settings(options), visible = [];
  if (config.maxWidth < 50 || config.availableHeight < 44 || !config.maxVisible) return visible;
  for (const guest of candidates) {
    if (!eligible(guest, config)) continue;
    const bubble = bubbleFor(guest, config);
    if (!bubble) continue;
    const placed = placeBubble(bubble, guest, visible, config);
    if (placed) visible.push({ ...placed, age: 0, duration: speechDuration(guest.message), opacity: 1 });
    if (visible.length >= config.maxVisible) break;
  }
  return visible;
}

/**
 * Create ONCE per garden. getLayout takes [{id,message,x,y}], seconds, and the same
 * viewport/measureText options as layoutSpeechBubbles, plus reduced for no fades.
 * Returned boxes add age, duration, startedAt and opacity. Use opacity as globalAlpha.
 * Moving/overlapping candidates cannot displace a chosen speaker before its 6–7s
 * interval ends. Deleted/offscreen speakers and smaller viewport limits may retire early.
 */
export function createSpeechScheduler() {
  const active = new Map(), lastShown = new Map(), cooldownUntil = new Map();
  let lastTime = -Infinity, nextAdmission = .6;
  function reset() {
    active.clear(); lastShown.clear(); cooldownUntil.clear(); lastTime = -Infinity; nextAdmission = .6;
  }
  function getLayout(candidates, seconds, options = {}) {
    const now = Math.max(0, Number(seconds) || 0), config = settings(options);
    if (now < lastTime) reset();
    lastTime = now;
    const guests = new Map(candidates.map(guest => [guest.id, guest]));
    for (const id of lastShown.keys()) if (!guests.has(id)) lastShown.delete(id);
    for (const id of cooldownUntil.keys()) if (!guests.has(id)) cooldownUntil.delete(id);
    if (config.maxWidth < 50 || config.availableHeight < 44 || !config.maxVisible) {
      for (const id of active.keys()) cooldownUntil.set(id, now + 3);
      active.clear(); nextAdmission = now + .8; return [];
    }
    for (const [id, entry] of active) {
      if (now >= entry.startedAt + entry.duration || !eligible(guests.get(id), config)) {
        active.delete(id); cooldownUntil.set(id, now + 8); nextAdmission = Math.max(nextAdmission, now + .9);
      }
    }
    while (active.size > config.maxVisible) {
      const id = Array.from(active.keys()).at(-1);
      active.delete(id); cooldownUntil.set(id, now + 8);
    }
    const visible = [];
    for (const [id, entry] of active) {
      const guest = { ...guests.get(id), message: entry.message }, bubble = bubbleFor(guest, config);
      if (!bubble) continue;
      // Retain the committed speaker even in an impossibly crowded frame.
      // Remember only the collision offset, never a fixed screen position.
      const preferred = { x: bubble.x + entry.offsetX, y: bubble.y + entry.offsetY };
      const placed = placeBubble(bubble, guest, visible, config, preferred) || bubble;
      entry.offsetX = placed.x - bubble.x; entry.offsetY = placed.y - bubble.y;
      const age = now - entry.startedAt;
      const opacity = config.reduced ? 1 : Math.max(0, Math.min(1, age / SPEECH_FADE_SECONDS,
        (entry.duration - age) / SPEECH_FADE_SECONDS));
      visible.push({ ...placed, age, duration: entry.duration, startedAt: entry.startedAt, opacity });
    }
    if (active.size < config.maxVisible && now >= nextAdmission) {
      const waiting = candidates.filter(guest => !active.has(guest.id) && eligible(guest, config) &&
        (cooldownUntil.get(guest.id) ?? -Infinity) <= now)
        .sort((a, b) => (lastShown.get(a.id) ?? -Infinity) - (lastShown.get(b.id) ?? -Infinity) ||
          hashId(a.id) - hashId(b.id));
      for (const guest of waiting) {
        const bubble = bubbleFor(guest, config);
        if (!bubble) continue;
        const placed = placeBubble(bubble, guest, visible, config);
        if (!placed) continue;
        const duration = speechDuration(guest.message);
        active.set(guest.id, { startedAt: now, duration, message: guest.message,
          offsetX: placed.x - bubble.x, offsetY: placed.y - bubble.y });
        lastShown.set(guest.id, now);
        visible.push({ ...placed, age: 0, duration, startedAt: now, opacity: config.reduced ? 1 : 0 });
        break;
      }
      nextAdmission = now + 1.8;
    }
    return visible;
  }
  return { getLayout, reset };
}
