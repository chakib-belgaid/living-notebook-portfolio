/** Open-Meteo, answered locally: every enhanced page looks up the weather
 * where the visitor is (src/narrative/garden-panel.ts), and tests must not
 * depend on the network or on the day's weather. 12°C and light rain in Paris. */
export const weatherFixture = {
  place: { name: 'Paris', latitude: 48.85, longitude: 2.35 },
  current: { temperature_2m: 11.6, weather_code: 61, cloud_cover: 90, wind_speed_10m: 12 },
};
export async function routeWeather(target) {
  await target.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ json: { results: [weatherFixture.place] } }));
  await target.route('**/api.open-meteo.com/**', r => r.fulfill({ json: { current: weatherFixture.current } }));
}

// A fixture owns its context until setup succeeds; the test owns it afterwards.
export async function setupPage(browser, options, setup) {
  const context = await browser.newContext(options);
  try {
    await routeWeather(context);
    const page = await context.newPage();
    await setup(page);
    return page;
  } catch (error) {
    // Keep the setup error even if the browser has already disconnected.
    await context.close().catch(() => {});
    throw error;
  }
}

/** Wait for camera, construction and one-off actions, while ambient life runs. */
export const waitForSceneSettled = page => page.waitForFunction(
  () => window.__notebookScene.state().settled,
  null,
  { timeout: 60000 },
);
