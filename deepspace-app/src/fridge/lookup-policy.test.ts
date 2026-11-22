import {it,expect} from 'vitest'
import {quotaStatus} from './lookup-policy'
it('shows the smaller of personal and shared remaining allowance',()=>{
 expect(quotaStatus('quote',1,7)).toMatchObject({user_remaining:2,app_remaining:1,remaining:1})
 expect(quotaStatus('quote',0,8).remaining).toBe(0)
})
it('does not expose a negative allowance after a limit is reached',()=>{
 expect(quotaStatus('quote',3,3).remaining).toBe(0)
 expect(quotaStatus('quote',9,20)).toMatchObject({user_remaining:0,app_remaining:0,remaining:0})
})
it('keeps separate location limits and resets at the next UTC midnight',()=>{
 expect(quotaStatus('location',11,38,Date.parse('2026-11-22T23:59:59Z'))).toMatchObject({remaining:1,reset_at:'2026-11-23T00:00:00.000Z'})
})
