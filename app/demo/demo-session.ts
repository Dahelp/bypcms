// Public demo UI session only. Owner/Admin authentication remains on the server.
export const DEMO_SESSION_KEY="bypcms-demo-session-v2";
export const LEGACY_DEMO_SESSION_KEY="bypcms-demo-auth";
export const DEMO_SESSION_TTL=8*60*60*1000;
type SharedStorage=Pick<Storage,"getItem"|"setItem">;
type TabStorage=Pick<Storage,"getItem"|"removeItem">;
export type DemoSession={status:"active";expiresAt:number};

function clearLegacy(storage:TabStorage){try{storage.removeItem(LEGACY_DEMO_SESSION_KEY);}catch{/* Shared browser state remains authoritative. */}}
export function startDemoSession(shared:SharedStorage,legacy:TabStorage,now=Date.now()):DemoSession {
  const session:DemoSession={status:"active",expiresAt:now+DEMO_SESSION_TTL};
  shared.setItem(DEMO_SESSION_KEY,JSON.stringify(session));clearLegacy(legacy);return session;
}
export function endDemoSession(shared:SharedStorage,legacy:TabStorage,now=Date.now()):void {
  // A tombstone prevents another tab's old marker from silently signing back in.
  shared.setItem(DEMO_SESSION_KEY,JSON.stringify({status:"signed-out",signedOutAt:now}));clearLegacy(legacy);
}
export function readDemoSession(shared:SharedStorage,legacy:TabStorage,now=Date.now()):DemoSession | null {
  const raw=shared.getItem(DEMO_SESSION_KEY);
  if(raw===null)return legacy.getItem(LEGACY_DEMO_SESSION_KEY)==="active"?startDemoSession(shared,legacy,now):null;
  clearLegacy(legacy);
  try {
    const session=JSON.parse(raw);
    return session?.status==="active" && typeof session.expiresAt==="number" && Number.isFinite(session.expiresAt) && session.expiresAt>now
      ? {status:"active",expiresAt:session.expiresAt}:null;
  }catch{return null;}
}
