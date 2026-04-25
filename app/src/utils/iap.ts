type IapErrorLike = {
  code?: unknown;
  message?: unknown;
  debugMessage?: unknown;
  domain?: unknown;
};

function toLowerText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function isUserCancelledPurchaseError(error: unknown): boolean {
  const err = (error || {}) as IapErrorLike;
  const code = String(err.code ?? '').toUpperCase();
  const domain = toLowerText(err.domain);
  const message = `${toLowerText(err.message)} ${toLowerText(err.debugMessage)}`;
  if (
    code === 'E_USER_CANCELLED' ||
    code === 'E_USER_CANCELED' ||
    code === 'USER_CANCELLED' ||
    code === 'USER_CANCELED' ||
    message.includes('skerrorpaymentcancelled')
  ) {
    return true;
  }
  if (domain.includes('skerrordomain') && String(err.code ?? '') === '2') {
    return true;
  }
  return /user (?:has )?cancel(?:led|ed)/.test(message) || /request (?:was )?cancel(?:led|ed)/.test(message);
}

export function getIapErrorDetails(error: unknown): Record<string, unknown> {
  const err = (error || {}) as IapErrorLike & Record<string, unknown>;
  return {
    code: err.code ?? null,
    domain: err.domain ?? null,
    message: err.message ?? null,
    debugMessage: err.debugMessage ?? null,
  };
}

