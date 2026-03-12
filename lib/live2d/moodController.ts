import type { Live2DModel } from 'pixi-live2d-display-advanced/cubism4';
import type { Mood } from '@/store/avatarStore';

type ModelWithCore = Live2DModel & {
  internalModel?: {
    coreModel?: {
      setParameterValueById?: (id: string, value: number) => void;
    };
  };
};

function applyCorePreset(model: Live2DModel, moodPreset: Mood): void {
  const coreModel = (model as ModelWithCore).internalModel?.coreModel;

  if (!coreModel?.setParameterValueById) return;

  const setParam = (id: string, value: number) => {
    try {
      coreModel.setParameterValueById?.(id, value);
    } catch {
      // Ignore unsupported or missing parameters for model portability
    }
  };

  switch (moodPreset) {
    case 'thinking':
      setParam('ParamAngleX', -6);
      setParam('ParamAngleY', 3);
      setParam('ParamEyeLOpen', 0.85);
      setParam('ParamEyeROpen', 0.85);
      setParam('ParamMouthOpenY', 0.05);
      break;
    case 'surprised':
      setParam('ParamAngleX', 0);
      setParam('ParamAngleY', 5);
      setParam('ParamEyeLOpen', 1);
      setParam('ParamEyeROpen', 1);
      setParam('ParamMouthOpenY', 0.65);
      break;
    case 'happy':
      setParam('ParamAngleX', 2);
      setParam('ParamMouthOpenY', 0.35);
      break;
    case 'sad':
      setParam('ParamAngleX', -2);
      setParam('ParamAngleY', -4);
      setParam('ParamMouthOpenY', 0.1);
      break;
    case 'angry':
      setParam('ParamAngleX', 4);
      setParam('ParamAngleY', -2);
      setParam('ParamMouthOpenY', 0.2);
      break;
    case 'talking':
      setParam('ParamMouthOpenY', 0.5);
      break;
    default:
      setParam('ParamAngleX', 0);
      setParam('ParamAngleY', 0);
      setParam('ParamMouthOpenY', 0.1);
      break;
  }
}

function tryExpression(model: Live2DModel, ids: string[]): void {
  const run = async () => {
    for (const id of ids) {
      try {
        const matched = await model.expression(id);
        if (matched) return;
      } catch {
        // Ignore and try fallback expression id
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
      // Ignore and try fallback motion group
    }
  }
}

export function applyLive2DMood(model: Live2DModel, currentMood: Mood): void {
  const normalizedMood = currentMood === 'neutral' ? 'idle' : currentMood;

  switch (normalizedMood) {
    case 'talking':
      tryMotion(model, ['tap_body', 'talk', 'idle']);
      tryExpression(model, ['f01']);
      applyCorePreset(model, 'talking');
      break;
    case 'happy':
      tryExpression(model, ['f02', 'happy']);
      tryMotion(model, ['happy', 'tap_body', 'idle']);
      applyCorePreset(model, 'happy');
      break;
    case 'sad':
      tryExpression(model, ['f03', 'sad']);
      tryMotion(model, ['sad', 'idle']);
      applyCorePreset(model, 'sad');
      break;
    case 'angry':
      tryExpression(model, ['f04', 'angry']);
      tryMotion(model, ['angry', 'tap_body', 'idle']);
      applyCorePreset(model, 'angry');
      break;
    case 'surprised':
      tryExpression(model, ['f05', 'surprised', 'surprise']);
      tryMotion(model, ['surprised', 'surprise', 'tap_body', 'idle']);
      applyCorePreset(model, 'surprised');
      break;
    case 'thinking':
      tryExpression(model, ['f06', 'thinking']);
      tryMotion(model, ['thinking', 'idle']);
      applyCorePreset(model, 'thinking');
      break;
    default:
      tryMotion(model, ['idle']);
      applyCorePreset(model, 'idle');
      break;
  }
}
