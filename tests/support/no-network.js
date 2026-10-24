// Current provider calls all use fetch. Fail closed if offline mode regresses.
globalThis.fetch = async () => {
  throw new Error("External fetch is disabled in the offline regression server");
};
