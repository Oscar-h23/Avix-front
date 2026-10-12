import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
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

  private readonly destroyRef = inject(DestroyRef);
  private viasRequest?: Subscription;

  constructor(
    private readonly api: AviApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.listarPlazasConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plazas) => {
          this.plazas = plazas;
          this.plazaId = plazas[0]?.id ?? null;
          if (this.plazaId != null) {
            this.cargarVias();
          } else {
            this.loading = false;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.message ?? 'No se pudieron cargar las plazas.';
          this.cdr.markForCheck();
        }
      });
  }

  cargarVias(): void {
    // Cancelar la consulta anterior evita que una plaza antigua sobrescriba a la nueva.
    this.viasRequest?.unsubscribe();
    this.vias = [];

    if (this.plazaId == null) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = '';
    this.message = '';

    this.viasRequest = this.api.listarViasConfiguracion(this.plazaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vias) => {
          this.vias = vias;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.message ?? 'No se pudieron cargar las vías.';
          this.cdr.markForCheck();
        }
      });
    this.cdr.markForCheck();
  }

  cambiarVisibilidad(via: AviViaConfig, visible: boolean): void {
    if (this.plazaId == null || this.savingId != null) {
      return;
    }

    const plazaId = this.plazaId;
    this.savingId = via.id;
    this.error = '';
    this.message = '';

    this.api.actualizarVisibilidadVia(plazaId, via.id, visible)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.savingId = null;
          if (this.plazaId === plazaId) {
            this.vias = this.vias.map((item) =>
              item.id === updated.id ? updated : item
            );
            this.message = `Vía ${updated.numero} ${updated.visible ? 'habilitada' : 'ocultada'} en AVIX.`;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.savingId = null;
          this.error = error?.error?.message ?? 'No se pudo guardar la configuración.';
          this.cdr.markForCheck();
        }
      });
  }

  get visibles(): number {
    return this.vias.filter((via) => via.visible).length;
  }
}
