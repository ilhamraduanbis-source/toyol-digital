// Framework-neutral password-login preparation. Integrate only with the buyer's
// existing credential verifier, durable rate limiter and session manager.
// No password storage, custom session token generation or production deployment.
const failure = () => ({status:401,body:{error:'Invalid credentials'}});
const invalid = () => ({status:400,body:{error:'Invalid login request'}});
const unavailable = () => ({status:503,body:{error:'Login unavailable'}});
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const byteLength=x=>Buffer.byteLength(x,'utf8');

export function createLoginHandler({findUser,verifyPassword,createSession,consumeAttempt,dummyPasswordHash,normalizeIdentity}={}){
  for(const [name,fn] of Object.entries({findUser,verifyPassword,createSession,consumeAttempt})){
    if(typeof fn!=='function')throw new TypeError(name+' adapter required');
  }
  if(typeof dummyPasswordHash!=='string'||!dummyPasswordHash)throw new TypeError('Existing verifier-compatible dummy hash required');
  if(normalizeIdentity!==undefined&&typeof normalizeIdentity!=='function')throw new TypeError('normalizeIdentity must be a function');
  return async function login(input,context={}){
    if(!isRecord(input)||typeof input.identity!=='string'||typeof input.password!=='string')return invalid();
    if(!input.identity.trim()||byteLength(input.identity)>320||!input.password.length||byteLength(input.password)>1024)return invalid();
    // Rate-limit key must be supplied by trusted server middleware, not request JSON.
    if(typeof context.rateLimitKey!=='string'||!context.rateLimitKey||byteLength(context.rateLimitKey)>512)return unavailable();
    try{
      const identity=normalizeIdentity?normalizeIdentity(input.identity):input.identity;
      if(typeof identity!=='string'||!identity.trim()||byteLength(identity)>320)return invalid();
      const allowed=await consumeAttempt({identity,rateLimitKey:context.rateLimitKey});
      if(allowed!==true)return {status:429,body:{error:'Too many attempts'}};
      const user=await findUser(identity);
      const hasHash=isRecord(user)&&typeof user.passwordHash==='string'&&user.passwordHash.length>0;
      // Always invoke the configured verifier for unknown users; dummy hash must
      // use the same algorithm and cost. No promise of perfect timing equality.
      const verified=await verifyPassword(input.password,hasHash?user.passwordHash:dummyPasswordHash);
      if(!hasHash||verified!==true||user.disabled===true||typeof user.id!=='string'||!user.id)return failure();
      // Session adapter owns secure cookies, rotation, expiry and persistence.
      // Caller must integrate it server-side; never return session secrets in JSON.
      const result=await createSession({userId:user.id,context});
      if(result!==true)return unavailable();
      return {status:200,body:{ok:true}};
    }catch{
      // Do not emit credentials, hashes, provider errors or user enumeration hints.
      return unavailable();
    }
  };
}
