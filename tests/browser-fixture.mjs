// A fixture owns its context until setup succeeds; the test owns it afterwards.
export async function setupPage(browser, options, setup) {
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    await setup(page);
    return page;
  } catch (error) {
    // Keep the setup error even if the browser has already disconnected.
    await context.close().catch(() => {});
    throw error;
  }
}
