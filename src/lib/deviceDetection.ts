/**
 * Device detection utilities for security and UX purposes
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
  
  // Check screen size and touch capability
  const isSmallScreen = window.innerWidth < 768;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Mobile if matches user agent OR (small screen AND touch device)
  return mobileRegex.test(userAgent) || (isSmallScreen && isTouchDevice);
}

export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;
  
  // Also check screen size (tablets are typically 768px - 1024px wide)
  const width = window.innerWidth;
  const isTabletSize = width >= 768 && width <= 1024;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return tabletRegex.test(userAgent) || (isTabletSize && isTouchDevice && !isMobileDevice());
}

export function isDesktopDevice(): boolean {
  return !isMobileDevice() && !isTabletDevice();
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
}

export function getDeviceInfo(): {
  type: 'mobile' | 'tablet' | 'desktop';
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
  platform: string;
} {
  if (typeof window === 'undefined') {
    return {
      type: 'desktop',
      userAgent: '',
      screenWidth: 0,
      screenHeight: 0,
      isTouchDevice: false,
      platform: '',
    };
  }

  return {
    type: getDeviceType(),
    userAgent: navigator.userAgent || '',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    platform: navigator.platform || '',
  };
}

