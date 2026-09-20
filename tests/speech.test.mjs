import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEECH_VISIBLE_SECONDS, SPEECH_FADE_SECONDS, speechDuration,
  createSpeechScheduler, layoutSpeechBubbles } from '../public/speech.js';

const guest = (id, x = 150, y = 250, message = '결혼을 축하해요!') => ({ id, x, y, message });

test('a selected message remains readable for 6–7 seconds with gentle fades', () => {
  assert.equal(SPEECH_VISIBLE_SECONDS, 6);
  assert.ok(SPEECH_FADE_SECONDS >= .35 && SPEECH_FADE_SECONDS <= .5);
  assert.equal(speechDuration('축하해요'), 6);
  assert.ok(speechDuration('두 분의 결혼을 축하해요! 앞으로도 항상 행복하고 건강한 날들 보내세요.') > 6.8);
  assert.ok(speechDuration('긴 메시지 '.repeat(30)) <= 7);
  const scheduler = createSpeechScheduler(), people = [guest('a')];
  assert.deepEqual(scheduler.getLayout(people, 0), []);
  const start = scheduler.getLayout(people, .6)[0];
  assert.equal(start.opacity, 0);
  assert.ok(Math.abs(scheduler.getLayout(people, .8)[0].opacity - .5) < .001);
  assert.equal(scheduler.getLayout(people, 3)[0].opacity, 1);
  assert.equal(scheduler.getLayout(people, 6)[0].id, 'a');
  assert.ok(scheduler.getLayout(people, 6.4)[0].opacity < .6);
  assert.deepEqual(scheduler.getLayout(people, 6.61), []);
  assert.deepEqual(scheduler.getLayout(people, 10), []);
  assert.equal(scheduler.getLayout(people, 15)[0].id, 'a');
});

test('new messages are staggered instead of bursting into every slot at once', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a', 150), guest('b', 400), guest('c', 670)];
  const options = { width: 1280, height: 600 };
  assert.equal(scheduler.getLayout(people, .6, options).length, 1);
  assert.equal(scheduler.getLayout(people, 1.4, options).length, 1);
  assert.equal(scheduler.getLayout(people, 2.41, options).length, 2);
  assert.equal(scheduler.getLayout(people, 4.22, options).length, 3);
  assert.equal(scheduler.getLayout(people, 5, options).length, 3);
});

test('moving collisions and candidate reordering never replace a message halfway through', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a', 70, 240), guest('b', 280, 360), guest('c', 160, 480)];
  scheduler.getLayout(people, .6);
  const selected = scheduler.getLayout(people, 2.41).map(bubble => bubble.id).sort();
  assert.equal(selected.length, 2);
  for (let frame = 0; frame < 180; frame++) {
    const moving = people.map(person => ({ ...person, x: 190 + frame % 3, y: 320 + frame % 2 }));
    if (frame % 2) moving.reverse();
    const current = scheduler.getLayout(moving, 2.5 + frame / 60);
    assert.deepEqual(current.map(bubble => bubble.id).sort(), selected);
    assert.ok(current.every(bubble => bubble.opacity === 1 || bubble.startedAt === 2.41));
  }
});

test('offscreen and deleted speakers release their slots without immediate reappearance', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a')];
  scheduler.getLayout(people, .6);
  assert.deepEqual(scheduler.getLayout([guest('a', -20)], 2), []);
  assert.deepEqual(scheduler.getLayout(people, 2.1), []);
  assert.deepEqual(scheduler.getLayout([], 3), []);
  assert.equal(scheduler.getLayout([guest('new')], 5)[0].id, 'new');
});

test('stable speakers and collision offsets follow moving guest anchors instead of sticking to the screen', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a', 250, 250), guest('b', 250, 250)];
  const options = { width: 1280, height: 844, maxVisible: 2 };
  scheduler.getLayout(people, .6, options);
  const initial = scheduler.getLayout(people, 2.41, options);
  assert.equal(initial.length, 2);
  assert.notEqual(initial[0].y, initial[1].y, 'one bubble must have a collision avoidance offset');
  const byId = new Map(initial.map(bubble => [bubble.id, bubble]));
  for (let frame = 1; frame <= 180; frame++) {
    const dx = frame, dy = frame / 3;
    const moving = people.map(person => ({ ...person, x: person.x + dx, y: person.y + dy }));
    const current = scheduler.getLayout(moving, 2.41 + frame / 60, options);
    assert.deepEqual(current.map(bubble => bubble.id), initial.map(bubble => bubble.id));
    for (const bubble of current) {
      const start = byId.get(bubble.id);
      assert.equal(bubble.startedAt, start.startedAt);
      assert.ok(Math.abs(bubble.x - start.x - dx) < .0001);
      assert.ok(Math.abs(bubble.y - start.y - dy) < .0001);
      assert.ok(Math.abs(bubble.tailX - start.tailX - dx) < .0001);
    }
  }
});

test('smaller viewports cap visible count and keep boxes inside usable screen bounds', () => {
  const scheduler = createSpeechScheduler();
  const people = Array.from({ length: 20 }, (_, i) => guest(`g-${i}`, 20 + i % 4 * 90, 180 + Math.floor(i / 4) * 55,
    '두 분의 결혼을 축하해요! 앞으로도 행복하세요 ♡'));
  let shown = 0;
  for (let time = 0; time < 35; time += .1) {
    const bubbles = scheduler.getLayout(people, time, { width: 320, height: 568 });
    shown += bubbles.length;
    assert.ok(bubbles.length <= 2);
    for (const bubble of bubbles) {
      assert.ok(bubble.x >= 12 && bubble.x + bubble.width <= 308);
      assert.ok(bubble.y >= 70 && bubble.y + bubble.height <= 438);
      assert.ok(bubble.opacity >= 0 && bubble.opacity <= 1);
    }
  }
  assert.ok(shown > 200);
  assert.ok(scheduler.getLayout(people, 36, { maxVisible: 1 }).length <= 1);
  assert.deepEqual(scheduler.getLayout(people, 37, { width: 20, height: 20 }), []);
});

test('reduced motion keeps the same reading duration and waiting schedule without fades', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a')], options = { reduced: true };
  const start = scheduler.getLayout(people, .6, options)[0];
  assert.equal(start.opacity, 1);
  assert.equal(start.duration, 6);
  assert.equal(scheduler.getLayout(people, 6.5, options)[0].opacity, 1);
  assert.deepEqual(scheduler.getLayout(people, 6.7, options), []);
});

test('pure geometry skips empty/offscreen messages and leaves landscape controls clear', () => {
  const bubbles = layoutSpeechBubbles([guest('a', 420, 150), guest('b', 200, 150, ''), guest('c', -10, 150)], 0,
    { width: 844, height: 390, top: 60, bottom: 92 });
  assert.equal(bubbles.length, 1);
  assert.ok(bubbles[0].y + bubbles[0].height <= 298);
});

test('reset or a restarted scene clock starts a fresh schedule', () => {
  const scheduler = createSpeechScheduler(), people = [guest('a')];
  scheduler.getLayout(people, 10);
  assert.deepEqual(scheduler.getLayout(people, 0), []);
  assert.equal(scheduler.getLayout(people, .6)[0].age, 0);
  scheduler.reset();
  assert.deepEqual(scheduler.getLayout(people, .1), []);
});
