import { getSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";

let initialized = false;

export async function ensureOutboundProxyInitialized() {
  if (initialized) return true;

  try {
    const settings = await getSettings();
    applyOutboundProxyEnv(settings);
    initialized = true;
  } catch (error) {
    console.error("[ServerInit] Error initializing outbound proxy:", error);
  }

  return initialized;
}

// Auto-initialize when module loads
if (typeof process !== 'undefined' && 
    process.env.NODE_ENV === 'production' && 
    (process.env.NEXT_PHASE === 'phase-production-build' || 
     process.argv.some(arg => arg.includes('next-render-worker') || arg.includes('next-path-fetcher')))) {
  // Skip auto-initialization during build/pre-render
} else {
  ensureOutboundProxyInitialized().catch(console.log);
}

export default ensureOutboundProxyInitialized;
