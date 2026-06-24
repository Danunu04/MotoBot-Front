import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BotMessage {
  readonly key: string;
  readonly state_name: string;
  readonly label: string;
  readonly content: string;
  readonly default_content: string;
  readonly type: string;
  readonly id?: string;                    // list_row: ID de la fila en WhatsApp
  readonly description?: string;           // list_row: descripción de la fila
  readonly default_description?: string;   // list_row: descripción por defecto
}

/**
 * API contract — Bot Messages
 *
 * GET /messages
 *   Response: BotMessage[]
 *   Tipos: 'text' | 'button' | 'list_row' | 'list_button'
 *   El frontend agrupa por type y luego por state_name.
 *
 * PUT /messages/{key}
 *   Body: { content: string, updated_by: string }
 *   Response: 200 OK (body ignorado)
 *   Usado para: type 'text', 'button', 'list_button'
 *
 * PUT /messages/{key}  (list_row)
 *   Body: { content: string, description: string, updated_by: string }
 *   Response: 200 OK (body ignorado)
 *   Usado para: type 'list_row' (guarda título y descripción juntos)
 *
 *   Errores: 4xx/5xx → el frontend muestra mensaje de error en el item correspondiente.
 */
@Injectable({
  providedIn: 'root',
})
export class BotMessagesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.messagesApiUrl;

  getMessages(): Observable<readonly BotMessage[]> {
    // TODO: MOCK TEMPORAL — eliminar cuando el backend esté listo
    return of(MOCK_MESSAGES);
  }

  updateMessage(key: string, content: string, updatedBy: string): Observable<unknown> {
    // TODO: MOCK TEMPORAL — eliminar cuando el backend esté listo
    return of({ ok: true });
  }

  updateListRow(key: string, title: string, description: string, updatedBy: string): Observable<unknown> {
    // TODO: MOCK TEMPORAL — eliminar cuando el backend esté listo
    return of({ ok: true });
  }
}

// TODO: MOCK TEMPORAL — eliminar cuando el backend esté listo
const MOCK_MESSAGES: readonly BotMessage[] = [
  // Mensajes de texto
  {
    key: 'bienvenida_texto',
    state_name: 'bienvenida',
    label: 'Mensaje de bienvenida',
    content: '¡Hola! Soy el asistente de Motorola Empresas. ¿En qué te puedo ayudar?',
    default_content: '¡Hola! Soy el asistente de Motorola Empresas. ¿En qué te puedo ayudar?',
    type: 'text',
  },
  {
    key: 'soporte_texto',
    state_name: 'soporte',
    label: 'Mensaje de soporte',
    content: 'Voy a conectarte con un agente humano. Un momento por favor.',
    default_content: 'Voy a conectarte con un agente humano. Un momento por favor.',
    type: 'text',
  },
  // Botones de respuesta rápida
  {
    key: 'bienvenida_btn_consulta',
    state_name: 'bienvenida',
    label: 'Botón: Consulta técnica',
    content: 'Consulta técnica',
    default_content: 'Consulta técnica',
    type: 'button',
  },
  {
    key: 'bienvenida_btn_factura',
    state_name: 'bienvenida',
    label: 'Botón: Facturación',
    content: 'Facturación',
    default_content: 'Facturación',
    type: 'button',
  },
  {
    key: 'soporte_btn_agente',
    state_name: 'soporte',
    label: 'Botón: Hablar con agente',
    content: 'Hablar con un agente',
    default_content: 'Hablar con un agente',
    type: 'button',
  },
  // Botón del List Message
  {
    key: 'menu_list_button',
    state_name: 'EstadoInicial',
    label: 'Texto del botón de lista',
    content: 'Ver opciones',
    default_content: 'Ver opciones',
    type: 'list_button',
  },
  // Filas del List Message
  {
    key: 'menu_row_soporte',
    state_name: 'EstadoInicial',
    id: 'soporte_tecnico',
    label: 'Fila: Soporte técnico',
    content: 'Soporte técnico',
    default_content: 'Soporte técnico',
    description: 'Problemas con dispositivos o garantía',
    default_description: 'Problemas con dispositivos o garantía',
    type: 'list_row',
  },
  {
    key: 'menu_row_factura',
    state_name: 'EstadoInicial',
    id: 'facturacion',
    label: 'Fila: Facturación',
    content: 'Facturación',
    default_content: 'Facturación',
    description: 'Consultas sobre facturas y pagos',
    default_description: 'Consultas sobre facturas y pagos',
    type: 'list_row',
  },
  {
    key: 'menu_row_pedidos',
    state_name: 'EstadoInicial',
    id: 'seguimiento_pedidos',
    label: 'Fila: Seguimiento de pedidos',
    content: 'Seguimiento de pedidos',
    default_content: 'Seguimiento de pedidos',
    description: 'Estado de tu pedido en curso',
    default_description: 'Estado de tu pedido en curso',
    type: 'list_row',
  },
];
