// Mech Market identity adapter. Delegate cryptography and nonce reservation to TAP.
import {createHttpTapVerifier} from '../../vendor/tap-verify/index.mjs';

export function createIdentityVerifier({origin,resolveKey,nonceStore}){
  if(typeof resolveKey!=='function'||!nonceStore||typeof nonceStore.reserve!=='function'){
    throw Object.assign(new Error('Invalid identity verifier configuration'),{code:'tap_http_verifier_configuration_invalid'});
  }
  const verifier=createHttpTapVerifier({
    origin,
    maxAgeSeconds:60,
    clockSkewSeconds:5,
    resolveKey,
    nonceStore
  });
  return {
    async verify(request,nowSeconds){
      if(!Number.isSafeInteger(nowSeconds)||nowSeconds<0)return {ok:false,code:'tap_malformed'};
      try{
        // The vendored HTTP verifier reconstructs scheme and authority from its
        // configured origin. Refuse a request targeting a different origin before
        // allowing it to reach that verifier or reserve a nonce.
        if(new URL(request.url).origin!==origin)return {ok:false,code:'tap_malformed'};
        return await verifier.verify(request,nowSeconds);
      }catch{
        // A failing resolver or trust boundary cannot authorize a command.
        return {ok:false,code:'tap_trust_unavailable'};
      }
    }
  };
}
