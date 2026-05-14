import type { KoiVariety, Palette } from '../types';

export const PALETTES: Record<KoiVariety, Palette> = {
  kohaku:   { base: '#f3ead2', baseLight: '#fbf6e6', marks: ['#d8602a', '#c14e1f'] },
  sanke:    { base: '#f3ead2', baseLight: '#fbf6e6', marks: ['#d8602a', '#3a342d'] },
  showa:    { base: '#3a342d', baseLight: '#4b443c', marks: ['#d8602a', '#f0e5cc'] },
  asagi:    { base: '#9aafb6', baseLight: '#b7c7cd', marks: ['#c26832', '#f0e5cc'] },
  utsuri:   { base: '#3a342d', baseLight: '#4b443c', marks: ['#d4a85a'] },
  ogon:     { base: '#d8c890', baseLight: '#ead8a3', marks: [] },
  platinum: { base: '#e2dbc4', baseLight: '#efe9d6', marks: [] }
};

export const VARIETIES: KoiVariety[] = Object.keys(PALETTES) as KoiVariety[];
