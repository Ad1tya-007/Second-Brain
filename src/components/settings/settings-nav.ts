export const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'models', label: 'Models' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];
