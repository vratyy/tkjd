
Užívateľ chce PDF dokument popisujúci TKJD APP, ktorý poslúži ako brief/knowledge base pre Claude agenta na generovanie marketingových kampaní pre Meta Ads. Nič v kódbase sa nemení.

**Čo viem o appke z konverzácie a kontextu:**
- B2B aplikácia pre TKJD, s.r.o. (stavebná subdodávateľská firma)
- Slovensky/nemecky orientovaná (montéri pracujúci v DE/AT)
- Strict B2B, NIE HR — terminológia: Spolupracovník/Montér/Subdodávateľ
- Hlavné entity: Users (admin/montér), Projects, TimeRecords (denné záznamy), Weekly Closures (KW/Kalenderwoche), Invoices (21-day splatnosť), Accommodations (ubytovanie), Equipment (náradie), Sanctions, Advances (zálohy), Announcements
- Auth: invite-only systém (admin pozýva, žiadna verejná registrácia)
- PDF faktúry s QR kódom (PAY by square), Stundenzettel export
- Finančný prehľad s metrikami, traffic light systém faktúr
- Mobile-first podpora (mobile cards pre faktúry, recordy, users)
- Lovable Cloud backend (Supabase)

**Štruktúra PDF (briefu pre AI agenta):**
1. Executive summary — čo TKJD APP je
2. Cieľová skupina (ICP) — koho oslovuje
3. Hlavné funkcie (modulárne)
4. Kľúčové benefity / value propositions
5. Bolestivé body (pain points), ktoré rieši
6. USP / odlíšenie od konkurencie
7. Brand tonalita a jazyk
8. Vstupy pre agenta — ako z toho generovať Meta Ads kampane (angles, hooks, audiences)

**Prístup:**
- Použijem skill `pdf` (reportlab) na vygenerovanie čistého A4 PDF
- Slovenský jazyk, B2B tonalita, profesionálny vzhľad
- Štruktúrované sekcie + bullet pointy aby agent vedel parsovať
- ASCII-safe text (alebo reportlab s Unicode podporou — reportlab to zvláda OK pre slovenčinu)
- Output: `/mnt/documents/tkjd-app-brief.pdf`
- Po vygenerovaní: vizuálna QA (pdftoppm → check)

**Plán je krátky a priamy — žiadne otázky netreba klásť, kontext mám.**
