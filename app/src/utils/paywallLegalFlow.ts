type ReopenFn = () => void;

let armedReopen: ReopenFn | null = null;

/** Call before closing the paywall so returning from Terms/Privacy can reopen it. */
export function armPaywallReopenAfterLegal(fn: ReopenFn) {
  armedReopen = fn;
}

export function disarmPaywallReopenAfterLegal() {
  armedReopen = null;
}

/** Invoke when the legal sheet is dismissed (back, swipe, or header close). */
export function completePaywallLegalFlow() {
  const fn = armedReopen;
  armedReopen = null;
  fn?.();
}
