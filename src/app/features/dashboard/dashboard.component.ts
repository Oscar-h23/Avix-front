import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AviRegistro } from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';
import {
  contextoOperativoActual,
  dateTimeLabelFromIso,
  franjasPorTurno,
  TurnoFiltro,
  TURNOS,
  ventanaOperativa
} from '../../core/utils/turnos';

interface HourItem {
  label: string;
  total: number;
  fugas: number;
  derivados: number;
  width: number;
}

interface ViaItem {
  via: number;
  total: number;
  fugas: number;
  derivados: number;
  width: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  readonly turnos = TURNOS.filter((item) => item.value !== 'TODOS');

  fecha = contextoOperativoActual().fecha;
  turno: TurnoFiltro = contextoOperativoActual().turno;

  registros: AviRegistro[] = [];
  loading = false;
  error = '';
  ventanaDescripcion = '';
  ultimaActualizacion = '';

  total = 0;
  fugas = 0;
  derivados = 0;
  placasUnicas = 0;
  operadoresActivos = 0;

  porcentajeFugas = 0;
  porcentajeDerivados = 0;
  promedioPorHora = 0;

  viaLider = '—';
  viaLiderTotal = 0;
  horaPico = '—';
  horaPicoTotal = 0;

  porVia: ViaItem[] = [];
  porHora: HourItem[] = [];

  constructor(private readonly api: AviApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get esTurnoActual(): boolean {
    const actual = contextoOperativoActual();
    return actual.fecha === this.fecha && actual.turno === this.turno;
  }

  get donutBackground(): string {
    if (!this.total) {
      return 'conic-gradient(#e2e8f0 0 100%)';
    }

    return `conic-gradient(
      #dc2626 0 ${this.porcentajeFugas}%,
      #2563eb ${this.porcentajeFugas}% 100%
    )`;
  }

  seleccionarTurno(turno: TurnoFiltro): void {
    if (this.turno === turno || turno === 'TODOS') {
      return;
    }

    this.turno = turno;
    this.cargar();
  }

  cargar(): void {
    const ventana = ventanaOperativa(this.fecha, this.turno);
    this.ventanaDescripcion = ventana.descripcion;
    this.loading = true;
    this.error = '';

    this.api.listarRegistros({
      desde: ventana.desde,
      hasta: ventana.hasta
    }).subscribe({
      next: (registros) => {
        this.loading = false;
        this.registros = [...registros].sort(
          (a, b) =>
            new Date(b.fechaHoraEvento).getTime() -
            new Date(a.fechaHoraEvento).getTime()
        );
        this.recalcular();
        this.ultimaActualizacion = new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23'
        }).format(new Date());
      },
      error: (error) => {
        this.loading = false;
        this.error =
          error?.error?.message ??
          'No se pudo cargar el dashboard desde SIGO.';
      }
    });
  }

  fechaEvento(iso: string): string {
    return dateTimeLabelFromIso(iso);
  }

  private recalcular(): void {
    this.total = this.registros.length;
    this.fugas = this.registros.filter(
      (item) => item.accion === 'FUGA'
    ).length;
    this.derivados = this.registros.filter(
      (item) => item.accion === 'DERIVADO'
    ).length;
    this.placasUnicas = new Set(
      this.registros.map((item) => item.placa)
    ).size;
    this.operadoresActivos = new Set(
      this.registros.map((item) => item.usuarioId)
    ).size;

    this.porcentajeFugas = this.total
      ? Math.round((this.fugas / this.total) * 100)
      : 0;
    this.porcentajeDerivados = this.total
      ? 100 - this.porcentajeFugas
      : 0;

    const franjas = franjasPorTurno(this.turno);
    this.promedioPorHora = franjas.length
      ? Number((this.total / franjas.length).toFixed(1))
      : 0;

    const vias = new Map<
      number,
      { total: number; fugas: number; derivados: number }
    >();

    for (const item of this.registros) {
      const actual = vias.get(item.via) ?? {
        total: 0,
        fugas: 0,
        derivados: 0
      };

      actual.total++;

      if (item.accion === 'FUGA') {
        actual.fugas++;
      } else {
        actual.derivados++;
      }

      vias.set(item.via, actual);
    }

    const viaRows = [...vias.entries()]
      .sort((a, b) => b[1].total - a[1].total);

    const maxVia = Math.max(
      1,
      ...viaRows.map(([, data]) => data.total)
    );

    this.porVia = viaRows.map(([via, data]) => ({
      via,
      total: data.total,
      fugas: data.fugas,
      derivados: data.derivados,
      width: Math.max(5, (data.total / maxVia) * 100)
    }));

    const viaTop = this.porVia[0];
    this.viaLider = viaTop ? `Vía ${viaTop.via}` : '—';
    this.viaLiderTotal = viaTop?.total ?? 0;

    const byHour = new Map<
      number,
      { total: number; fugas: number; derivados: number }
    >();

    for (const item of this.registros) {
      const hour = this.horaLima(item.fechaHoraEvento);
      const actual = byHour.get(hour) ?? {
        total: 0,
        fugas: 0,
        derivados: 0
      };

      actual.total++;

      if (item.accion === 'FUGA') {
        actual.fugas++;
      } else {
        actual.derivados++;
      }

      byHour.set(hour, actual);
    }

    const rawHours = franjas.map((franja) => {
      const hour = franja.value % 24;
      const data = byHour.get(hour) ?? {
        total: 0,
        fugas: 0,
        derivados: 0
      };

      return {
        label: franja.label,
        total: data.total,
        fugas: data.fugas,
        derivados: data.derivados
      };
    });

    const maxHour = Math.max(
      1,
      ...rawHours.map((item) => item.total)
    );

    this.porHora = rawHours.map((item) => ({
      ...item,
      width: item.total
        ? Math.max(5, (item.total / maxHour) * 100)
        : 0
    }));

    const peak = this.porHora.reduce<HourItem | null>(
      (best, item) =>
        !best || item.total > best.total
          ? item
          : best,
      null
    );

    this.horaPico =
      peak && peak.total > 0
        ? peak.label
        : '—';
    this.horaPicoTotal = peak?.total ?? 0;
  }

  private horaLima(iso: string): number {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(iso));

    return Number(hour);
  }
}
