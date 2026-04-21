import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PendingAlertService {
  private audioContext: AudioContext | null = null;
  private hasRequestedPermission = false;
  private hasRegisteredUnlockListeners = false;

  initialize(): void {
    this.registerAudioUnlock();
  }

  notifyNewPendingSession(): void {
    this.showBrowserNotification();
    this.playAlertSound();
  }

  private showBrowserNotification(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('Nuevo usuario a responder');
      return;
    }

    this.requestNotificationPermission();
  }

  private requestNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (this.hasRequestedPermission || Notification.permission !== 'default') {
      return;
    }

    this.hasRequestedPermission = true;
    void Notification.requestPermission();
  }

  private playAlertSound(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const context = this.getAudioContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().then(() => this.playBeepSequence(context)).catch(() => undefined);
      return;
    }

    this.playBeepSequence(context);
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    const globalAudio = globalThis as typeof globalThis & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = globalAudio.AudioContext ?? globalAudio.webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private registerAudioUnlock(): void {
    if (typeof window === 'undefined' || this.hasRegisteredUnlockListeners) {
      return;
    }

    this.hasRegisteredUnlockListeners = true;

    const unlockAudio = () => {
      this.requestNotificationPermission();

      const context = this.getAudioContext();

      if (!context || context.state !== 'suspended') {
        return;
      }

      void context.resume().catch(() => undefined);
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
  }

  private playBeepSequence(context: AudioContext): void {
    const startAt = context.currentTime;

    this.scheduleBeep(context, startAt, 880, 0.12);
    this.scheduleBeep(context, startAt + 0.18, 1175, 0.16);
  }

  private scheduleBeep(
    context: AudioContext,
    startAt: number,
    frequency: number,
    duration: number,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }
}
