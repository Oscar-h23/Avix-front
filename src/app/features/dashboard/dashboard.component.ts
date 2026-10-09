import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AviRegistro } from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';
import {
  contextoOperativoActual,
  dateTimeLabelFromIso,
  TurnoFiltro,
  TURNOS,
  ventanaOperativa
} from '../../core/utils/turnos';

interface BarItem {
  label: string;
  value: number;
  width: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  total = 0;
  fugas = 0;
  derivados = 0;
  placasUnicas = 0;

  porVia: BarItem[] = [];
  porHora: BarItem[] = [];

  constructor(private readonly api: AviApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    const ventana = ventanaOperativa(this.fecha, this.turno);
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
    this.fugas = this.registros.filter((item) => item.accion === 'FUGA').length;
    this.derivados = this.registros.filter((item) => item.accion === 'DERIVADO').length;
    this.placasUnicas = new Set(this.registros.map((item) => item.placa)).size;

    const vias = new Map<number, number>();
    const horas = new Map<string, number>();

    for (const item of this.registros) {
      vias.set(item.via, (vias.get(item.via) ?? 0) + 1);

      const hour = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        hourCycle: 'h23'
      }).format(new Date(item.fechaHoraEvento));

      horas.set(hour, (horas.get(hour) ?? 0) + 1);
    }

    this.porVia = this.toBars(
      [...vias.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([via, value]) => [`Vía ${via}`, value])
    );

    this.porHora = this.toBars(
      [...horas.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([hour, value]) => [`${hour}:00`, value])
    );
  }

  private toBars(entries: Array<[string, number]>): BarItem[] {
    const max = Math.max(1, ...entries.map((item) => item[1]));
    return entries.map(([label, value]) => ({
      label,
      value,
      width: Math.max(6, (value / max) * 100)
    }));
  }
}
