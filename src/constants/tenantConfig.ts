// Baked-in fallback, used if /tenant-config.json can't be fetched at runtime
// (offline, native platforms, invalid override file, or no bind mount
// present). Represents generic, unbranded "Resgrid" - no watermark.
// See public/tenant-config.json for the editable runtime copy shipped in the
// shared image, and the per-tenant override bind-mounted by deploy.sh.
export interface TenantConfig {
  tenantId: string;
  displayName: string;
  watermarkImageUrl?: string;
  // Reserved for future tenant-specific behavior toggles - no flags are
  // defined or consumed yet.
  featureFlags?: Record<string, boolean>;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  tenantId: 'default',
  displayName: 'Resgrid',
  featureFlags: {},
};
