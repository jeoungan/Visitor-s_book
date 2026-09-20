// Automatic messages stay readable in screen pixels, including a zoomed garden.
export const SPEECH_VISIBLE_SECONDS = 2.6;

function hashId(id) {
  let hash = 2166136261;
  for (const char of String(id ?? 'guest')) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
}

export function speechTiming(id, seconds) {
  const hash = hashId(id);
  const initialDelay = .25 + (hash % 3800) / 1000;
  const gap = 4.4 + ((hash >>> 8) % 2000) / 1000;
  const period = SPEECH_VISIBLE_SECONDS + gap;
  const elapsed = Math.max(0, Number(seconds) || 0) - initialDelay;
  const cycle = Math.floor(elapsed / period);
  const age = elapsed - cycle * period;
  return {
    visible: elapsed >= 0 && age < SPEECH_VISIBLE_SECONDS,
    age,
    startedAt: initialDelay + cycle * period,
    duration: SPEECH_VISIBLE_SECONDS,
    gap,
    period,
    initialDelay,
  };
}

function wrapMessage(message, maxWidth, measureText) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  const clipped = characters.length > 40 ? characters.slice(0, 38).join('') + '…' : text;
  const lines = [];
  let line = '';
  for (const char of clipped) {
    if (line && measureText(line + char) > maxWidth) {
      lines.push(line);
      line = '';
    }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

function overlaps(a, b) {
  return a.x < b.x + b.width + 8 && a.x + a.width + 8 > b.x &&
    a.y < b.y + b.height + 8 && a.y + a.height + 8 > b.y;
}

/**
 * candidates: [{id, message, x, y}], with x/y at the character's head in CSS pixels.
 * Return bubble rectangles in the same coordinates. Draw after restoring world transform.
 * The caller sets the text font before providing measureText.
 */
export function layoutSpeechBubbles(candidates, seconds, options = {}) {
  const { width = 390, height = 844, measureText = text => Array.from(text).length * 12,
    top = 70, bottom = 130, maxVisible = width < 600 ? 2 : 3 } = options;
  const maxWidth = Math.min(190, width - 24);
  const availableHeight = height - top - bottom;
  if (maxWidth < 50 || availableHeight < 44 || maxVisible <= 0) return [];
  const visible = [];
  const ordered = candidates.map(guest => ({ guest, timing: speechTiming(guest.id, seconds) }))
    .filter(({ guest, timing }) => timing.visible && String(guest.message || '').trim() &&
      Number.isFinite(guest.x) && Number.isFinite(guest.y) && guest.x >= 0 && guest.x <= width &&
      guest.y >= top + 22 && guest.y <= height - bottom + 70)
    .sort((a, b) => a.timing.startedAt - b.timing.startedAt || String(a.guest.id).localeCompare(String(b.guest.id)));
  for (const { guest, timing } of ordered) {
    const lines = wrapMessage(guest.message, maxWidth - 24, measureText);
    if (!lines.length) continue;
    const bubbleWidth = Math.min(maxWidth, Math.max(72, ...lines.map(measureText)) + 24);
    const bubbleHeight = lines.length * 17 + 18;
    if (bubbleHeight > availableHeight) continue;
    const x = Math.max(12, Math.min(width - bubbleWidth - 12, guest.x - bubbleWidth / 2));
    const y = Math.max(top, Math.min(height - bottom - bubbleHeight, guest.y - bubbleHeight - 10));
    const bubble = { id: guest.id, x, y, width: bubbleWidth, height: bubbleHeight, lines,
      tailX: Math.max(x + 12, Math.min(x + bubbleWidth - 12, guest.x)), age: timing.age };
    if (visible.some(other => overlaps(bubble, other))) continue;
    visible.push(bubble);
    if (visible.length >= maxVisible) break;
  }
  return visible;
}
