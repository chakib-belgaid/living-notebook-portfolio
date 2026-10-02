import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundMix } from '../src/soundscape.ts';
import { presets } from '../src/weather.ts';

const at = (over = {}) => soundMix({ growth: 1, hour: 13, night: 0, weather: presets.clear, season: 'summer', spot: null, narrating: false, ...over });
const layers = ['water', 'wind', 'rain', 'birds', 'chorus', 'crickets', 'thunder', 'rainPiano', 'morningPiano', 'level'];

test('every layer stays between silence and full', () => {
  for (const growth of [0, 0.33, 0.66, 1])
    for (const [hour, night] of [[5, 1], [7.5, 0], [13, 0], [22, 1]])
      for (const weather of Object.values(presets))
        for (const season of ['spring', 'summer', 'autumn', 'winter']) {
          const mix = at({ growth, hour, night, weather, season });
          for (const k of layers) assert.ok(mix[k] >= 0 && mix[k] <= 1, `${k} ${mix[k]} at ${growth} ${hour} ${weather.kind} ${season}`);
        }
});

test('the sketch is only a breeze; water comes with the stone and life with Bloom', () => {
  const sketch = at({ growth: 0 });
  assert.ok(sketch.wind > 0);
  assert.equal(sketch.water, 0);
  assert.equal(sketch.birds, 0);
  assert.equal(at({ growth: 0.33 }).water, 0, 'no water in the blueprint');
  assert.ok(at({ growth: 0.66 }).water > 0.5, 'the waterfall runs at Build');
  assert.equal(at({ growth: 0.66 }).birds, 0, 'birds wait for Bloom');
  assert.ok(at().birds > 0.5);
});

test('birds sing by day and crickets by night, not in winter', () => {
  assert.equal(at().crickets, 0);
  assert.equal(at({ night: 1 }).birds, 0);
  assert.ok(at({ night: 1 }).crickets > 0.5);
  assert.equal(at({ night: 1, season: 'winter' }).crickets, 0);
  assert.ok(at({ season: 'winter' }).birds < at().birds, 'fewer birds in winter');
});

test('rain falls with the weather, snow is quiet, and only a storm thunders', () => {
  assert.equal(at().rain, 0);
  assert.ok(at({ weather: presets.rain }).rain > at({ weather: presets.drizzle }).rain);
  assert.ok(at({ weather: presets.rain }).birds < at().birds / 2, 'birds shelter from rain');
  assert.equal(at({ weather: presets.snow }).rain, 0);
  assert.equal(at({ weather: presets.storm }).thunder, 1);
  assert.equal(at({ weather: presets.rain }).thunder, 0);
  assert.ok(at({ weather: presets.storm }).wind > at({ weather: presets.fog }).wind);
});

test('the water is louder beside the canal than at the far pavilion', () => {
  assert.ok(at({ spot: 'wattch' }).water > at({ spot: 'whisperbook' }).water);
  assert.ok(at({ spot: 'contact' }).water > at({ spot: 'whisperbook' }).water);
});

test('the garden steps back while Whisperbook reads', () => {
  assert.equal(at().level, 1);
  assert.ok(at({ narrating: true }).level <= 0.3);
});

test('a sunny morning brings the birds out in chorus', () => {
  const morning = at({ hour: 7.5 });
  assert.ok(morning.birds > at().birds, 'more birds than at midday');
  assert.ok(morning.chorus > 0.9);
  assert.equal(at().chorus, 0, 'midday is calmer');
  assert.equal(at({ hour: 7.5, weather: presets.cloudy }).chorus, 0, 'not under an overcast sky');
  assert.equal(at({ hour: 7.5, weather: presets.fog }).chorus, 0);
  assert.ok(at({ hour: 7.5, weather: presets.partly }).chorus > 0.9, 'a few clouds still count as sunny');
  assert.equal(at({ hour: 7.5, weather: presets.rain }).chorus, 0);
  assert.equal(at({ hour: 7.5, growth: 0.66 }).chorus, 0, 'the birds come with life');
});

test('the rain piano plays with the rain and the falling leaves, softly in a storm', () => {
  assert.equal(at().rainPiano, 0, 'not on a dry summer day');
  assert.ok(at({ weather: presets.rain }).rainPiano > 0.8);
  assert.ok(at({ weather: presets.drizzle }).rainPiano > 0.5);
  assert.ok(at({ weather: presets.rain, growth: 0 }).rainPiano > 0.8, 'rain on the sketch too');
  assert.ok(at({ weather: presets.storm }).rainPiano < at({ weather: presets.rain }).rainPiano);
  assert.equal(at({ weather: presets.snow }).rainPiano, 0);
  assert.ok(at({ season: 'autumn' }).rainPiano > 0.9, 'autumn leaves fall at Bloom');
  assert.equal(at({ season: 'autumn', growth: 0.66 }).rainPiano, 0, 'no leaves before Bloom');
  assert.ok(at({ season: 'autumn', night: 1, hour: 22 }).rainPiano > 0.9, 'and by night');
});

test('a sunny morning has its own piano, which takes over from the leaves', () => {
  assert.ok(at({ hour: 7.5 }).morningPiano > 0.9);
  assert.equal(at({ hour: 7.5 }).rainPiano, 0);
  assert.ok(at({ hour: 7.5, growth: 0 }).morningPiano > 0.9, 'a sunny morning on the sketch too');
  assert.ok(at({ hour: 7.5, weather: presets.partly }).morningPiano > 0.9);
  assert.equal(at().morningPiano, 0, 'not at midday');
  assert.equal(at({ hour: 7.5, weather: presets.cloudy }).morningPiano, 0, 'not under an overcast sky');
  const rainy = at({ hour: 7.5, weather: presets.rain });
  assert.equal(rainy.morningPiano, 0);
  assert.ok(rainy.rainPiano > 0.8, 'a rainy morning keeps the rain piano');
  const autumn = at({ hour: 7.5, season: 'autumn' });
  assert.ok(autumn.morningPiano > 0.9);
  assert.ok(autumn.rainPiano < 0.05, 'one piece at a time');
  assert.ok(at({ season: 'autumn' }).rainPiano > 0.9, 'the leaves have the rest of the day');
});
