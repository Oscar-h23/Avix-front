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
  const date = new Date(iso);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

export function dateTimeLabelFromIso(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(date);
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
