## Problém
Na obrazovke **Schvaľovanie** sa záznamy v rozbalenej karte zobrazujú v náhodnom poradí (napr. štvrtok → piatok → pondelok → utorok → streda) namiesto chronologicky.

## Príčina
V `src/pages/Approvals.tsx` sa `performance_records` načítavajú z databázy bez `.order("date")`. PostgreSQL bez ORDER BY vracia riadky v ľubovoľnom poradí (typicky podľa fyzického zápisu = poradia vytvorenia záznamu, nie podľa dátumu).

To isté sa deje pri Pending aj pri Histórii (approved).

## Riešenie

**Súbor: `src/pages/Approvals.tsx`**

### 1. Pending fetch (cca riadok 117–121)
Pridať zoradenie podľa dátumu a času začiatku:
```typescript
.eq("status", "submitted")
.order("date", { ascending: true })
.order("time_from", { ascending: true });
```

### 2. Approved (História) fetch (v slučke `for (const closing of approvedClosings)`)
Rovnako:
```typescript
.eq("status", "approved")
.order("date", { ascending: true })
.order("time_from", { ascending: true });
```

### 3. Poistka v JS (po `.filter(isDateInWeek)`)
Pre obidve vetvy doplniť `.sort()` aby chronologické poradie bolo garantované aj keby sa logika filtrovania v budúcnosti zmenila:
```typescript
const weekRecords = (records as PerformanceRecord[] || [])
  .filter((r) => isDateInWeek(r.date, closing.calendar_week, closing.year))
  .sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time_from.localeCompare(b.time_from);
  });
```

## Výsledok
- V karte (Pending aj História) budú dni vždy: **pondelok → utorok → streda → štvrtok → piatok → sobota → nedeľa**
- V rámci jedného dňa zoradené podľa času začiatku práce

## Čo sa NEMENÍ
- Žiadna DB migrácia
- Žiadne zmeny vizuálu, len poradie záznamov
- Žiadne iné súbory