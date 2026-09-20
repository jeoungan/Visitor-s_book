import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEECH_VISIBLE_SECONDS, speechTiming, layoutSpeechBubbles } from '../public/speech.js';

test('each automatic message lasts 2–3 seconds and then rests before repeating', () => {
  for (const id of ['visitor', 'guest-1', '신랑친구', 'guest-500']) {
    const timing = speechTiming(id, 0);
    assert.ok(SPEECH_VISIBLE_SECONDS >= 2 && SPEECH_VISIBLE_SECONDS <= 3);
    assert.equal(timing.visible, false);
    assert.equal(speechTiming(id, timing.initialDelay + .01).visible, true);
    assert.equal(speechTiming(id, timing.initialDelay + 2.59).visible, true);
    assert.equal(speechTiming(id, timing.initialDelay + 2.61).visible, false);
    assert.ok(timing.gap >= 4);
    assert.equal(speechTiming(id, timing.initialDelay + timing.period + .01).visible, true);
  }
});

test('message schedules are staggered and stable when guest list order changes', () => {
  const delays = Array.from({ length: 24 }, (_, index) => speechTiming(`guest-${index}`, 3).initialDelay);
  assert.ok(new Set(delays).size > 20);
  assert.deepEqual(speechTiming('guest-2', 10), speechTiming('guest-2', 10));
});

test('automatic messages stay inside narrow screen bounds and avoid each other', () => {
  const guests = Array.from({ length: 40 }, (_, index) => ({
    id: `guest-${index}`, message: '두 분의 결혼을 축하해요! 앞으로도 행복하세요 ♡',
    x: 15 + index % 4 * 95, y: 180 + Math.floor(index / 4) * 55,
  }));
  let shown = 0;
  for (let time = 0; time < 30; time += .1) {
    const bubbles = layoutSpeechBubbles(guests, time, { width: 320, height: 568 });
    shown += bubbles.length;
    assert.ok(bubbles.length <= 2);
    for (const bubble of bubbles) {
      assert.ok(bubble.x >= 12 && bubble.x + bubble.width <= 308);
      assert.ok(bubble.y >= 70 && bubble.y + bubble.height <= 438);
      assert.ok(bubble.lines.length >= 1);
    }
    if (bubbles.length === 2) {
      const [a, b] = bubbles;
      assert.ok(a.x + a.width + 8 <= b.x || b.x + b.width + 8 <= a.x ||
        a.y + a.height + 8 <= b.y || b.y + b.height + 8 <= a.y);
    }
  }
  assert.ok(shown > 50);
});

test('empty or offscreen messages are skipped and landscape controls retain room', () => {
  const id = 'hello', time = speechTiming(id, 0).initialDelay + .5;
  const candidates = [{ id, message: '축하해요', x: 420, y: 150 },
    { id, message: '', x: 200, y: 150 }, { id, message: '화면 밖', x: -10, y: 150 }];
  const bubbles = layoutSpeechBubbles(candidates, time, { width: 844, height: 390, top: 60, bottom: 92 });
  assert.equal(bubbles.length, 1);
  assert.equal(bubbles[0].lines[0], '축하해요');
  assert.ok(bubbles[0].y + bubbles[0].height <= 298);
  assert.deepEqual(layoutSpeechBubbles(candidates, time, { width: 20, height: 20 }), []);
});
