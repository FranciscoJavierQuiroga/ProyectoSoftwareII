import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-dashboard-student',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student.html',
  styleUrls: ['./student.css']
})
export default class StudentComponent implements OnInit {
  grades: any = null;
  notifications: any = null;
  schedule: any = null;
  profile: any = null;
  courses: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private api: ApiService,
    private router: Router,
    private alertService: AlertService  // ✅ Inyectar AlertService
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    
    // Cargar calificaciones
    this.api.getStudentGrades().subscribe({
      next: (res: any) => {
        console.log('✅ Calificaciones cargadas:', res);
        this.grades = res;
      },
      error: (err: any) => {
        console.error('❌ Error cargando calificaciones:', err);
        this.alertService.error('No se pudieron cargar las calificaciones');
        this.error = 'Error al cargar calificaciones';
      }
    });

    // Cargar notificaciones
    this.api.getStudentNotifications().subscribe({
      next: (res: any) => {
        console.log('✅ Notificaciones cargadas:', res);
        this.notifications = res;
      },
      error: (err: any) => {
        console.error('❌ Error cargando notificaciones:', err);
        this.alertService.error('No se pudieron cargar las notificaciones');
      }
    });

    // Cargar horario
    this.api.getStudentSchedule().subscribe({
      next: (res: any) => {
        console.log('✅ Horario cargado:', res);
        this.schedule = res;
      },
      error: (err: any) => {
        console.error('❌ Error cargando horario:', err);
        this.alertService.error('No se pudo cargar el horario');
      }
    });

    // Cargar perfil
    this.api.getStudentProfile().subscribe({
      next: (res: any) => {
        if (res.success) {
          console.log('✅ Perfil cargado:', res.profile);
          this.profile = res.profile;
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando perfil:', err);
        this.alertService.error('No se pudo cargar el perfil');
      }
    });

    // Cargar cursos
    this.api.getStudentCourses().subscribe({
      next: (res: any) => {
        if (res.success) {
          console.log('✅ Cursos cargados:', res.courses);
          this.courses = res.courses;
          this.alertService.success('Datos cargados correctamente');
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('❌ Error cargando cursos:', err);
        this.alertService.error('No se pudieron cargar los cursos');
        this.loading = false;
      }
    });
  }

  getStudentName(): string {
    if (this.profile) {
      return `${this.profile.nombres} ${this.profile.apellidos}`;
    }
    return 'Estudiante';
  }

  getAveragePercentage(): number {
    const average = this.grades?.average || 0;
    return (average / 5) * 100;
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