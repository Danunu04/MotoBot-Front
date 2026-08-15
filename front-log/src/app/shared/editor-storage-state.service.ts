import { Injectable, signal } from '@angular/core';

export const EDITOR_STORAGE_UNAVAILABLE_MESSAGE =
  'No se puede guardar: la base de datos no está configurada o no está disponible.';

export interface EditorStorageStatus {
  readonly writable: boolean;
  readonly message: string | null;
}

@Injectable({ providedIn: 'root' })
export class EditorStorageState {
  readonly status = signal<EditorStorageStatus>({ writable: false, message: null });

  setStatus(status: EditorStorageStatus): void {
    this.status.set(status);
  }

  markUnavailable(): void {
    this.status.set({
      writable: false,
      message: EDITOR_STORAGE_UNAVAILABLE_MESSAGE,
    });
  }
}
