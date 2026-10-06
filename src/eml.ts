import { downloadFile } from './exportFiles';

/**
 * Minimal RFC 5322 / MIME builder for downloading the compiled email as
 * a `.eml` file (opens in Outlook, Thunderbird, Apple Mail, …).
 *
 * Body is base64 (`Content-Transfer-Encoding: base64`, 76-char lines per
 * RFC 2045) so long MJML-HTML lines and non-ASCII content survive.
 */

export interface EmlOptions {
  /** `From:` header. @default 'sender@example.com' */
  from?: string;
  /** `To:` header. @default 'recipient@example.com' */
  to?: string;
  /** `Subject:` header. @default 'Email' */
  subject?: string;
  /** Download filename. @default 'template.eml' */
  filename?: string;
}

export const EML_DEFAULTS = {
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email',
  filename: 'template.eml',
} as const;

/** Strip CR/LF to block header injection via option values. */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[]);
  }
  return btoa(binary);
}

/** RFC 2047-encode subjects containing non-ASCII characters. */
export function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
}

export function buildEml(html: string, opts: EmlOptions = {}, date = new Date()): string {
  const from = sanitizeHeader(opts.from ?? EML_DEFAULTS.from);
  const to = sanitizeHeader(opts.to ?? EML_DEFAULTS.to);
  const subject = sanitizeHeader(opts.subject ?? EML_DEFAULTS.subject);
  const messageId = `<${date.getTime()}.${Math.random().toString(36).slice(2)}@mjml-gui>`;
  const body = utf8ToBase64(html).replace(/.{1,76}/g, '$&\r\n').replace(/\r\n$/, '');

  return (
    [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      `Date: ${date.toUTCString()}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      body,
    ].join('\r\n') + '\r\n'
  );
}

export function downloadEml(eml: string, filename: string) {
  downloadFile(eml, filename, 'message/rfc822');
}
