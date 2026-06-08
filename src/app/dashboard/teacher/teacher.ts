import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-dashboard-teacher',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './teacher.html',
  styleUrls: ['./teacher.css']
})
export default class TeacherComponent implements OnInit {  // ✅ Cambiar a 'export default'
  groups: any[] = [];
  pending: any = null;
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService, private router: Router, private alertService: AlertService) {}

  ngOnInit() {
    this.loadGroups();
  }

  loadGroups() {
    this.api.getTeacherGroups().subscribe({
      next: (res: any) => this.groups = res?.groups || [],
      error: (err) => console.error('Error loading groups:', err)
    });
  }

  async logout(): Promise<void> {
      const confirmed = await this.alertService.confirm({
        title: '¿Cerrar Sesión?',
        message: '¿Está seguro que desea cerrar su sesión actual?',
        confirmText: 'Sí, cerrar sesión',
        cancelText: 'Cancelar',
        type: 'danger'
      });
  
      if (confirmed) {
        // Limpiar localStorage
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('userInfo');
        
        this.alertService.success('Sesión cerrada exitosamente', '👋 Hasta pronto');
        
        // Redirigir al login
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1000);
      }
    }
}