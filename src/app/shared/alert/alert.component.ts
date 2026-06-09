import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService, AlertConfig } from '../../services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alert-container">
      <div 
        *ngFor="let alert of alerts; let i = index" 
        class="custom-alert"
        [class]="'alert-' + alert.type"
      >
        <div class="alert-icon">
          <span class="material-icons">{{ getIcon(alert.type) }}</span>
        </div>
        <div class="alert-content">
          <h4>{{ alert.title }}</h4>
          <p>{{ alert.message }}</p>
        </div>
        <button class="alert-close" (click)="removeAlert(i)">
          <span class="material-icons">close</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .alert-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      pointer-events: none;
    }

    .custom-alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      border-left: 4px solid;
      pointer-events: auto;
      animation: slideInRight 0.4s ease-out;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .custom-alert.removing {
      animation: slideOutRight 0.3s ease-in forwards;
    }

    @keyframes slideOutRight {
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    .alert-success {
      background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
      border-left-color: #28a745;
      color: #155724;
    }

    .alert-success .alert-icon .material-icons {
      color: #28a745;
    }

    .alert-error {
      background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
      border-left-color: #dc3545;
      color: #721c24;
    }

    .alert-error .alert-icon .material-icons {
      color: #dc3545;
    }

    .alert-warning {
      background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
      border-left-color: #ffc107;
      color: #856404;
    }

    .alert-warning .alert-icon .material-icons {
      color: #ffc107;
    }

    .alert-info {
      background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
      border-left-color: #17a2b8;
      color: #0c5460;
    }

    .alert-info .alert-icon .material-icons {
      color: #17a2b8;
    }

    .alert-icon {
      flex-shrink: 0;
    }

    .alert-icon .material-icons {
      font-size: 28px;
    }

    .alert-content {
      flex: 1;
      min-width: 0;
    }

    .alert-content h4 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 700;
    }

    .alert-content p {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .alert-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: inherit;
      opacity: 0.6;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .alert-close:hover {
      opacity: 1;
    }

    .alert-close .material-icons {
      font-size: 20px;
    }

    @media (max-width: 768px) {
      .alert-container {
        left: 20px;
        right: 20px;
        max-width: none;
      }

      .custom-alert {
        animation: slideInBottom 0.4s ease-out;
      }

      @keyframes slideInBottom {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    }
  `]
})
export class AlertComponent implements OnInit, OnDestroy {
  alerts: AlertConfig[] = [];
  private subscription!: Subscription;

  constructor(private alertService: AlertService) {}

  ngOnInit() {
    this.subscription = this.alertService.alert$.subscribe(alert => {
      this.alerts.push(alert);
      
      if (alert.duration && alert.duration > 0) {
        setTimeout(() => {
          this.removeAlert(0);
        }, alert.duration);
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  removeAlert(index: number) {
    if (index >= 0 && index < this.alerts.length) {
      this.alerts.splice(index, 1);
    }
  }

  getIcon(type: string): string {
    const icons: { [key: string]: string } = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[type] || 'info';
  }
}