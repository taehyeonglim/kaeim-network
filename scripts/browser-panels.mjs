// Shared navigation for the observatory's on-demand panels.
export async function panel(page,kind){
 const name={filters:'탐색 조건 열기',analysis:'분석 조건 열기',tools:'분석 도구 열기',detail:'선택 상세 열기'}[kind];
 const trigger=page.getByRole('button',{name,exact:true});
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 await page.locator('.observatory-drawer[open]').waitFor();
}
export async function closePanel(page){
 if(await page.locator('.observatory-drawer[open]').count())await page.locator('.drawer-heading button').click();
}
