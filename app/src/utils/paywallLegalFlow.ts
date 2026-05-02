type ReopenFn = () => void;

let armedReopen: ReopenFn | null = null;

export function armPaywallReopenAfterLegal(fn: ReopenFn) {
  armedReopen = fn;
}

export function disarmPaywallReopenAfterLegal() {
  armedReopen = null;
}

export function completePaywallLegalFlow() {
  const fn = armedReopen;
  armedReopen = null;
  fn?.();
}
