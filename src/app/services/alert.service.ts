import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface AlertConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private alertSubject = new Subject<AlertConfig>();
  private confirmSubject = new Subject<ConfirmConfig & { resolver: (value: boolean) => void }>();

  alert$ = this.alertSubject.asObservable();
  confirm$ = this.confirmSubject.asObservable();

  success(message: string, title: string = '✅ Éxito', duration: number = 3000) {
    this.alertSubject.next({
      type: 'success',
      title,
      message,
      duration
    });
  }

  error(message: string, title: string = '❌ Error', duration: number = 4000) {
    this.alertSubject.next({
      type: 'error',
      title,
      message,
      duration
    });
  }

  warning(message: string, title: string = '⚠️ Advertencia', duration: number = 3500) {
    this.alertSubject.next({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  info(message: string, title: string = 'ℹ️ Información', duration: number = 3000) {
    this.alertSubject.next({
      type: 'info',
      title,
      message,
      duration
    });
  }

  confirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmSubject.next({
        ...config,
        confirmText: config.confirmText || 'Aceptar',
        cancelText: config.cancelText || 'Cancelar',
        type: config.type || 'primary',
        resolver: resolve
      });
    });
  }
}