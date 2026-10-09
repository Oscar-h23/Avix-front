import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AviPlazaConfig,
  AviRegistro,
  AviRegistroUpdate,
  AviViaConfig,
  RegistroQuery
} from '../models/avi.models';

@Injectable({ providedIn: 'root' })
export class AviApiService {
  constructor(private readonly http: HttpClient) {}

  listarRegistros(query: RegistroQuery): Observable<AviRegistro[]> {
    let params = new HttpParams();

    if (query.desde) {
      params = params.set('desde', query.desde);
    }
    if (query.hasta) {
      params = params.set('hasta', query.hasta);
    }
    if (query.plazaId != null) {
      params = params.set('plazaId', query.plazaId);
    }
    if (query.via != null) {
      params = params.set('via', query.via);
    }
    if (query.accion) {
      params = params.set('accion', query.accion);
    }

    return this.http.get<AviRegistro[]>('/api/avi/registros', { params });
  }

  actualizarRegistro(
    id: string,
    body: AviRegistroUpdate
  ): Observable<AviRegistro> {
    return this.http.put<AviRegistro>(`/api/avi/registros/${id}`, body);
  }

  listarPlazasConfiguracion(): Observable<AviPlazaConfig[]> {
    return this.http.get<AviPlazaConfig[]>('/api/avi/admin/plazas');
  }

  listarViasConfiguracion(plazaId: number): Observable<AviViaConfig[]> {
    const params = new HttpParams().set('plazaId', plazaId);
    return this.http.get<AviViaConfig[]>('/api/avi/admin/vias', { params });
  }

  actualizarVisibilidadVia(
    plazaId: number,
    viaId: number,
    visible: boolean
  ): Observable<AviViaConfig> {
    return this.http.put<AviViaConfig>(
      `/api/avi/admin/vias/${viaId}`,
      { plazaId, visible }
    );
  }
}
