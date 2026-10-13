import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import {
  AviAccion,
  AviRegistro,
  RegistroQuery
} from '../../core/models/avi.models';
import { AviApiService } from '../../core/services/avi-api.service';
import {
  contextoOperativoActual,
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

  readonly registrosPorPagina = 20;
  paginaActual = 1;

  registros: AviRegistro[] = [];
  loading = false;
  error = '';
  ventanaDescripcion = '';
  readonly intervaloActualizacionSegundos = 10;
  autoActualizar = true;
  actualizandoEnSegundoPlano = false;
  ultimaActualizacion = '';

  editing: AviRegistro | null = null;
  editPlaca = '';
  editVia = '';
  editAccion: AviAccion = 'FUGA';
  saving = false;
  editError = '';

  private readonly destroyRef = inject(DestroyRef);
  private registrosRequest?: Subscription;
  private filtrosAplicados: RegistroQuery | null = null;
  private filtroOrigen?: AviRegistro[];
  private filtroTexto = '';
  private filtroResultado: AviRegistro[] = [];

  constructor(
    private readonly api: AviApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();

    // Una sola suscripción durante la vida de la pantalla; se libera al salir.
    timer(10_000, 10_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Evita consultas innecesarias cuando la pestaña no está visible y
        // no altera el historial mientras se edita o guarda un registro.
        if (
          !this.autoActualizar ||
          this.editing != null ||
          this.saving ||
          (typeof document !== 'undefined' && document.hidden)
        ) {
          return;
        }

        if (this.filtrosAplicados) {
          this.consultarRegistros(this.filtrosAplicados, true);
        }
      });
  }

  alternarActualizacionAutomatica(): void {
    this.autoActualizar = !this.autoActualizar;
    if (this.autoActualizar && !this.editing && !this.saving && this.filtrosAplicados) {
      this.consultarRegistros(this.filtrosAplicados, true);
    }
  }

  get franjas(): FranjaHoraria[] {
    return franjasPorTurno(this.turno);
  }

  get registrosFiltrados(): AviRegistro[] {
    const search = this.buscarPlaca.trim().toUpperCase();
    // Evita filtrar nuevamente en cada evaluación de la plantilla.
    if (this.filtroOrigen !== this.registros || this.filtroTexto !== search) {
      this.filtroOrigen = this.registros;
      this.filtroTexto = search;
      this.filtroResultado = search
        ? this.registros.filter((item) => item.placa.toUpperCase().includes(search))
        : this.registros;
    }

    return this.filtroResultado;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.registrosFiltrados.length / this.registrosPorPagina));
  }

  get registrosPaginados(): AviRegistro[] {
    const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
    return this.registrosFiltrados.slice(inicio, inicio + this.registrosPorPagina);
  }

  get primerRegistroPagina(): number {
    return this.registrosFiltrados.length === 0
      ? 0
      : (this.paginaActual - 1) * this.registrosPorPagina + 1;
  }

  get ultimoRegistroPagina(): number {
    return Math.min(this.paginaActual * this.registrosPorPagina, this.registrosFiltrados.length);
  }

  irAPagina(pagina: number): void {
    if (!Number.isInteger(pagina)) return;
    this.paginaActual = Math.max(1, Math.min(pagina, this.totalPaginas));
  }

  cambiarBusquedaPlaca(valor: string): void {
    this.buscarPlaca = valor;
    this.paginaActual = 1;
  }

  cambiarTurno(): void {
    this.franja = null;
    this.cargar();
  }

  cargar(reiniciarPagina = true): void {
    if (reiniciarPagina) {
      this.paginaActual = 1;
    }

    const window = ventanaOperativa(
      this.fecha,
      this.turno,
      this.franja
    );

    this.ventanaDescripcion = window.descripcion;
    const parsedVia = Number(this.via);

    // El temporizador reutiliza únicamente los filtros ya aplicados,
    // sin incluir cambios que el usuario todavía esté escribiendo.
    const query: RegistroQuery = {
      desde: window.desde,
      hasta: window.hasta,
      via:
        this.via.trim() && Number.isInteger(parsedVia) && parsedVia > 0
          ? parsedVia
          : undefined,
      accion: this.accion || undefined
    };
    this.filtrosAplicados = query;
    this.consultarRegistros(query, false);
  }

  private consultarRegistros(query: RegistroQuery, automatico: boolean): void {
    // Si una actualización anterior sigue activa, esperar al próximo ciclo.
    // En cambio, "Aplicar filtros" puede cancelar una consulta obsoleta.
    if (automatico && this.registrosRequest && !this.registrosRequest.closed) {
      return;
    }

    this.registrosRequest?.unsubscribe();
    this.loading = !automatico;
    this.actualizandoEnSegundoPlano = automatico;

    if (!automatico) {
      this.error = '';
    }

    this.registrosRequest = this.api.listarRegistros(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.loading = false;
          this.actualizandoEnSegundoPlano = false;
          this.error = '';
          this.registros = [...items].sort(
            (a, b) =>
              new Date(b.fechaHoraEvento).getTime() -
              new Date(a.fechaHoraEvento).getTime()
          );
          // Si cambian los resultados del servidor, conservar la página
          // actual siempre que siga existiendo (también en el refresco de 10 s).
          this.paginaActual = Math.min(this.paginaActual, this.totalPaginas);
          this.ultimaActualizacion = new Date().toLocaleTimeString('es-PE', {
            timeZone: 'America/Lima',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loading = false;
          this.actualizandoEnSegundoPlano = false;
          // Mantener en pantalla los últimos registros correctos si falla
          // una actualización de fondo; se reintentará en 10 segundos.
          this.error = error?.error?.message ??
            'No se pudo actualizar el historial en SIGO. Se reintentará automáticamente.';
          this.cdr.markForCheck();
        }
      });

    this.cdr.markForCheck();
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
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        this.cargar(false);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.saving = false;
        this.editError =
          error?.error?.message ??
          'No se pudo actualizar el registro.';
        this.cdr.markForCheck();
      }
    });
  }
}
