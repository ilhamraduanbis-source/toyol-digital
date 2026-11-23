// Records only what the Firebase SDK actually reports for this response.
export function classifySource(value) {
  return value === 'ON_DEVICE' ? 'ON_DEVICE'
    : value === 'IN_CLOUD' ? 'IN_CLOUD' : 'UNKNOWN';
}
export function canExportEvidence(result) {
  return result && result.completed === true &&
    (result.inferenceSource === 'ON_DEVICE' || result.inferenceSource === 'IN_CLOUD');
}
export function createLocalEvidence({modelMode,inferenceSource,responseLength}) {
  const source=classifySource(inferenceSource);
  if(source === 'UNKNOWN') throw new Error('Cannot certify unknown inference source');
  if(!Number.isSafeInteger(responseLength) || responseLength < 0) throw new Error('Invalid response length');
  return {
    schema: 'proofsafe-firebase-v1', measuredAt: new Date().toISOString(),
    modelMode, inferenceSource: source, responseLength,
    // No prompt, response, personal data, or secrets are exported.
    scope: 'Local client-observed SDK response; not contest or payment verification'
  };
}
