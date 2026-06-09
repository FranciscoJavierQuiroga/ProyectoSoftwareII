import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-overlay" *ngIf="isVisible" (click)="cancel()">
      <div class="confirm-dialog" (click)="$event.stopPropagation()">
        <div class="confirm-header" [class]="'header-' + config.type">
          <span class="material-icons confirm-icon">
            {{ getIcon() }}
          </span>
          <h3>{{ config.title }}</h3>
        </div>
        
        <div class="confirm-body">
          <p>{{ config.message }}</p>
        </div>
        
        <div class="confirm-actions">
          <button class="btn btn-cancel" (click)="cancel()">
            {{ config.cancelText }}
          </button>
          <button 
            class="btn btn-confirm" 
            [class]="'btn-' + config.type"
            (click)="confirm()"
          >
            {{ config.confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .confirm-dialog {
      background: white;
      border-radius: 16px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: scaleIn 0.3s ease-out;
      overflow: hidden;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .confirm-header {
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #e6f0ea;
    }

    .header-primary {
      background: linear-gradient(135deg, #0b6b3a 0%, #2b8b5a 100%);
      color: white;
    }

    .header-danger {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
    }

    .header-warning {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
      color: #333;
    }

    .confirm-icon {
      font-size: 48px;
    }

    .confirm-header h3 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }

    .confirm-body {
      padding: 24px;
    }

    .confirm-body p {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
    }

    .confirm-actions {
      padding: 16px 24px 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-cancel {
      background: #e0e0e0;
      color: #333;
    }

    .btn-cancel:hover {
      background: #d0d0d0;
      transform: translateY(-2px);
    }

    .btn-confirm {
      color: white;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0b6b3a 0%, #2b8b5a 100%);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #095530 0%, #257a4a 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(11, 107, 58, 0.3);
    }

    .btn-danger {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    }

    .btn-danger:hover {
      background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
    }

    .btn-warning {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
      color: #333;
    }

    .btn-warning:hover {
      background: linear-gradient(135deg, #e0a800 0%, #d39e00 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
    }

    @media (max-width: 768px) {
      .confirm-dialog {
        min-width: auto;
        margin: 20px;
        width: calc(100% - 40px);
      }

      .confirm-actions {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class ConfirmComponent implements OnInit, OnDestroy {
  isVisible = false;
  config: any = {
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    type: 'primary'
  };
  private resolver: ((value: boolean) => void) | null = null;
  private subscription!: Subscription;

  constructor(private alertService: AlertService) {}

  ngOnInit() {
    this.subscription = this.alertService.confirm$.subscribe(data => {
      this.config = data;
      this.resolver = data.resolver;
      this.isVisible = true;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  confirm() {
    if (this.resolver) {
      this.resolver(true);
    }
    this.isVisible = false;
  }

  cancel() {
    if (this.resolver) {
      this.resolver(false);
    }
    this.isVisible = false;
  }

  getIcon(): string {
    const icons: { [key: string]: string } = {
      primary: 'help',
      danger: 'warning',
      warning: 'info'
    };
    return icons[this.config.type] || 'help';
  }
}