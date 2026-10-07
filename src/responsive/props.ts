import type { Component } from 'grapesjs';
import type { TierOverrides } from './breakpoints';

/** Component property holding the per-tier overrides. */
export const RESPONSIVE_PROP = 'responsive';
/** Root `mjml` component property holding the breakpoints. */
export const BREAKPOINTS_PROP = 'responsive-breakpoints';
/** Tier, breakpoints or overrides changed. */
export const evResponsiveUpdate = 'mjml:responsive:update';

export const getOverrides = (cmp: Component): TierOverrides => cmp.get(RESPONSIVE_PROP) || {};
