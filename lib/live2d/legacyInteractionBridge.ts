import type { Application } from 'pixi.js';

export type LegacyInteractionEvent = {
  data: { global: { x: number; y: number } };
};

export type LegacyInteractionManager = {
  on: (
    event: string,
    fn: (event: LegacyInteractionEvent) => void,
    context?: unknown
  ) => LegacyInteractionManager;
  off: (
    event: string,
    fn: (event: LegacyInteractionEvent) => void,
    context?: unknown
  ) => LegacyInteractionManager;
};

export function createLegacyInteractionManager(app: Application): LegacyInteractionManager {
  const handlers = new Map<
    (event: LegacyInteractionEvent) => void,
    (event: { global: { x: number; y: number } }) => void
  >();

  return {
    off(event, fn) {
      if (event !== 'pointermove') return this;
      const wrapped = handlers.get(fn);
      if (wrapped) {
        app.stage.off('globalpointermove', wrapped);
        handlers.delete(fn);
      }
      return this;
    },
    on(event, fn, context) {
      if (event !== 'pointermove') return this;
      if (handlers.has(fn)) return this;

      const wrapped = (pixiEvent: { global: { x: number; y: number } }) => {
        fn.call(context, { data: { global: pixiEvent.global } });
      };

      handlers.set(fn, wrapped);
      app.stage.on('globalpointermove', wrapped);
      return this;
    },
  };
}

export function attachLegacyInteractionBridge(app: Application): void {
  const legacyInteraction = createLegacyInteractionManager(app);
  const renderer = app.renderer as Application['renderer'] & {
    events?: Record<string, unknown>;
  };

  if (!renderer.events) return;

  if (typeof renderer.events.on !== 'function') {
    renderer.events.on = legacyInteraction.on.bind(legacyInteraction);
  }
  if (typeof renderer.events.off !== 'function') {
    renderer.events.off = legacyInteraction.off.bind(legacyInteraction);
  }
}
