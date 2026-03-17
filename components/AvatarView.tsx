'use client';

import type { Application } from 'pixi.js';
import type { Live2DModel } from 'pixi-live2d-display-advanced/cubism4';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLipSync } from '@/hooks/useLipSync';
import { useTTSAudioState } from '@/hooks/useVoice';
import { attachLegacyInteractionBridge } from '@/lib/live2d/legacyInteractionBridge';
import { applyLive2DMood } from '@/lib/live2d/moodController';
import { getPerformanceProfile } from '@/lib/live2d/performanceProfile';
import { useAvatarStore } from '@/store/avatarStore';

declare global {
  interface Window {
    PIXI: typeof import('pixi.js');
  }
}

export default function AvatarView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { isSpeaking, mood } = useAvatarStore();
  const moodRef = useRef(mood);
  const isSpeakingRef = useRef(isSpeaking);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { audioElement, isPlaying } = useTTSAudioState();
  const { mouthOpenY } = useLipSync({ audioElement, isPlaying, isSpeaking });
  moodRef.current = mood;
  isSpeakingRef.current = isSpeaking;

  const setMouthOpen = useCallback((value: number) => {
    const model = modelRef.current as
      | (Live2DModel & {
          internalModel?: {
            coreModel?: {
              setParameterValueById?: (id: string, paramValue: number) => void;
            };
          };
        })
      | null;

    const coreModel = model?.internalModel?.coreModel;
    if (!coreModel?.setParameterValueById) return;

    try {
      coreModel.setParameterValueById('ParamMouthOpenY', value);
    } catch {
      // Ignore missing parameter on incompatible model assets.
    }
  }, []);

  const updateLayout = useCallback(() => {
    const app = appRef.current;
    const model = modelRef.current;
    const container = containerRef.current;
    if (!app || !model || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    app.renderer.resize(width, height);

    const widthScale = (width * 0.62) / 1200;
    const heightScale = (height * 0.88) / 2200;
    const scale = Math.min(Math.max(Math.min(widthScale, heightScale), 0.12), 0.12);
    model.scale.set(scale);
    model.anchor.set(0.5, 1);
    model.x = width / 2;
    model.y = height * 1.05;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initPixi = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const PIXI = await import('pixi.js');
      const { Live2DModel } = await import('pixi-live2d-display-advanced/cubism4');

      if (!isMounted) return;

      if (!window.PIXI) {
        window.PIXI = PIXI;
      }
      const perf = getPerformanceProfile();

      const { width, height } = container.getBoundingClientRect();
      const app = new PIXI.Application({
        autoDensity: true,
        backgroundAlpha: 0,
        height: Math.max(height, 1),
        resolution: Math.min(window.devicePixelRatio || 1, perf.resolutionCap),
        view: canvas,
        width: Math.max(width, 1),
      }) as Application;
      app.ticker.maxFPS = perf.maxFPS;

      attachLegacyInteractionBridge(app);

      appRef.current = app;

      try {
        setError(null);
        const model = await Live2DModel.from('/models/Hiyori/Hiyori.model3.json', {
          ticker: app.ticker,
        });

        if (!isMounted) {
          model.destroy();
          return;
        }

        app.stage.addChild(model);
        modelRef.current = model;
        updateLayout();
        applyLive2DMood(model, moodRef.current);
        setIsLoading(false);

        resizeObserverRef.current = new ResizeObserver(() => {
          updateLayout();
        });
        resizeObserverRef.current.observe(container);
      } catch (error) {
        setIsLoading(false);
        setError('Failed to load avatar.');
        console.error('Error loading Live2D Model:', error);
      }
    };

    initPixi();

    return () => {
      isMounted = false;

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      modelRef.current?.destroy();
      modelRef.current = null;

      if (appRef.current) {
        appRef.current.destroy(true, { children: false });
        appRef.current = null;
      }
    };
  }, [updateLayout]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    applyLive2DMood(model, mood);
  }, [mood]);

  const mouthOpenYRef = useRef(mouthOpenY);
  useEffect(() => {
    mouthOpenYRef.current = mouthOpenY;
  }, [mouthOpenY]);

  useEffect(() => {
    let raf: number | null = null;
    let lastFrameAt = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - lastFrameAt < 33) return;
      lastFrameAt = ts;

      if (!isSpeakingRef.current) {
        setMouthOpen(0.08);
        return;
      }

      setMouthOpen(mouthOpenYRef.current);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [setMouthOpen]);

  return (
    <div
      className='relative w-full h-full flex justify-center items-center bg-slate-900 rounded-lg overflow-hidden'
      ref={containerRef}
    >
      <canvas
        aria-label='Live2D avatar'
        className='block h-full w-full'
        ref={canvasRef}
        role='img'
      />
      {isLoading && !error ? (
        <div className='absolute inset-0 flex flex-col justify-end bg-slate-900/40 p-4'>
          <div className='mb-2 text-xs text-slate-300/80'>Preparing avatar...</div>
          <div className='mx-auto mb-2 flex h-52 w-36 items-end justify-center rounded-t-[999px] bg-slate-800/55'>
            <Skeleton className='h-40 w-24 rounded-t-[999px] bg-slate-700/70' />
          </div>
          <Skeleton className='mx-auto h-2 w-32 bg-slate-700/70' />
        </div>
      ) : null}
      {error ? <div className='absolute bottom-2 text-red-300 text-xs'>{error}</div> : null}
    </div>
  );
}
