import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'

async function ready(page: Page, suffix: string) {
  await page.goto('/home')
  await expect(page.locator('[name="username"], [data-testid="fridge-workspace"]').first()).toBeVisible({timeout:30000})
  if (await page.locator('.native-fridge-onboarding form').count()) {
    await page.locator('[name="username"]').fill(`fridgeqa_${suffix}`)
    await page.locator('[name="display_name"]').fill(`Fridge QA ${suffix}`)
    await page.locator('[name="email"]').fill(`fridgeqa_${suffix}@example.com`)
    await page.getByRole('button',{name:'Open my fridge'}).click()
  }
  await expect(page.getByTestId('fridge-workspace')).toBeVisible()
  await page.waitForFunction(() => Boolean(window.fridgeAuth))
  await expect(page.locator('#account-menu')).toBeVisible()
  await expect(page.locator('#notice')).not.toContainText('could not load')
}
async function api(page: Page, path: string, method='GET', body?: unknown) {
  return page.evaluate(async ({path,method,body}) => {
    const token = await window.fridgeAuth.getToken()
    const response = await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined})
    return {status:response.status,...await response.json()}
  },{path,method,body})
}

test('lookup resumes across reload without extra quota and expires without a paid refresh',async({users})=>{
 test.setTimeout(120000);const [a]=await users(1);await ready(a.page,'a');await a.page.clock.install();
 const foods=(await api(a.page,'/api/ingredients')).data,before=(await api(a.page,'/api/inventory')).data;
 const food=foods.find((row:{_id:string})=>!before.some((stock:{ingredient_id:string})=>stock.ingredient_id===row._id));
 let rid:string|undefined;
 try {
  expect((await api(a.page,'/api/inventory','POST',{batch_id:crypto.randomUUID(),ingredient_id:food._id,quantity:1000,visibility:'private'})).status).toBe(200);
  const recipe=await api(a.page,'/api/recipes','POST',{title:`Ready lookup QA ${Date.now()}`,servings:2,instructions:'Review stock.',items:[{ingredient_id:food._id,quantity:100}]});expect(recipe.status).toBe(201);rid=recipe.data._id;
  const usage=(await api(a.page,'/api/recipes/shopping/usage')).data;expect(usage.quote.remaining).toBe(Math.min(usage.quote.user_remaining,usage.quote.app_remaining));
  const requests:string[]=[];a.page.on('request',request=>{if(request.url().endsWith('/api/recipes/shopping/quote')&&request.method()==='POST')requests.push(request.postDataJSON().request_id)});
  let lose=true;
  await a.page.route('**/api/recipes/shopping/quote',async route=>{if(lose){lose=false;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('connectionreset')}else await route.continue()});
  await a.page.locator('.main-nav a[href="#recipes"]').click();await a.page.getByRole('button',{name:'Buy within budget',exact:true}).click();
  await expect(a.page.locator('#meal-quota-status')).toContainText('lookups left today');await a.page.locator('#meal-budget').fill('0');
  await a.page.getByRole('button',{name:'Find meals in budget',exact:true}).click();await expect(a.page.getByRole('button',{name:'Resume lookup',exact:true})).toBeVisible();
  await a.page.reload();await expect(a.page.locator('#account-menu')).toBeVisible();await a.page.locator('.main-nav a[href="#recipes"]').click();await a.page.getByRole('button',{name:'Buy within budget',exact:true}).click();await a.page.locator('#meal-budget').fill('0');
  await a.page.getByRole('button',{name:'Resume lookup',exact:true}).click();await expect(a.page.locator('#meal-budget-status')).toContainText('Listings checked',{timeout:15000});
  expect(requests).toHaveLength(2);expect(requests[0]).toBe(requests[1]);
  const after=(await api(a.page,'/api/recipes/shopping/usage')).data;expect(after.quote.user_remaining).toBe(usage.quote.user_remaining);
  expect((await api(a.page,'/api/recipes/shopping/quote','POST',{request_id:requests[0],budget_cents:1,servings:2,store:'amazon-us',offset:0})).status).toBe(409);
  await a.page.getByRole('button',{name:/View recipe: Ready lookup QA/}).click();await expect(a.page.locator('#recipe-detail')).toBeVisible();
  await a.page.clock.fastForward(16*60*1000);
  await a.page.locator('#recipe-detail [data-recipe-back]').click();await expect(a.page.locator('#meal-budget-status')).toContainText('prices have expired');await expect(a.page.getByRole('button',{name:'Refresh prices',exact:true})).toBeVisible();
  expect(requests).toHaveLength(3); // Third POST above was the rejected changed-body replay, not a refresh.
  expect((await api(a.page,'/api/recipes/shopping/usage')).data.quote.user_remaining).toBe(usage.quote.user_remaining);
  await a.page.screenshot({path:'.deepspace/lookup-expired.png',fullPage:true});
 }finally{
  if(rid)await api(a.page,`/api/recipes/${rid}`,'DELETE');const stock=(await api(a.page,'/api/inventory')).data.find((row:{ingredient_id:string})=>row.ingredient_id===food._id);if(stock)await api(a.page,`/api/inventory/${stock._id}`,'DELETE',{expected_quantity:stock.quantity});
 }
});
