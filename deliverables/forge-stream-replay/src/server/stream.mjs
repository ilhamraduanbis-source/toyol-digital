// Candidate for Mech Market stream-replay. No network, timers or external dependencies.
function fail(code) { throw Object.assign(new Error(code), {code}); }
function sequence(n, allowZero=false) {
  if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1)) fail('INVALID_EVENT_SEQUENCE');
  return n;
}
function valid(event) {
  if (!event || typeof event !== 'object') fail('INVALID_EVENT');
  sequence(event.seq);
  if (typeof event.type !== 'string' || !event.type.length || /[\r\n\0]/.test(event.type)) fail('INVALID_EVENT_TYPE');
  return event;
}
export function encodeSse(event) {
  valid(event);
  const json = JSON.stringify(event);
  if (typeof json !== 'string') fail('INVALID_EVENT_DATA');
  return 'id: '+event.seq+'\nevent: '+event.type+'\ndata: '+json+'\n\n';
}
export function createEventHub({readEvents}={}) {
  if (typeof readEvents !== 'function') fail('INVALID_EVENT_READER');
  const listeners = new Set();
  let closed = false;
  let queue = Promise.resolve();
  function serial(fn) {
    const next = queue.then(fn);
    queue = next.catch(()=>{});
    return next;
  }
  function remove(s) {
    s.active=false;
    s.pending.clear();
    listeners.delete(s);
  }
  function buffer(s, events) {
    if (!Array.isArray(events)) fail('INVALID_EVENT_HISTORY');
    for (const e of events) {
      valid(e);
      if(e.seq>s.cursor && !s.pending.has(e.seq)) s.pending.set(e.seq,e);
    }
  }
  function drain(s) {
    while(!closed && s.active && s.pending.has(s.cursor+1)) {
      const e=s.pending.get(s.cursor+1);
      s.pending.delete(e.seq);
      s.cursor=e.seq;
      try { s.onEvent(e); } catch(err) { remove(s); throw err; }
    }
  }
  async function replay(s) {
    if(closed||!s.active)return;
    const history=await readEvents(s.cursor);
    if(closed||!s.active)return;
    buffer(s,history);
    drain(s);
  }
  async function subscribe({after=0,onEvent}={}) {
    sequence(after,true);
    if(typeof onEvent!=='function')fail('INVALID_EVENT_LISTENER');
    return serial(async()=>{
      if(closed)fail('EVENT_HUB_CLOSED');
      const s={cursor:after,onEvent,active:true,pending:new Map()};
      listeners.add(s);
      try { await replay(s); } catch(err) { remove(s); throw err; }
      return ()=>remove(s);
    });
  }
  async function publish(event) {
    valid(event);
    return serial(async()=>{
      if(closed)return;
      let failure;
      for(const s of [...listeners]) {
        if(closed||!s.active||event.seq<=s.cursor)continue;
        try {
          buffer(s,[event]);
          // Replay the durable log before delivering a gap; never skip a missing sequence.
          if(!s.pending.has(s.cursor+1))await replay(s);
          drain(s);
        } catch(err) { failure??=err; }
      }
      if(failure)throw failure;
    });
  }
  function close() {
    closed=true;
    for(const s of [...listeners])remove(s);
  }
  return {publish,subscribe,close};
}
