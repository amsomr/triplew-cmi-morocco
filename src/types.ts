/**
 * Types and interfaces for the CMI (Centre Monétique Interbancaire) Morocco Payment Gateway.
 * Developed and maintained by TripleW Digital (https://triplew.ma)
 */

export type CMITransactionType = 'Auth' | 'PreAuth';

export type CMICurrency = '504'; // 504 = Moroccan Dirham (MAD) ISO 4217 code

export type CMILanguage = 'fr' | 'ar' | 'en';

export interface CMIConfig {
  clientId: string;
  storeKey: string;
  isProduction?: boolean;
  okUrl: string;
  failUrl: string;
  callbackUrl?: string;
  shopUrl?: string;
  currency?: CMICurrency;
  lang?: CMILanguage;
}

export interface CMIPaymentRequest {
  clientid: string;
  amount: string;
  okUrl: string;
  failUrl: string;
  TranType: CMITransactionType;
  currency: CMICurrency;
  rnd: string;
  storeKey: string;
  hashAlgorithm?: 'ver3';
  lang?: CMILanguage;
  BillToName?: string;
  BillToCompany?: string;
  BillToStreet1?: string;
  BillToCity?: string;
  BillToPostalCode?: string;
  BillToCountry?: string;
  email?: string;
  tel?: string;
  shopurl?: string;
  callbackUrl?: string;
  [key: string]: string | undefined;
}

export interface CMIGatewayParams {
  [key: string]: string;
}

export interface CMIResponseData {
  clientid?: string;
  oid?: string;
  amount?: string;
  currency?: string;
  ProcReturnCode?: string; // '00' = Success
  Response?: string; // 'Approved' = Success
  AuthCode?: string;
  TransId?: string;
  mdStatus?: string; // '1' = Fully authenticated 3D Secure
  EXTRA_TRXDATE?: string;
  HASH?: string;
  [key: string]: string | undefined;
}

export interface CMIValidationResult {
  isValid: boolean;
  isApproved: boolean;
  orderId?: string;
  amount?: number;
  transactionId?: string;
  authCode?: string;
  errorCode?: string;
  errorMessage?: string;
  raw: CMIResponseData;
}
