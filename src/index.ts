/**
 * CMI (Centre Monétique Interbancaire) Payment Gateway Integration for Node.js / Next.js / TypeScript.
 *
 * Official Open-Source Package by TripleW Digital - Agence Web & SEO au Maroc (https://triplew.ma)
 * Documentation & Guide: https://triplew.ma/blog/integration-paiement-cmi-maroc
 */

import * as crypto from 'crypto';
import {
  CMIConfig,
  CMICurrency,
  CMIGatewayParams,
  CMILanguage,
  CMIPaymentRequest,
  CMIResponseData,
  CMITransactionType,
  CMIValidationResult
} from './types';

export * from './types';

export const CMI_GATEWAY_URLS = {
  TEST: 'https://testpayment.cmi.co.ma/fim/est3Dgate',
  PRODUCTION: 'https://payment.cmi.co.ma/fim/est3Dgate'
} as const;

/**
 * Generates the official CMI SHA-512 Base64 hash string for transaction authentication.
 * Follows the CMI V3 specification:
 * 1. Filter out `hash` and `storeKey` (or `encoding` / case-variants).
 * 2. Sort parameter keys alphabetically (case-insensitive).
 * 3. Escape backslashes `\` and pipes `|` with a backslash.
 * 4. Concatenate each parameter value followed by a pipe `|`.
 * 5. Append the escaped storeKey.
 * 6. Calculate SHA-512 and encode as Base64.
 */
export function generateCMIHash(
  params: Record<string, string | undefined>,
  storeKey: string
): string {
  const sortedKeys = Object.keys(params)
    .filter(
      (key) =>
        key.toLowerCase() !== 'hash' &&
        key.toLowerCase() !== 'storekey' &&
        key.toLowerCase() !== 'encoding' &&
        params[key] !== undefined &&
        params[key] !== null
    )
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let hashval = '';
  for (const key of sortedKeys) {
    const rawVal = String(params[key]);
    const escapedVal = rawVal.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    hashval += escapedVal + '|';
  }

  const storeKeyEscaped = storeKey.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  hashval += storeKeyEscaped;

  return crypto.createHash('sha512').update(hashval, 'utf8').digest('base64');
}

/**
 * Validates the hash returned by CMI against our calculated hash to verify authenticity.
 */
export function verifyCMIResponseHash(
  responseParams: Record<string, string | undefined>,
  storeKey: string
): boolean {
  const receivedHash = responseParams.HASH || responseParams.hash;
  if (!receivedHash) {
    return false;
  }

  const calculatedHash = generateCMIHash(responseParams, storeKey);
  return crypto.timingSafeEqual(
    Buffer.from(receivedHash, 'utf8'),
    Buffer.from(calculatedHash, 'utf8')
  );
}

/**
 * Client class for CMI Payment Gateway.
 */
export class CMIGateway {
  private readonly clientId: string;
  private readonly storeKey: string;
  private readonly isProduction: boolean;
  private readonly okUrl: string;
  private readonly failUrl: string;
  private readonly callbackUrl?: string;
  private readonly shopUrl?: string;
  private readonly currency: CMICurrency;
  private readonly lang: CMILanguage;

  constructor(config: CMIConfig) {
    if (!config.clientId || !config.storeKey) {
      throw new Error('[TripleW CMI] Both clientId and storeKey are required.');
    }
    this.clientId = config.clientId;
    this.storeKey = config.storeKey;
    this.isProduction = config.isProduction ?? false;
    this.okUrl = config.okUrl;
    this.failUrl = config.failUrl;
    this.callbackUrl = config.callbackUrl;
    this.shopUrl = config.shopUrl;
    this.currency = config.currency ?? '504';
    this.lang = config.lang ?? 'fr';
  }

  /**
   * Returns the appropriate CMI Gateway URL.
   */
  public getGatewayUrl(): string {
    return this.isProduction ? CMI_GATEWAY_URLS.PRODUCTION : CMI_GATEWAY_URLS.TEST;
  }

  /**
   * Creates a full set of POST parameters with the computed SHA-512 hash ready for submission.
   */
  public createPaymentParams(options: {
    orderId: string;
    amount: number | string;
    email?: string;
    billToName?: string;
    tel?: string;
    transactionType?: CMITransactionType;
    extraParams?: Record<string, string>;
  }): CMIGatewayParams {
    const formattedAmount = typeof options.amount === 'number'
      ? options.amount.toFixed(2)
      : parseFloat(options.amount).toFixed(2);

    const rnd = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    const params: Record<string, string | undefined> = {
      clientid: this.clientId,
      amount: formattedAmount,
      okUrl: this.okUrl,
      failUrl: this.failUrl,
      TranType: options.transactionType ?? 'Auth',
      currency: this.currency,
      rnd: rnd,
      storeKey: this.storeKey,
      hashAlgorithm: 'ver3',
      lang: this.lang,
      ...(this.callbackUrl ? { callbackUrl: this.callbackUrl } : {}),
      ...(this.shopUrl ? { shopurl: this.shopUrl } : {}),
      ...(options.email ? { email: options.email } : {}),
      ...(options.billToName ? { BillToName: options.billToName } : {}),
      ...(options.tel ? { tel: options.tel } : {}),
      ...options.extraParams
    };

    const hash = generateCMIHash(params, this.storeKey);

    const cleanParams: CMIGatewayParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'storeKey' && value !== undefined) {
        cleanParams[key] = value;
      }
    }
    cleanParams.HASH = hash;

    return cleanParams;
  }

  /**
   * Generates an auto-submitting HTML form for server-side redirects (Express, Fastify, Next.js Pages/App Router).
   */
  public createAutoSubmitHtml(params: CMIGatewayParams): string {
    const gatewayUrl = this.getGatewayUrl();
    const inputFields = Object.entries(params)
      .map(([key, val]) => `    <input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(val)}" />`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="${this.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirection vers le paiement sécurisé CMI...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    .loader { text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .spinner { border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Connexion sécurisée au Centre Monétique Interbancaire...</p>
    <form id="cmiForm" action="${gatewayUrl}" method="POST">
${inputFields}
      <noscript>
        <button type="submit" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer;">Continuer vers CMI</button>
      </noscript>
    </form>
  </div>
  <script>
    document.getElementById('cmiForm').submit();
  </script>
</body>
</html>`;
  }

  /**
   * Validates IPN (Server-to-Server) or Return Callback payload from CMI.
   */
  public handleCallback(body: Record<string, string | undefined>): CMIValidationResult {
    const isValidHash = verifyCMIResponseHash(body, this.storeKey);
    const isApproved = isValidHash && (body.ProcReturnCode === '00' || body.Response === 'Approved');

    return {
      isValid: isValidHash,
      isApproved,
      orderId: body.oid,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      transactionId: body.TransId,
      authCode: body.AuthCode,
      errorCode: body.ProcReturnCode !== '00' ? body.ProcReturnCode : undefined,
      errorMessage: body.ErrMsg || (isApproved ? undefined : 'Paiement refusé ou non validé'),
      raw: body as CMIResponseData
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
