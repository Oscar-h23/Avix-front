import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AviPlazaConfig, AviViaConfig } from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';

@Component({
  selector: 'app-configuracion-vias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion-vias.component.html',
  styleUrl: './configuracion-vias.component.css'
})
export class ConfiguracionViasComponent implements OnInit {
  plazas: AviPlazaConfig[] = [];
  vias: AviViaConfig[] = [];
  plazaId: number | null = null;
  loading = false;
  savingId: number | null = null;
  error = '';
  message = '';

  constructor(private readonly api: AviApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.listarPlazasConfiguracion().subscribe({
      next: (plazas) => {
        this.plazas = plazas;
        this.plazaId = plazas[0]?.id ?? null;
        this.loading = false;
        if (this.plazaId != null) {
          this.cargarVias();
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message ?? 'No se pudieron cargar las plazas.';
      }
    });
  }

  cargarVias(): void {
    if (this.plazaId == null) {
      this.vias = [];
      return;
    }

    this.loading = true;
    this.error = '';
    this.message = '';

    this.api.listarViasConfiguracion(this.plazaId).subscribe({
      next: (vias) => {
        this.vias = vias;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message ?? 'No se pudieron cargar las vías.';
      }
    });
  }

  cambiarVisibilidad(via: AviViaConfig, visible: boolean): void {
    if (this.plazaId == null || this.savingId != null) {
      return;
    }

    this.savingId = via.id;
    this.error = '';
    this.message = '';

    this.api.actualizarVisibilidadVia(this.plazaId, via.id, visible).subscribe({
      next: (updated) => {
        this.savingId = null;
        this.vias = this.vias.map((item) =>
          item.id === updated.id ? updated : item
        );
        this.message = `Vía ${updated.numero} ${updated.visible ? 'habilitada' : 'ocultada'} en AVIX.`;
      },
      error: (error) => {
        this.savingId = null;
        this.error = error?.error?.message ?? 'No se pudo guardar la configuración.';
      }
    });
  }

  get visibles(): number {
    return this.vias.filter((via) => via.visible).length;
  }
}
