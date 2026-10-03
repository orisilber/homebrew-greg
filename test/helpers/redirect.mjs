// Exercise the built CLI over real local HTTP. Never send a fixture key elsewhere.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const requested = new URL(input instanceof Request ? input.url : input);
  const fixture = new URL(process.env.GREG_FIXTURE_URL);
  if (fixture.hostname !== '127.0.0.1') throw new Error('Fixture must be local.');
  if (!['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'openrouter.ai'].includes(requested.hostname)) {
    throw new Error('Unexpected provider URL.');
  }
  return originalFetch(fixture, init);
};
