export type AviAccion = 'FUGA' | 'DERIVADO' | 'LIBERADO';

export interface AviUsuario {
  id: number;
  codigo: number;
  nombre: string;
  rol: string;
  plazaId: number | null;
  plaza: string | null;
}

export interface AviLoginResponse {
  token: string;
  tipo: string;
  expiresIn: number;
  usuario: AviUsuario;
}

export interface AviRegistro {
  id: string;
  usuarioId: number;
  usuarioCodigo: number;
  usuarioNombre: string;
  plazaId: number;
  plazaCodigo: string;
  placa: string;
  via: number;
  accion: AviAccion;
  fechaHoraEvento: string;
  fechaHoraRecepcion: string;
  textoReconocido: string | null;
}

export interface AviRegistroUpdate {
  placa: string;
  via: number;
  accion: AviAccion;
  fechaHoraEvento: string;
  textoReconocido: string;
}

export interface RegistroQuery {
  desde?: string;
  hasta?: string;
  plazaId?: number;
  via?: number;
  accion?: AviAccion;
}


export interface AviPlazaConfig {
  id: number;
  codigo: string;
  descripcion: string | null;
}

export interface AviViaConfig {
  id: number;
  plazaId: number;
  numero: number;
  nombre: string | null;
  visible: boolean;
}
