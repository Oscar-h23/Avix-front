import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AviPlazaConfig, AviRegistro } from '../../core/models/avi.models';
import { AuthService } from '../../core/auth/auth.service';
import { AviApiService } from '../../core/services/avi-api.service';
import {
  contextoOperativoActual,
  dateTimeLabelFromIso,
  diasDelMes,
  franjasDashboard,
  perteneceATurno,
  TurnoFiltro,
  TURNOS,
  ventanaMensualOperativa,
  ventanaOperativa
} from '../../core/utils/turnos';

interface HourItem {
  label: string;
  total: number;
  fugas: number;
  derivados: number;
  liberados: number;
  width: number;
}

interface ViaItem {
  via: number;
  total: number;
  fugas: number;
  derivados: number;
  liberados: number;
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
  readonly turnos = TURNOS;
  periodo: 'DIA' | 'MES' = 'DIA';
  fecha = contextoOperativoActual().fecha;
  mes = this.fecha.slice(0, 7);
  turno: TurnoFiltro = contextoOperativoActual().turno;

  // El filtro utiliza plazaId, disponible en la API de registros.
  // El supervisor puede consultar todas; el resto conserva su plaza asignada.
  plazasDisponibles: AviPlazaConfig[] = [];
  plazaSeleccionada: number | null = null;
  puedeFiltrarPlazas = false;
  errorPlazas = '';

  registros: AviRegistro[] = [];
  loading = false;
  error = '';
  ventanaDescripcion = '';
  ultimaActualizacion = '';

