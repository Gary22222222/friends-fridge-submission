import {DurableObject} from 'cloudflare:workers'
import type {Env} from '../../worker'
import {quotaStatus,type LookupKind} from './lookup-policy'

/** App-scoped, serialized lookup receipts and daily quotas; no inventory data. */
export class LookupRoom extends DurableObject<Env> {
  constructor(ctx:DurableObjectState,env:Env) {
    super(ctx,env)
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS lookup_jobs (owner TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(owner,id))')
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS lookup_usage (day TEXT NOT NULL,kind TEXT NOT NULL,subject TEXT NOT NULL,used INTEGER NOT NULL,PRIMARY KEY(day,kind,subject))')
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS lookup_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)')
    ctx.storage.sql.exec('INSERT OR IGNORE INTO lookup_meta(key,value) VALUES (?,?)','tracking_started_at',new Date().toISOString())
  }
  async fetch(request:Request):Promise<Response> {
    const fail=(status:number,code:string,message:string)=>Response.json({error:{code,message}},{status,headers:{'Cache-Control':'no-store'}})
    if(new URL(request.url).pathname==='/health')return Response.json({status:'ok',protocol:'lookup-v1'})
    const subject=request.headers.get('x-fridge-subject')
    if(!subject)return fail(401,'UNAUTHENTICATED','Please sign in.')
    if(request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED','Use POST.')
    try {
      const input=await request.json() as {op:string;key:string;kind?:string;value?:Record<string,unknown>}
      const time=Date.now(),day=new Date(time).toISOString().slice(0,10),key=String(input.key||'')
      if(key.length>180)return fail(400,'INVALID_INPUT','Lookup ID is too long.')
      const sql=this.ctx.storage.sql
      const get=()=>sql.exec<{body:string;expires:number}>('SELECT body,expires FROM lookup_jobs WHERE owner=? AND id=? AND expires>?',subject,key,time).toArray()[0]
      const put=(value:Record<string,unknown>,expires=time+3600000)=>{
        const body=JSON.stringify(value);if(new TextEncoder().encode(body).length>200000)throw new Error('Lookup response too large.')
        sql.exec('INSERT INTO lookup_jobs(owner,id,body,expires) VALUES (?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET body=excluded.body,expires=excluded.expires',subject,key,body,expires)
      }
      const used=(kind:LookupKind,who:string)=>sql.exec<{used:number}>('SELECT used FROM lookup_usage WHERE day=? AND kind=? AND subject=?',day,kind,who).toArray()[0]?.used||0
      const quota=(kind:LookupKind)=>quotaStatus(kind,used(kind,subject),used(kind,'*'),time)
      const result=this.ctx.storage.transactionSync(()=>{
        sql.exec('DELETE FROM lookup_jobs WHERE expires<=?',time)
        sql.exec('DELETE FROM lookup_usage WHERE day<?',new Date(time-7*86400000).toISOString().slice(0,10))
        if(input.op==='quota')return {data:{quote:quota('quote'),location:quota('location'),tracking_started_at:sql.exec<{value:string}>('SELECT value FROM lookup_meta WHERE key=?','tracking_started_at').one().value}}
        if(input.op==='limit') {
          const kind:LookupKind=input.kind==='location'?'location':'quote',status=quota(kind)
          if(!status.remaining)return {error:{status:429,code:'SHOPPING_LIMIT',message:'Daily lookup allowance used up. Cached quotes and existing jobs still work. Try again after the reset time.'}}
          for(const who of [subject,'*'])sql.exec('INSERT INTO lookup_usage(day,kind,subject,used) VALUES (?,?,?,1) ON CONFLICT(day,kind,subject) DO UPDATE SET used=used+1',day,kind,who)
          return {data:quota(kind)}
        }
        const row=get(),job=row?JSON.parse(row.body) as Record<string,unknown>:null
        if(input.op==='jobCreate') {
          if(job){if(job.fingerprint&&job.fingerprint!==input.value?.fingerprint)return {error:{status:409,code:'REQUEST_CONFLICT',message:'This lookup ID was used for different conditions.'}};return {data:false}}
          put({...input.value,status:'starting',created_at:new Date(time).toISOString(),next_poll:time+3000})
          return {data:true}
        }
        if(input.op==='jobAdopt'){if(!job&&input.value)put(input.value);return {data:true}}
        if(!job||!row)return {error:{status:404,code:'QUOTE_EXPIRED',message:'Lookup not found or expired.'}}
        if(input.op==='jobUpdate') {put({...input.value,fingerprint:job.fingerprint,created_at:job.created_at},row.expires);return {data:true}}
        if(input.op==='jobGet') {
          const allow_poll=Number(job.next_poll||0)<=time
          if(allow_poll)put({...job,next_poll:time+3000},row.expires)
          return {data:{...job,allow_poll}}
        }
        return {error:{status:400,code:'INVALID_INPUT',message:'Unknown lookup operation.'}}
      })
      if(result.error)return fail(result.error.status,result.error.code,result.error.message)
      return Response.json({data:result.data},{headers:{'Cache-Control':'no-store'}})
    }catch{return fail(500,'LOOKUP_STORAGE_UNAVAILABLE','Lookup status is temporarily unavailable. Please retry the same lookup.')}
  }
}
