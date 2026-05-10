# Palvi · Reporte ejecutivo de ventas

App pensada para que el Jefe de Ventas la abra en la mañana y, en menos de un minuto, sepa dónde poner foco hoy. El selector arriba a la derecha cambia entre los datasets A/B/C/D — el "Foco del día" se ajusta solo, sin condicionales por dataset.

**Requisitos:** Node 18+ (probado con 20.11) y npm. En Mac: `brew install node`. En Windows: instalador desde [nodejs.org](https://nodejs.org) o `winget install OpenJS.NodeJS.LTS`.

```bash
npm install
npm run setup ~/Downloads/metrics.json                          # Mac / Linux
npm run setup C:\Users\TuUsuario\Downloads\metrics.json         # Windows
npm run dev                                                     # Vite imprime el URL en la terminal
```

`npm run setup` sin argumento busca `metrics.json` en `~/Downloads`, `~/Desktop` o la raíz del repo.

## Video

https://youtu.be/wMafzN51bN8

## Decisiones técnicas

**Producto antes que dashboard.** El brief dice "5 minutos antes de la reunión", no "todas las métricas en un grid". Por eso lo primero que se ve es el **Foco del día**: tres alertas ordenadas por prioridad. Los KPIs y el funnel quedan abajo como respaldo.

**Stack:** Vite + React 18 + TypeScript estricto + Tailwind. Sin Redux porque `useState` alcanza para lo que necesita la app.

**Estructura del proyecto.** Tres carpetas con responsabilidades separadas: `components/` que solo dibuja, `lib/` con la lógica pura sin React, y `data/` que solo carga el JSON. Eso deja la lógica del negocio aislada del framework: si mañana se quiere cambiar la UI, todo lo de `lib/` se reusa tal cual.

**El motor de alertas es lo que hace que A, B, C y D se vean distintos.** En `src/lib/focus.ts` se generan alertas candidatas: una por cada métrica, más cuatro alertas combinadas — win rate, pila de stale, response time alto, y cuello en el funnel. A cada alerta se le da un puntaje, se ordenan de mayor a menor, se quitan las repetidas por métrica, y se devuelven las tres más importantes. **No hay un solo `if dataset === 'A'`** en el código: las mismas reglas aplicadas a datos distintos producen alertas distintas. En el dataset entregado, A muestra problemas de soporte y stale, B se ve sano, C marca cuello en el funnel y D dispara response time como crítico.

**Cada métrica se calcula a su manera.** Para juntar varios días en un valor de ventana, cada métrica usa una estrategia distinta: `sum` para conteos (tráfico, leads, deals), `avg` para promedios diarios (response time, cycle, resolution), y `last` para valores que son un conteo al cierre del día como `stale_deals`. Todo está en `aggregationFor()`, así que cuando se agregue una métrica nueva, la decisión entra por una sola puerta. Tener esto en un solo lugar evita el bug clásico de sumar promedios.

**Promedios ponderados por volumen.** El glosario dice que `avg_deal_cycle_days` es "promedio sobre los deals que cerraron ese día". Si junto la ventana con un promedio simple, le doy el mismo peso a un día con 1 deal y a uno con 20 — eso miente. `weightedAvg` pondera por la métrica de volumen que corresponde: `leads_created` para response time, `deals_won + deals_lost` para deal cycle, `support_tickets_opened` para resolution hours.

**La dirección importa.** Cada métrica trae `direction` en el JSON, indicando si subir es bueno o malo. Una sola función (`isImprovementSign`) lo aplica y eso decide los colores, el puntaje y el texto de las alertas. Una baja en `deals_lost` pinta verde; una baja en `traffic` pinta rojo.

**Nulos respetados.** Un día sin leads no tiene response time — sumarlo como 0 ensuciaría el promedio. Los promedios saltan los nulos; los conteos los tratan como 0.

**Idioma.** UI en español porque el usuario final es un Jefe de Ventas en Chile. Los términos del glosario que ya se usan en inglés en ventas B2B (lead, deal, funnel, win rate, stale) se mantienen tal cual; los `label` que vienen del JSON tampoco se traducen, para no inventar mapeos sobre los datos del cliente.

## Segunda iteración

- **Tests automatizados** sobre las funciones de agregación, win rate, funnel y weighted avg. Quedaron fuera por tiempo (la prueba pide 3 horas), pero son la primera cosa que sumaría con un día más — el motor de alertas es donde más conviene tener pruebas, porque un cambio silencioso ahí cambia lo que ve el gerente.
- **Detectar cambios más finos.** Hoy comparo la ventana actual (7, 30 o 90 días) contra el período anterior del mismo largo. Con 365 días de historia se podrían comparar lunes contra lunes (y así con cada día) para descartar el ruido normal del fin de semana. No lo hice porque la comparación simple ya separa los 4 datasets correctamente — agregar más complejidad estadística no valía la pena para 3 horas.
- **Detalle al hacer clic en una alerta.** Hoy el funnel y los KPIs muestran contexto pero no permiten profundizar. Hacer clic en una alerta debería abrir un panel con la serie diaria, los deals afectados, etc.
- **Límites configurables.** Los valores que disparan una alerta crítica (60 minutos de response time, 150 stale deals) están fijos dentro de `focus.ts`. Cada empresa quisiera ajustar los suyos.
- **Recordar dataset y ventana en URL o localStorage**, para que abrir la app preserve el contexto del día anterior.
- **Performance.** Todo se recalcula en cada cambio de selección. Para 365 días × 4 datasets × 11 métricas es invisible; con varios años convendría guardar los cálculos por `(datasetId, windowDays)`.
- **Accesibilidad seria.** Hay roles ARIA pero falta probar con lector de pantalla y revisar contraste sistemáticamente en los rojo/verde.