  total = 0;
  fugas = 0;
  derivados = 0;
  liberados = 0;
  placasUnicas = 0;
  operadoresActivos = 0;
  readonly turnosOperativos = ['A', 'B', 'C'] as const;
  resumenTurnos: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };

  porcentajeFugas = 0;
  porcentajeDerivados = 0;
  porcentajeLiberados = 0;
  promedioPorHora = 0;

  viaLider = '—';
  viaLiderTotal = 0;
  horaPico = '—';
  horaPicoTotal = 0;

  porVia: ViaItem[] = [];
  porHora: HourItem[] = [];

  private readonly destroyRef = inject(DestroyRef);
  private registrosRequest?: Subscription;
  private readonly hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    hourCycle: 'h23'
  });

  constructor(
    private readonly api: AviApiService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {
    const usuario = this.auth.usuario();
    this.puedeFiltrarPlazas = usuario?.rol === 'SUPERVISOR';
    this.plazaSeleccionada = this.puedeFiltrarPlazas
      ? null
      : (usuario?.plazaId ?? null);

    if (usuario?.plazaId != null) {
      this.plazasDisponibles = [{
        id: usuario.plazaId,
        codigo: usuario.plaza || `Plaza ${usuario.plazaId}`,
        descripcion: null
      }];
    }
  }

  ngOnInit(): void {
    this.cargarPlazas();
    this.cargar();
  }

  get plazaActualLabel(): string {
    if (this.plazaSeleccionada === null) {
      return 'Todas las plazas';
    }

    return this.plazasDisponibles.find(
      (item) => item.id === this.plazaSeleccionada
    )?.codigo || `Plaza ${this.plazaSeleccionada}`;
  }

  seleccionarPlaza(plazaId: number | null): void {
    if (!this.puedeFiltrarPlazas || this.plazaSeleccionada === plazaId) {
      return;
    }

    this.plazaSeleccionada = plazaId;
    this.cargar();
  }

  private cargarPlazas(): void {
    // El catálogo administrativo solo está autorizado para supervisores.
    if (!this.puedeFiltrarPlazas) return;

    this.api.listarPlazasConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plazas) => {
          this.incorporarPlazas(plazas);
          this.errorPlazas = '';
          this.cdr.markForCheck();
        },
        error: () => {
          // Si falla el catálogo, permitir las plazas presentes en los
          // registros autorizados sin bloquear el dashboard.
          this.errorPlazas = 'Catálogo de plazas no disponible; se muestran las plazas detectadas.';
          this.cdr.markForCheck();
        }
      });
  }

  private incorporarPlazas(plazas: AviPlazaConfig[]): void {
    const mapa = new Map(this.plazasDisponibles.map((plaza) => [plaza.id, plaza]));
    for (const plaza of plazas) {
      mapa.set(plaza.id, plaza);
    }

    this.plazasDisponibles = [...mapa.values()].sort(
      (a, b) => a.id - b.id
    );
  }

  get esTurnoActual(): boolean {
    const actual = contextoOperativoActual();
    if (this.periodo === 'MES') return this.mes === actual.fecha.slice(0, 7);
    return actual.fecha === this.fecha &&
      (this.turno === 'TODOS' || actual.turno === this.turno);
  }

  get estadoPeriodo(): string {
    if (!this.esTurnoActual) return 'Consulta histórica';
    if (this.periodo === 'MES') return 'Mes en curso';
    return this.turno === 'TODOS' ? 'Jornada en curso' : 'Turno en curso';
  }

  get esMes(): boolean {
    return this.periodo === 'MES';
  }

  seleccionarPeriodo(periodo: 'DIA' | 'MES'): void {
    if (this.periodo === periodo) return;
    this.periodo = periodo;
    if (periodo === 'MES') this.mes = this.fecha.slice(0, 7);
    this.cargar();
  }

  get horasDelPeriodo(): number {
    const dias = this.periodo === 'MES' ? diasDelMes(this.mes) : 1;
    return dias * (this.turno === 'TODOS' ? 24 : 8);
  }

  get donutBackground(): string {
    if (!this.total) {
      return 'conic-gradient(#e2e8f0 0 100%)';
    }

    const finDerivados = this.porcentajeFugas + this.porcentajeDerivados;
    return `conic-gradient(
      #dc2626 0 ${this.porcentajeFugas}%,
      #2563eb ${this.porcentajeFugas}% ${finDerivados}%,
      #059669 ${finDerivados}% 100%
    )`;
  }

  seleccionarTurno(turno: TurnoFiltro): void {
    if (this.turno === turno) {
      return;
    }

    this.turno = turno;
    this.cargar();
  }

  cargar(): void {
    // La última selección de fecha/turno es la única que debe actualizar la pantalla.
    this.registrosRequest?.unsubscribe();

    if (this.esMes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.mes)) {
      this.loading = false;
      this.error = 'Selecciona un mes válido para consultar el dashboard.';
      this.registros = [];
      this.recalcular();
      this.cdr.markForCheck();
      return;
    }

    // El mes se solicita como una única ventana completa y se filtra
    // el turno localmente; un rango continuo A/B/C incluiría otros turnos.
    const ventana = this.esMes
      ? ventanaMensualOperativa(this.mes)
      : ventanaOperativa(this.fecha, this.turno);
    this.ventanaDescripcion = ventana.descripcion;
    this.loading = true;
    this.error = '';

    this.registrosRequest = this.api.listarRegistros({
      desde: ventana.desde,
      hasta: ventana.hasta,
      plazaId: this.plazaSeleccionada ?? undefined
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (registros) => {
        this.loading = false;
        // Cuando la consulta es mensual se agregan solamente las horas del
        // turno indicado en Lima (C incluye 22–06 del día siguiente).
        const seleccion = this.esMes && this.turno !== 'TODOS'
          ? registros.filter((r) => perteneceATurno(
              this.horaLima(r.fechaHoraEvento), this.turno
            ))
          : registros;
        this.registros = [...seleccion].sort(
          (a, b) =>
            new Date(b.fechaHoraEvento).getTime() -
            new Date(a.fechaHoraEvento).getTime()
        );
        if (this.puedeFiltrarPlazas) {
          this.incorporarPlazas(registros.map((r) => ({
            id: r.plazaId,
            codigo: r.plazaCodigo,
            descripcion: null
          })).filter((p) => p.id != null));
        }
        this.recalcular();
        this.ultimaActualizacion = new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23'
        }).format(new Date());
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.error =
          error?.error?.message ??
          'No se pudo cargar el dashboard de AVIX.';
        this.cdr.markForCheck();
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
    this.liberados = this.registros.filter(
      (item) => item.accion === 'LIBERADO'
    ).length;
    this.placasUnicas = new Set(
      this.registros.map((item) => item.placa)
    ).size;
    this.operadoresActivos = new Set(
      this.registros.map((item) => item.usuarioId)
    ).size;

    const resumen = { A: 0, B: 0, C: 0 };
    for (const item of this.registros) {
      const hora = this.horaLima(item.fechaHoraEvento);
      if (perteneceATurno(hora, 'A')) resumen.A++;
      else if (perteneceATurno(hora, 'B')) resumen.B++;
      else resumen.C++;
    }
    this.resumenTurnos = resumen;

    this.porcentajeFugas = this.total
      ? Math.round((this.fugas / this.total) * 100)
      : 0;
    this.porcentajeDerivados = this.total
      ? Math.round((this.derivados / this.total) * 100)
      : 0;
    this.porcentajeLiberados = this.total
      ? 100 - this.porcentajeFugas - this.porcentajeDerivados
      : 0;

    const franjas = franjasDashboard(this.turno);
    this.promedioPorHora = this.horasDelPeriodo
      ? Number((this.total / this.horasDelPeriodo).toFixed(1))
      : 0;

    const vias = new Map<
      number,
      { total: number; fugas: number; derivados: number; liberados: number }
    >();

    for (const item of this.registros) {
      const actual = vias.get(item.via) ?? {
        total: 0,
        fugas: 0,
        derivados: 0,
        liberados: 0
      };

      actual.total++;

      if (item.accion === 'FUGA') {
        actual.fugas++;
      } else if (item.accion === 'DERIVADO') {
        actual.derivados++;
      } else if (item.accion === 'LIBERADO') {
        actual.liberados++;
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
      liberados: data.liberados,
      width: Math.max(5, (data.total / maxVia) * 100)
    }));

    const viaTop = this.porVia[0];
    this.viaLider = viaTop ? `Vía ${viaTop.via}` : '—';
    this.viaLiderTotal = viaTop?.total ?? 0;

    const byHour = new Map<
      number,
      { total: number; fugas: number; derivados: number; liberados: number }
    >();

    for (const item of this.registros) {
      const hour = this.horaLima(item.fechaHoraEvento);
      const actual = byHour.get(hour) ?? {
        total: 0,
        fugas: 0,
        derivados: 0,
        liberados: 0
      };

      actual.total++;

      if (item.accion === 'FUGA') {
        actual.fugas++;
      } else if (item.accion === 'DERIVADO') {
        actual.derivados++;
      } else if (item.accion === 'LIBERADO') {
        actual.liberados++;
      }

      byHour.set(hour, actual);
    }

    const rawHours = franjas.map((franja) => {
      const hour = franja.value % 24;
      const data = byHour.get(hour) ?? {
        total: 0,
        fugas: 0,
        derivados: 0,
        liberados: 0
      };

      return {
        label: franja.label,
        total: data.total,
        fugas: data.fugas,
        derivados: data.derivados,
        liberados: data.liberados
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
    return Number(this.hourFormatter.format(new Date(iso)));
  }
}
