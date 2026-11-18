"""Run against an isolated, freshly seeded server (see README)."""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright, expect
BASE=os.environ.get('GLOW_URL','http://127.0.0.1:8000')
PASSWORD=os.environ.get('GLOW_DEMO_PASSWORD','GlowDemo2026!')
Path('work').mkdir(exist_ok=True)

async def login(page,user):
    await page.goto(BASE+'/')
    await page.get_by_label('Nom d\'usuari').fill(user)
    await page.get_by_label('Contrasenya').fill(PASSWORD)
    await page.get_by_role('button',name='Entrar',exact=True).click()
    await expect(page.get_by_role('heading',name=f'Hola, {user.capitalize()}')).to_be_visible()

async def create_workshop(page,title,capacity):
    await page.goto(BASE+'/')
    await page.get_by_role('link',name='+ Nou taller').click()
    await page.get_by_label('Nom del taller').fill(title)
    await page.get_by_label('Ubicació').fill('Espai fictici de prova')
    await page.get_by_label('Data i hora de la sessió').fill('2026-12-20T17:00')
    await page.get_by_label('Aforament').fill(str(capacity))
    await page.get_by_label('Preu per persona').fill('35')
    await page.get_by_label('Senyal per persona').fill('20')
    await page.get_by_role('button',name='Crear taller',exact=True).click()
    return page.url

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':1440,'height':1000},locale='ca-ES')
        page=await context.new_page()
        await login(page,'laura')
        await page.screenshot(path='work/inici-desktop.png',full_page=True)
        workshop_url=await create_workshop(page,'Validació UI · dues places',5)
        await page.get_by_role('link',name='+ Nova reserva').click()
        await page.get_by_label('Nom de la nova clienta').fill('Anna Fictícia UI')
        await page.get_by_label('Telèfon').fill('600000099')
        await page.get_by_label('Nombre de places').fill('2')
        await page.get_by_role('button',name='Crear reserva').click()
        reservation_url=page.url
        await expect(page.locator('.badge.pending')).to_have_text('Pendent de senyal')
        await expect(page.locator('.stats section').nth(0).locator('strong')).to_have_text('70,00 €')
        await page.get_by_label('Import rebut').fill('40')
        await page.get_by_role('button',name='Registrar cobrament',exact=True).click()
        await expect(page.locator('.badge.confirmed')).to_have_text('Confirmada')
        await expect(page.locator('.stats section').nth(2).locator('strong')).to_have_text('30,00 €')
        await page.get_by_label('Mètode').select_option('cash')
        await page.get_by_role('button',name='Registrar cobrament',exact=True).click()
        await expect(page.locator('.badge').filter(has_text='Liquidada')).to_be_visible()
        await expect(page.locator('.stats section').nth(2).locator('strong')).to_have_text('0,00 €')
        await page.get_by_label('Participants presents').fill('2')
        await page.get_by_role('button',name='Desar assistència').click()
        await page.goto(workshop_url)
        await expect(page.locator('.stats section').nth(0).locator('strong')).to_have_text('40,00 €')
        await expect(page.locator('.stats section').nth(1).locator('strong')).to_have_text('30,00 €')
        await expect(page.locator('.stats section').nth(3).locator('strong')).to_have_text('2')
        await expect(page.get_by_role('cell',name='Bizum',exact=True)).to_be_visible()
        await expect(page.get_by_role('cell',name='Efectiu',exact=True)).to_be_visible()
        await page.screenshot(path='work/taller-cobraments.png',full_page=True)
        print('PASS UI: 2 × 35 €, senyal 40 € Bizum → confirmada, saldo 30 € efectiu → liquidada; resum 40/30; assistència 2')
        # Seeded expired deposit: inspect and release only through UI.
        await page.goto(BASE+'/')
        await page.get_by_role('link',name='Júlia Exemple · Crea el teu charm',exact=False).click()
        await expect(page.get_by_text('Senyal vençuda',exact=True)).to_be_visible()
        parent=await page.locator('a.back').get_attribute('href')
        await page.goto(BASE+parent)
        await expect(page.get_by_text('11 places disponibles',exact=True)).to_be_visible()
        await page.get_by_role('link',name='Júlia Exemple ↗').click()
        await page.get_by_text('Cancel·lar i alliberar places',exact=True).click()
        await page.get_by_role('button',name='Confirmar cancel·lació i alliberament').click()
        await expect(page.locator('.badge.cancelled')).to_be_visible()
        await page.goto(BASE+parent)
        await expect(page.get_by_text('12 places disponibles',exact=True)).to_be_visible()
        print('PASS UI: senyal vençuda conserva plaça; alliberament manual retorna 11 → 12 disponibles')
        # Two independent signed-in browser sessions submit for one remaining seat.
        last_url=await create_workshop(page,'Validació UI · última plaça',1)
        await page.get_by_role('link',name='+ Nova reserva').click()
        booking_url=page.url
        context2=await browser.new_context(viewport={'width':390,'height':844},locale='ca-ES')
        other=await context2.new_page(); await login(other,'elena')
        await other.goto(booking_url)
        for tab in [page,other]:
            await tab.get_by_label('Clienta existent').select_option(label='Marta Prova · 600000002')
        await asyncio.gather(*[tab.get_by_role('button',name='Crear reserva').click() for tab in [page,other]])
        winners=[tab for tab in [page,other] if '/reserves/' in tab.url and not tab.url.endswith('/nova/')]
        assert len(winners)==1, [page.url,other.url]
        loser=other if winners[0]==page else page
        await expect(loser.get_by_text('No hi ha prou places disponibles.',exact=False)).to_be_visible()
        await loser.get_by_label('Afegir a la llista d’espera').check()
        await loser.get_by_role('button',name='Crear reserva').click()
        await expect(loser.locator('.badge.waiting')).to_be_visible()
        await loser.get_by_role('button',name='Promoure a reserva activa').click()
        await expect(loser.get_by_text('No hi ha prou places disponibles.',exact=False)).to_be_visible()
        await page.goto(last_url)
        await expect(page.get_by_text('0 places disponibles',exact=True)).to_be_visible()
        print('PASS UI: Laura i Elena competeixen per última plaça; una activa, altra en espera; promoció rebutjada amb aforament ple')
        await other.goto(workshop_url)
        assert await other.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile horizontal overflow'
        await expect(other.get_by_role('heading',name='Validació UI · dues places')).to_be_visible()
        await other.screenshot(path='work/taller-mobil.png',full_page=True)
        await other.goto(reservation_url)
        assert await other.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Reservation mobile overflow'
        print('PASS UI: mòbil 390 px sense desbordament horitzontal; dades compartides entre usuàries')
        await browser.close()

asyncio.run(main())
