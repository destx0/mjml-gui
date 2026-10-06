import { mjmlConvert } from '../components/utils';
import type { MjmlParser } from '../components/parser';

export interface DockValidation {
  errors: any[];
  html: string;
}

/**
 * Validate MJML through the configured parser (default: mjml-browser).
 * Returns raw `errors` plus compiled `html`.
 */
export function validateMjml(
  parser: MjmlParser,
  mjml: string,
  fonts: Record<string, any> = {},
  opts: Record<string, any> = {},
): DockValidation {
  const result = mjmlConvert(parser, mjml, fonts, opts);
  return {
    errors: result?.errors ?? [],
    html: result?.html ?? '',
  };
}

/**
 * P0 policy: every entry in mjml-browser's `errors` blocks Apply.
 * mjml v4 does not cleanly separate warnings from errors, so warnings
 * pass only when they are NOT in this list. P1 will split by severity
 * and surface line numbers as Monaco markers.
 */
export function blockingErrors(errors: any[] | undefined | null): any[] {
  return errors ?? [];
}
