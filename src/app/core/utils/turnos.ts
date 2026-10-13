export type TurnoFiltro = 'TODOS' | 'A' | 'B' | 'C';

export interface FranjaHoraria {
  value: number;
  label: string;
}

export interface VentanaTiempo {
  desde: string;
  hasta: string;
  descripcion: string;
}

const PERU_OFFSET = '-05:00';

// Reutilizar Intl.DateTimeFormat evita construir uno por cada fila de la tabla.
const HOUR_LABEL_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const DATE_TIME_LABEL_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const LIMITES: Record<TurnoFiltro, [number, number]> = {
  TODOS: [6, 30],
  A: [6, 14],
  B: [14, 22],
  C: [22, 30]
};

export const TURNOS: Array<{
  value: TurnoFiltro;
  label: string;
  horario: string;
}> = [
  { value: 'TODOS', label: 'Todos', horario: '06:00–06:00' },
  { value: 'A', label: 'Turno A', horario: '06:00–14:00' },
  { value: 'B', label: 'Turno B', horario: '14:00–22:00' },
  { value: 'C', label: 'Turno C', horario: '22:00–06:00' }
];

export function franjasPorTurno(turno: TurnoFiltro): FranjaHoraria[] {
  if (turno === 'TODOS') {
    return [];
  }

  const [inicio, fin] = LIMITES[turno];
  const result: FranjaHoraria[] = [];

  for (let hour = inicio; hour < fin; hour++) {
    const visibleStart = hour % 24;
    const visibleEnd = (hour + 1) % 24;
    result.push({
      value: hour,
      label: `${pad(visibleStart)}:00 – ${pad(visibleEnd)}:00`
    });
  }

  return result;
}

export function ventanaOperativa(
  fecha: string,
  turno: TurnoFiltro,
  franja?: number | null
): VentanaTiempo {
  const [inicioTurno, finTurno] = LIMITES[turno];

  const inicio =
    franja != null && turno !== 'TODOS'
      ? franja
      : inicioTurno;

  const fin =
    franja != null && turno !== 'TODOS'
      ? franja + 1
      : finTurno;

  return {
    desde: isoOperativo(fecha, inicio),
    hasta: isoOperativo(fecha, fin),
    descripcion:
      franja != null && turno !== 'TODOS'
        ? `${pad(inicio % 24)}:00 – ${pad(fin % 24)}:00`
        : turno === 'TODOS'
          ? 'Día operativo 06:00 – 06:00'
          : `Turno ${turno} · ${pad(inicioTurno % 24)}:00 – ${pad(finTurno % 24)}:00`
  };
}

/**
 * Ventana del mes OPERATIVO: desde las 06:00 del día 1 hasta las 06:00
 * del día 1 del mes siguiente. Así se incluye completo el último turno C.
 * Usa fechas civiles de Lima y no la zona horaria del navegador.
 */
export function ventanaMensualOperativa(mes: string): VentanaTiempo {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new Error('Mes operativo inválido');
  }

  const [year, month] = mes.split('-').map(Number);
  const firstDay = `${mes}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const nextDay = [
    nextMonth.getUTCFullYear(),
    pad(nextMonth.getUTCMonth() + 1),
    '01'
  ].join('-');

  const label = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return {
    desde: `${firstDay}T06:00:00${PERU_OFFSET}`,
    // El backend usa <= :hasta: excluir las 06:00 exactas del nuevo mes.
    hasta: `${nextDay}T05:59:59.999${PERU_OFFSET}`,
    descripcion: `Mes operativo: ${label} · 06:00–06:00`
  };
}

/** Cantidad de jornadas operativas que forman un mes calendario. */
export function diasDelMes(mes: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return 0;
  }
  const [year, month] = mes.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Vista del gráfico: ocho franjas por turno o las 24 franjas cuando
 * se seleccionan todos. No modifica el filtro horario del Historial.
 */
export function franjasDashboard(turno: TurnoFiltro): FranjaHoraria[] {
  if (turno !== 'TODOS') return franjasPorTurno(turno);

  const franjas: FranjaHoraria[] = [];
  for (let hour = 6; hour < 30; hour++) {
    franjas.push({
      value: hour,
      label: `${pad(hour % 24)}:00 – ${pad((hour + 1) % 24)}:00`
    });
  }
  return franjas;
}

/** A/B/C por la hora LOCAL de Lima; C comprende 22:00–05:59. */
export function perteneceATurno(horaLima: number, turno: TurnoFiltro): boolean {
  if (turno === 'TODOS') return true;
  if (turno === 'A') return horaLima >= 6 && horaLima < 14;
  if (turno === 'B') return horaLima >= 14 && horaLima < 22;
  return horaLima >= 22 || horaLima < 6;
}

export function contextoOperativoActual(): {
  fecha: string;
  turno: Exclude<TurnoFiltro, 'TODOS'>;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const part = (type: string): string =>
    parts.find((item) => item.type === type)?.value ?? '';

  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const hour = Number(part('hour'));

  if (hour < 6) {
    return {
      fecha: addDays(date, -1),
      turno: 'C'
    };
  }

  if (hour < 14) {
    return { fecha: date, turno: 'A' };
  }

  if (hour < 22) {
    return { fecha: date, turno: 'B' };
  }

  return { fecha: date, turno: 'C' };
}

export function hourLabelFromIso(iso: string): string {
  return HOUR_LABEL_FORMATTER.format(new Date(iso));
}

export function dateTimeLabelFromIso(iso: string): string {
  return DATE_TIME_LABEL_FORMATTER.format(new Date(iso));
}

function isoOperativo(fecha: string, horaOperativa: number): string {
  const dayOffset = Math.floor(horaOperativa / 24);
  const hour = horaOperativa % 24;
  const date = addDays(fecha, dayOffset);
  return `${date}T${pad(hour)}:00:00${PERU_OFFSET}`;
}

function addDays(fecha: string, days: number): string {
  const [year, month, day] = fecha.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    value.getUTCFullYear(),
    pad(value.getUTCMonth() + 1),
    pad(value.getUTCDate())
  ].join('-');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
