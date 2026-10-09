import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AviAccion,
  AviRegistro
} from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';
import {
  contextoOperativoActual,
  dateTimeLabelFromIso,
  FranjaHoraria,
  franjasPorTurno,
  TurnoFiltro,
  TURNOS,
  ventanaOperativa
} from '../../core/utils/turnos';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.component.html',
  styleUrl: './historial.component.css'
})
export class HistorialComponent implements OnInit {
  readonly turnos = TURNOS;

  fecha = contextoOperativoActual().fecha;
  turno: TurnoFiltro = contextoOperativoActual().turno;
  franja: number | null = null;
  accion: '' | AviAccion = '';
  via = '';
  buscarPlaca = '';

  registros: AviRegistro[] = [];
  loading = false;
  error = '';
  ventanaDescripcion = '';

  editing: AviRegistro | null = null;
  editPlaca = '';
  editVia = '';
  editAccion: AviAccion = 'FUGA';
  saving = false;
  editError = '';

  constructor(private readonly api: AviApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get franjas(): FranjaHoraria[] {
    return franjasPorTurno(this.turno);
  }

  get registrosFiltrados(): AviRegistro[] {
    const search = this.buscarPlaca
      .trim()
      .toUpperCase();

    if (!search) {
      return this.registros;
    }

    return this.registros.filter((item) =>
      item.placa.toUpperCase().includes(search)
    );
  }

  cambiarTurno(): void {
    this.franja = null;
  }

  cargar(): void {
    const window = ventanaOperativa(
      this.fecha,
      this.turno,
      this.franja
    );

    this.ventanaDescripcion = window.descripcion;
    this.loading = true;
    this.error = '';

    const parsedVia = Number(this.via);

    this.api.listarRegistros({
      desde: window.desde,
      hasta: window.hasta,
      via:
        this.via.trim() && Number.isInteger(parsedVia) && parsedVia > 0
          ? parsedVia
          : undefined,
      accion: this.accion || undefined
    }).subscribe({
      next: (items) => {
        this.loading = false;
        this.registros = [...items].sort(
          (a, b) =>
            new Date(b.fechaHoraEvento).getTime() -
            new Date(a.fechaHoraEvento).getTime()
        );
      },
      error: (error) => {
        this.loading = false;
        this.error =
          error?.error?.message ??
          'No se pudo consultar el historial en SIGO.';
      }
    });
  }

  limpiar(): void {
    const current = contextoOperativoActual();
    this.fecha = current.fecha;
    this.turno = current.turno;
    this.franja = null;
    this.accion = '';
    this.via = '';
    this.buscarPlaca = '';
    this.cargar();
  }

  fechaEvento(iso: string): string {
    return dateTimeLabelFromIso(iso);
  }

  abrirEdicion(item: AviRegistro): void {
    this.editing = item;
    this.editPlaca = item.placa;
    this.editVia = String(item.via);
    this.editAccion = item.accion;
    this.editError = '';
  }

  cerrarEdicion(): void {
    if (!this.saving) {
      this.editing = null;
    }
  }

  guardarEdicion(): void {
    if (!this.editing) {
      return;
    }

    const placa = this.editPlaca
      .trim()
      .toUpperCase()
      .replaceAll('-', '')
      .replaceAll(' ', '');

    const via = Number(this.editVia);

    if (!/^[A-Z][A-Z0-9]{2}\d{3}$/.test(placa)) {
      this.editError = 'La placa debe tener 6 posiciones y terminar en 3 números.';
      return;
    }

    if (!Number.isInteger(via) || via <= 0) {
      this.editError = 'Ingresa una vía válida.';
      return;
    }

    this.saving = true;
    this.editError = '';

    this.api.actualizarRegistro(this.editing.id, {
      placa,
      via,
      accion: this.editAccion,
      fechaHoraEvento: this.editing.fechaHoraEvento,
      textoReconocido: this.editing.textoReconocido ?? ''
    }).subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        this.cargar();
      },
      error: (error) => {
        this.saving = false;
        this.editError =
          error?.error?.message ??
          'No se pudo actualizar el registro.';
      }
    });
  }
}
