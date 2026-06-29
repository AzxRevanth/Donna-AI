export type EnvironmentType = 'local' | 'deployed' | 'preview' | 'unknown';

export function getEnvironment(): EnvironmentType {
  try {
    const hostname = window.location.hostname;
    const isIframe = window !== window.top;

    if (isIframe) {
      return 'preview';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'local';
    }
    if (hostname.endsWith('.run.app') || hostname.includes('run.app')) {
      return 'deployed';
    }
    return 'deployed'; // Default to deployed for production behavior when running standalone
  } catch (err) {
    return 'unknown';
  }
}

export const ENV = getEnvironment();
