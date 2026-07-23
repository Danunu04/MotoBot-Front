import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type InteractiveType = 'button' | 'list' | null;

export interface OptionBinding {
  readonly option_group: string;
  readonly option_id: string;
  readonly orden: number;
  readonly title_key: string;
  readonly button_title_key: string | null;
  readonly description_key: string | null;
  readonly target_state: string | null;
  readonly target_vars: string | null;
  readonly stay_in_state: boolean;
  readonly target_substep_key: string | null;
  readonly target_substep_value: string | null;
  readonly reply_key: string | null;
  readonly extra_flags: string | null;
  readonly deleted: boolean;
  readonly updated_at: string | null;
  readonly version_id: string | null;
  readonly updated_by: string | null;
  readonly source: string;
  readonly title: string;
  readonly button_title: string;
  readonly description: string | null;
}

export interface OptionGroupPayload {
  readonly ok: boolean;
  readonly option_group: string;
  readonly option_count: number;
  readonly interactive_type: InteractiveType;
  readonly options: readonly OptionBinding[];
}

export interface OptionGroupSummary {
  readonly option_group: string;
  readonly option_count: number;
  readonly interactive_type: InteractiveType;
  readonly button_text_key: string;
  readonly section_title_key: string;
}

export interface OptionGroupConfig {
  readonly option_group: string;
  readonly button_text_key: string;
  readonly section_title_key: string;
  readonly button_text: string;
  readonly section_title: string;
  readonly updated_at: string | null;
  readonly version_id: string | null;
  readonly updated_by: string | null;
  readonly source: string;
}

export interface FlowStateSummary {
  readonly state_name: string;
  readonly state_class: string | null;
}

export interface CreateOptionPayload {
  readonly option_id: string;
  readonly orden: number;
  readonly title_key: string;
  readonly button_title_key?: string | null;
  readonly description_key?: string | null;
  readonly target_state?: string | null;
  readonly target_vars?: Record<string, unknown> | null;
  readonly stay_in_state?: boolean;
  readonly target_substep_key?: string | null;
  readonly target_substep_value?: string | null;
  readonly reply_key?: string | null;
  readonly extra_flags?: Record<string, unknown> | null;
  readonly updated_by: string;
}

export interface UpdateOptionPayload {
  readonly orden?: number;
  readonly title_key?: string;
  readonly button_title_key?: string | null;
  readonly description_key?: string | null;
  readonly target_state?: string | null;
  readonly target_vars?: Record<string, unknown> | null;
  readonly stay_in_state?: boolean;
  readonly target_substep_key?: string | null;
  readonly target_substep_value?: string | null;
  readonly reply_key?: string | null;
  readonly extra_flags?: Record<string, unknown> | null;
  readonly updated_by: string;
}

export interface GroupConfigPayload {
  readonly button_text_key: string;
  readonly section_title_key: string;
  readonly updated_by: string;
}

@Injectable({ providedIn: 'root' })
export class BotOptionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.optionsApiUrl;
  private readonly flowStatesUrl = environment.flowStatesApiUrl;

  getGroups(): Observable<readonly OptionGroupSummary[]> {
    return this.http
      .get<{ ok: boolean; groups: readonly OptionGroupSummary[] }>(`${this.baseUrl}/groups`)
      .pipe(map((r) => r.groups ?? []));
  }

  getGroup(group: string): Observable<OptionGroupPayload> {
    return this.http.get<OptionGroupPayload>(`${this.baseUrl}/${encodeURIComponent(group)}`);
  }

  getGroupConfig(group: string): Observable<OptionGroupConfig> {
    return this.http
      .get<{ ok: boolean; config: OptionGroupConfig }>(`${this.baseUrl}/groups/${encodeURIComponent(group)}/config`)
      .pipe(map((r) => r.config));
  }

  updateGroupConfig(group: string, payload: GroupConfigPayload): Observable<OptionGroupConfig> {
    return this.http
      .put<{ ok: boolean; config: OptionGroupConfig }>(
        `${this.baseUrl}/groups/${encodeURIComponent(group)}/config`,
        payload,
      )
      .pipe(map((r) => r.config));
  }

  createOption(group: string, payload: CreateOptionPayload): Observable<OptionGroupPayload> {
    return this.http.post<OptionGroupPayload>(`${this.baseUrl}/${encodeURIComponent(group)}`, payload);
  }

  updateOption(group: string, id: string, payload: UpdateOptionPayload): Observable<OptionGroupPayload> {
    return this.http.put<OptionGroupPayload>(
      `${this.baseUrl}/${encodeURIComponent(group)}/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deleteOption(group: string, id: string, updatedBy: string): Observable<OptionGroupPayload> {
    return this.http.delete<OptionGroupPayload>(
      `${this.baseUrl}/${encodeURIComponent(group)}/${encodeURIComponent(id)}?updated_by=${encodeURIComponent(updatedBy)}`,
    );
  }

  getFlowStates(): Observable<readonly FlowStateSummary[]> {
    return this.http
      .get<{ ok: boolean; states: readonly FlowStateSummary[]; count: number }>(this.flowStatesUrl)
      .pipe(map((r) => r.states ?? []));
  }
}
