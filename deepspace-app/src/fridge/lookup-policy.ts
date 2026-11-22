export type LookupKind = 'quote' | 'location'
export const LOOKUP_LIMITS = {quote:{user:3,app:8},location:{user:12,app:40}} as const
export function quotaStatus(kind:LookupKind,userUsed:number,appUsed:number,now=Date.now()) {
  const limits=LOOKUP_LIMITS[kind]
  const user_remaining=Math.max(0,limits.user-userUsed),app_remaining=Math.max(0,limits.app-appUsed)
  const date=new Date(now);date.setUTCHours(24,0,0,0)
  return {user_used:userUsed,app_used:appUsed,user_limit:limits.user,app_limit:limits.app,user_remaining,app_remaining,remaining:Math.min(user_remaining,app_remaining),reset_at:date.toISOString()}
}
