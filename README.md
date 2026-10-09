# AVIX Front

Panel web de AVIX conectado a SIGO-BACK.

## Módulos

- Login por código de trabajador.
- Dashboard operativo por fecha y turno.
- Historial con filtros por:
  - fecha operativa,
  - turno,
  - periodos de una hora,
  - acción,
  - vía,
  - placa.
- Edición de registros desde el historial.

## Turnos

| Turno | Horario |
| --- | --- |
| A | 06:00–14:00 |
| B | 14:00–22:00 |
| C | 22:00–06:00 del día siguiente |

El filtro por hora se genera de acuerdo con el turno seleccionado. Por ejemplo, el turno A muestra 06:00–07:00, 07:00–08:00, ..., 13:00–14:00. El turno C maneja correctamente el cambio de fecha después de medianoche.

## API

El proyecto usa rutas relativas `/api`.

En desarrollo, `proxy.conf.json` redirige al backend desplegado:

`https://sigo-back-production-70c2.up.railway.app`

Para Vercel se incluye `vercel.json` con el mismo proxy, evitando exponer problemas de CORS en el navegador.

## Desarrollo

```bash
npm install
npm start
```

Abrir:

`http://localhost:4200`

## Build

```bash
npm run build
```
