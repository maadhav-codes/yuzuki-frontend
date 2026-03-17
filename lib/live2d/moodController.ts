import type { Live2DModel } from 'pixi-live2d-display-advanced/cubism4';
import type { Mood } from '@/store/avatarStore';

type ModelWithCore = Live2DModel & {
  internalModel?: {
    coreModel?: {
      setParameterValueById?: (id: string, value: number) => void;
      getParameterValueById?: (id: string) => number;
    };
  };
};

const TRANSITION_DURATION_MS = 650;
const EASE_OUT_CUBIC = (t: number): number => 1 - (1 - t) ** 3;

interface ParamState {
  [key: string]: number;
}

function getMoodPreset(mood: Mood): ParamState {
  switch (mood) {
    case 'thinking':
      return {
        ParamAngleX: -6,
        ParamAngleY: 3,
        ParamEyeLOpen: 0.85,
        ParamEyeROpen: 0.85,
        ParamMouthOpenY: 0.05,
      };
    case 'surprised':
      return {
        ParamAngleX: 0,
        ParamAngleY: 5,
        ParamEyeLOpen: 1,
        ParamEyeROpen: 1,
        ParamMouthOpenY: 0.65,
      };
    case 'happy':
      return {
        ParamAngleX: 2,
        ParamAngleY: 0,
        ParamEyeLOpen: 1.0,
        ParamEyeROpen: 1.0,
        ParamMouthOpenY: 0.35,
      };
    case 'sad':
      return {
        ParamAngleX: -2,
        ParamAngleY: -4,
        ParamEyeLOpen: 0.8,
        ParamEyeROpen: 0.8,
        ParamMouthOpenY: 0.1,
      };
    case 'angry':
      return {
        ParamAngleX: 4,
        ParamAngleY: -2,
        ParamEyeLOpen: 0.9,
        ParamEyeROpen: 0.9,
        ParamMouthOpenY: 0.2,
      };
    case 'talking':
      return {
        ParamAngleX: 0,
        ParamAngleY: 0,
        ParamMouthOpenY: 0.0,
      };
    default:
      return {
        ParamAngleX: 0,
        ParamAngleY: 0,
        ParamEyeLOpen: 1.0,
        ParamEyeROpen: 1.0,
        ParamMouthOpenY: 0.0,
      };
  }
}

class TransitionManager {
  private startState: ParamState = {};
  private targetState: ParamState = getMoodPreset('idle');
  private startTime: number = 0;
  private isTransitioning: boolean = false;
  private currentMood: Mood = 'idle';

  constructor(private model: Live2DModel) {}

  public transitionTo(mood: Mood): void {
    const normalizedMood = mood === 'neutral' ? 'idle' : mood;

    if (this.currentMood === normalizedMood && !this.isTransitioning) return;

    this.currentMood = normalizedMood;
    this.startState = this.captureCurrentState();
    this.targetState = getMoodPreset(normalizedMood);
    this.startTime = performance.now();
    this.isTransitioning = true;
  }

  public update(): void {
    const coreModel = (this.model as ModelWithCore).internalModel?.coreModel;
    if (!coreModel?.setParameterValueById) {
      this.isTransitioning = false;
      return;
    }

    if (!this.isTransitioning) {
      for (const id in this.targetState) {
        try {
          coreModel.setParameterValueById(id, this.targetState[id]);
        } catch {
          // Ignore missing params
        }
      }
      return;
    }

    const now = performance.now();
    const elapsed = now - this.startTime;
    let progress = Math.min(elapsed / TRANSITION_DURATION_MS, 1);

    progress = EASE_OUT_CUBIC(progress);

    for (const id in this.targetState) {
      const startVal = this.startState[id] ?? 0;
      const targetVal = this.targetState[id];
      const currentVal = startVal + (targetVal - startVal) * progress;

      try {
        coreModel.setParameterValueById(id, currentVal);
      } catch {
        // Ignore missing params
      }
    }

    if (progress >= 1) {
      this.isTransitioning = false;
    }
  }

