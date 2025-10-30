import { Runtime3DGenParamsKeys } from 'model-bank';

export const model = (s: any) => s.model;
export const provider = (s: any) => s.provider;
export const modelCount = (s: any) => s.modelCount;

const parameters = (s: any) => s.parameters;
const parametersSchema = (s: any) => s.parametersSchema;
const isSupportedParam = (paramName: Runtime3DGenParamsKeys) => {
  return (s: any) => {
    const _parametersSchema = parametersSchema(s);
    return _parametersSchema && Boolean(paramName in _parametersSchema);
  };
};

export const threeDGenerationConfigSelectors = {
  isSupportedParam,
  model,
  modelCount,
  parameters,
  parametersSchema,
  provider,
};
