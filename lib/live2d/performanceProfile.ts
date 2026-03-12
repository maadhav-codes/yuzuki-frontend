export type PerformanceProfile = {
  resolutionCap: number;
  maxFPS: number;
};

export function getPerformanceProfile(): PerformanceProfile {
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isSmallViewport = window.innerWidth <= 768;
  const isMobile = isCoarsePointer || isSmallViewport;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const isLowEnd = memory <= 4 || cores <= 4;
  const isHighEndDesktop = !isMobile && memory >= 8 && cores >= 8;

  if (isMobile && isLowEnd) {
    return { maxFPS: 45, resolutionCap: 1.1 };
  }

  if (isMobile) {
    return { maxFPS: 50, resolutionCap: 1.25 };
  }

  if (isHighEndDesktop) {
    return { maxFPS: 60, resolutionCap: 1.75 };
  }

  return { maxFPS: 60, resolutionCap: 1.5 };
}