  private captureCurrentState(): ParamState {
    const coreModel = (this.model as ModelWithCore).internalModel?.coreModel;
    const state: ParamState = {};

    const paramIds = [
      'ParamAngleX',
      'ParamAngleY',
      'ParamEyeLOpen',
      'ParamEyeROpen',
      'ParamMouthOpenY',
    ];

    if (coreModel?.getParameterValueById) {
      for (const id of paramIds) {
        try {
          state[id] = coreModel.getParameterValueById(id);
        } catch {
          state[id] = 0;
        }
      }
    }
    return state;
  }

  public getCurrentMood(): Mood {
    return this.currentMood;
  }
}

const transitionManagers = new WeakMap<Live2DModel, TransitionManager>();

function getManager(model: Live2DModel): TransitionManager {
  let manager = transitionManagers.get(model);
  if (!manager) {
    manager = new TransitionManager(model);
    transitionManagers.set(model, manager);
  }
  return manager;
}

function tryExpression(model: Live2DModel, ids: string[]): void {
  const run = async () => {
    for (const id of ids) {
      try {
        const matched = await model.expression(id);
        if (matched) return;
      } catch {
        // Ignore
      }
    }
  };
  void run();
}

function tryMotion(model: Live2DModel, groups: string[]): void {
  for (const group of groups) {
    try {
      void model.motion(group);
      return;
    } catch {
      // Ignore
    }
  }
}

export function applyLive2DMood(model: Live2DModel, currentMood: Mood): void {
  const normalizedMood = currentMood === 'neutral' ? 'idle' : currentMood;
  const manager = getManager(model);

  manager.transitionTo(normalizedMood);

  switch (normalizedMood) {
    case 'talking':
      tryMotion(model, ['tap_body', 'talk', 'idle']);
      tryExpression(model, ['f01']);
      break;
    case 'happy':
      tryExpression(model, ['f02', 'happy']);
      tryMotion(model, ['happy', 'tap_body', 'idle']);
      break;
    case 'sad':
      tryExpression(model, ['f03', 'sad']);
      tryMotion(model, ['sad', 'idle']);
      break;
    case 'angry':
      tryExpression(model, ['f04', 'angry']);
      tryMotion(model, ['angry', 'tap_body', 'idle']);
      break;
    case 'surprised':
      tryExpression(model, ['f05', 'surprised', 'surprise']);
      tryMotion(model, ['surprised', 'surprise', 'tap_body', 'idle']);
      break;
    case 'thinking':
      tryExpression(model, ['f06', 'thinking']);
      tryMotion(model, ['thinking', 'idle']);
      break;
    default:
      tryMotion(model, ['idle']);
      break;
  }
}

export function runIdleLoop(model: Live2DModel, mood: Mood): void {
  const coreModel = (model as ModelWithCore).internalModel?.coreModel;
  if (!coreModel?.setParameterValueById) return;

  const manager = getManager(model);

  manager.update();

  const time = performance.now() * 0.001;
  const breathCycle = Math.sin(time * 0.8);

  const setParam = (id: string, value: number) => {
    try {
      coreModel.setParameterValueById?.(id, value);
    } catch {
      // Ignore
    }
  };

  const breathY = breathCycle * 1.2;
  const breathX = Math.sin(time * 0.4) * 0.5;

  const currentAngleX = coreModel.getParameterValueById?.('ParamAngleX') || 0;
  const currentAngleY = coreModel.getParameterValueById?.('ParamAngleY') || 0;

  if (mood === 'thinking') {
    const tiltVariation = Math.sin(time * 0.3) * 2;
    setParam('ParamAngleX', currentAngleX + tiltVariation);
    setParam('ParamAngleY', currentAngleY + breathY * 0.5);
  } else if (mood === 'idle' || mood === 'neutral') {
    // For idle, just breathing
    setParam('ParamAngleX', currentAngleX + breathX * 0.2); // subtle sway
    setParam('ParamAngleY', currentAngleY + breathY * 0.3); // nod
  }
}
