import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_TENANT_CONFIG, type TenantConfig } from '@/constants/tenantConfig';

let cachedConfig: TenantConfig | null = null;
let inFlight: Promise<TenantConfig> | null = null;

function isValidTenantConfig(value: unknown): value is TenantConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.tenantId !== 'string' || typeof v.displayName !== 'string') return false;
  if (v.watermarkImageUrl !== undefined && typeof v.watermarkImageUrl !== 'string') return false;
  if (v.featureFlags !== undefined && (typeof v.featureFlags !== 'object' || v.featureFlags === null)) return false;
  return true;
}

function loadTenantConfig(): Promise<TenantConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (!inFlight) {
    inFlight = fetch('/tenant-config.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('tenant-config.json not found'))))
      .then((data) => (isValidTenantConfig(data) ? data : Promise.reject(new Error('tenant-config.json has an invalid shape'))))
      .catch(() => DEFAULT_TENANT_CONFIG)
      .then((config) => {
        cachedConfig = config;
        return config;
      });
  }
  return inFlight;
}

// Loads tenant branding config from /tenant-config.json at runtime so one
// Docker image can serve N branded tenants without a rebuild (see
// public/tenant-config.json and nginx.conf's no-cache rule for it). Falls
// back to DEFAULT_TENANT_CONFIG (generic Resgrid branding, no watermark) on
// native platforms or if the fetch/parse fails.
export function useTenantConfig(): TenantConfig {
  const [config, setConfig] = useState<TenantConfig>(cachedConfig ?? DEFAULT_TENANT_CONFIG);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let isMounted = true;
    loadTenantConfig().then((loaded) => {
      if (isMounted) setConfig(loaded);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return config;
}
