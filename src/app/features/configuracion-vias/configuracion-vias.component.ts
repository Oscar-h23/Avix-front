import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener,
  OnInit, ViewChild, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AviPlazaConfig, AviViaConfig } from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';

interface CambioPendiente {
  plazaId: number;
  plazaCodigo: string;
  viaId: number;
  numero: number;
  nombre: string | null;
  visible: boolean;
}

interface Notificacion {
  tipo: 'success' | 'error';
  titulo: string;
  detalle: string;
}

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
  cambioPendiente: CambioPendiente | null = null;
  notificacion: Notificacion | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private viasRequest?: Subscription;
  private notificacionTimer?: ReturnType<typeof setTimeout>;
  private botonOrigen: HTMLButtonElement | null = null;

  // Enfocar el cuadro de confirmación al abrirlo también permite usar el teclado.
  @ViewChild('botonCancelar')
  set botonCancelar(elemento: ElementRef<HTMLButtonElement> | undefined) {
    elemento?.nativeElement.focus();
  }

  constructor(
    private readonly api: AviApiService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.destroyRef.onDestroy(() => {
      if (this.notificacionTimer) clearTimeout(this.notificacionTimer);
    });
  }

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
    this.viasRequest?.unsubscribe();
    this.vias = [];
    this.cambioPendiente = null;

    if (this.plazaId == null) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = '';

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

  solicitarCambio(via: AviViaConfig, event: MouseEvent): void {
    if (this.plazaId == null || this.loading || this.savingId != null || this.cambioPendiente) {
      return;
    }

    this.botonOrigen = event.currentTarget as HTMLButtonElement;
    const plaza = this.plazas.find(item => item.id === this.plazaId);
    this.cambioPendiente = {
      plazaId: this.plazaId,
      plazaCodigo: plaza?.codigo ?? String(this.plazaId),
      viaId: via.id,
      numero: via.numero,
      nombre: via.nombre,
      visible: !via.visible
    };
    // Todavía no se cambia el switch ni se envía ninguna solicitud al backend.
    this.cdr.markForCheck();
  }

  cancelarCambio(): void {
    if (!this.cambioPendiente) return;
    this.cambioPendiente = null;
    this.botonOrigen?.focus();
    this.botonOrigen = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.cancelarCambio();
  }

  confirmarCambio(): void {
    const cambio = this.cambioPendiente;
    if (!cambio || this.savingId !== null || this.plazaId !== cambio.plazaId) return;

    this.cambioPendiente = null;
    this.botonOrigen = null;
    this.savingId = cambio.viaId;
    this.cerrarNotificacion();
    this.cdr.markForCheck();

    this.api.actualizarVisibilidadVia(cambio.plazaId, cambio.viaId, cambio.visible)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.savingId = null;
          if (this.plazaId === cambio.plazaId) {
            this.vias = this.vias.map(via =>
              via.id === actualizada.id ? actualizada : via
            );
          }

          if (actualizada.visible === cambio.visible) {
            this.mostrarNotificacion({
              tipo: 'success',
              titulo: cambio.visible ? 'Vía habilitada' : 'Vía deshabilitada',
              detalle: `Vía ${cambio.numero} de ${cambio.plazaCodigo}: cambio guardado correctamente.`
            });
          } else {
            this.mostrarNotificacion({
              tipo: 'error',
              titulo: 'No se confirmó el cambio',
              detalle: 'El servidor devolvió un estado diferente al solicitado. Revisa la configuración.'
            });
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.savingId = null;
          this.mostrarNotificacion({
            tipo: 'error',
            titulo: 'No se pudo guardar',
            detalle: error?.error?.message ?? `No fue posible cambiar la vía ${cambio.numero}. Inténtalo nuevamente.`
          });
          this.cdr.markForCheck();
        }
      });
  }

  cerrarNotificacion(): void {
    if (this.notificacionTimer) clearTimeout(this.notificacionTimer);
    this.notificacionTimer = undefined;
    this.notificacion = null;
    this.cdr.markForCheck();
  }

  private mostrarNotificacion(notificacion: Notificacion): void {
    this.cerrarNotificacion();
    this.notificacion = notificacion;
    this.notificacionTimer = setTimeout(() => {
      this.notificacion = null;
      this.notificacionTimer = undefined;
      this.cdr.markForCheck();
    }, notificacion.tipo === 'success' ? 5500 : 9000);
    this.cdr.markForCheck();
  }

  get visibles(): number {
    return this.vias.filter(via => via.visible).length;
  }
}
