import { Runtime3DGenParams, Runtime3DGenParamsKeys } from 'model-bank';
import { useCallback, useMemo } from 'react';

import { useThreeDStore } from '../../store';
import { threeDGenerationConfigSelectors } from './selectors';

export function useGenerationConfigParam<
  N extends Runtime3DGenParamsKeys,
  V extends Runtime3DGenParams[N],
>(paramName: N) {
  const parameters = useThreeDStore(threeDGenerationConfigSelectors.parameters);
  const parametersSchema = useThreeDStore(threeDGenerationConfigSelectors.parametersSchema);

  const paramValue = parameters?.[paramName] as V;
  const setParamsValue = useThreeDStore((s) => s.setParameter);
  const setValue = useCallback(
    (value: V) => {
      setParamsValue(paramName, value);
    },
    [paramName, setParamsValue],
  );

  const paramConfig = parametersSchema?.[paramName];
  const paramConstraints = useMemo(() => {
    const min =
      paramConfig && typeof paramConfig === 'object' && 'min' in paramConfig
        ? paramConfig.min
        : undefined;
    const max =
      paramConfig && typeof paramConfig === 'object' && 'max' in paramConfig
        ? paramConfig.max
        : undefined;
    const step =
      paramConfig && typeof paramConfig === 'object' && 'step' in paramConfig
        ? paramConfig.step
        : undefined;
    const description =
      paramConfig && typeof paramConfig === 'object' && 'description' in paramConfig
        ? paramConfig.description
        : undefined;
    const enumValues =
      paramConfig && typeof paramConfig === 'object' && 'enum' in paramConfig
        ? paramConfig.enum
        : undefined;

    return { description, enumValues, max, min, step };
  }, [paramConfig]);

  return { constraints: paramConstraints, setValue, value: paramValue };
}
