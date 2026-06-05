import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

interface Report {
  id: string;
  title: string;
  description: string;
  icon: string;
  endpoint: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  reportData: any = null;
  selectedReport: string | null = null;

  reports: Report[] = [
    {
      id: 'students-by-grade',
      title: 'Estudiantes por Grado',
      description: 'Distribución de estudiantes matriculados por grado académico',
      icon: 'school',
      endpoint: 'students-by-grade'
    },
    {
      id: 'performance-by-course',
      title: 'Desempeño por Curso',
      description: 'Promedio de calificaciones por cada curso activo',
      icon: 'trending_up',
      endpoint: 'performance-by-course'
    },
    {
      id: 'teacher-workload',
      title: 'Carga Académica Docentes',
      description: 'Cantidad de cursos y estudiantes asignados por docente',
      icon: 'work',
      endpoint: 'teacher-workload'
    },
    {
      id: 'enrollment-history',
      title: 'Historial de Matrículas',
      description: 'Evolución de matrículas por periodo académico',
      icon: 'history',
      endpoint: 'enrollment-history'
    },
    {
      id: 'academic-statistics',
      title: 'Estadísticas Completas',
      description: 'Reporte global con todas las estadísticas del sistema',
      icon: 'analytics',
      endpoint: 'academic-statistics'
    }
  ];

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  generateReport(report: Report): void {
    this.loading = true;
    this.error = null;
    this.selectedReport = report.id;
    this.reportData = null;

    let reportObservable;

    switch(report.endpoint) {
      case 'students-by-grade':
        reportObservable = this.api.getReportStudentsByGrade();
        break;
      case 'performance-by-course':
        reportObservable = this.api.getReportPerformanceByCourse();
        break;
      case 'teacher-workload':
        reportObservable = this.api.getReportTeacherWorkload();
        break;
      case 'enrollment-history':
        reportObservable = this.api.getReportEnrollmentHistory();
        break;
      case 'academic-statistics':
        reportObservable = this.api.getReportAcademicStatistics();
        break;
      default:
        this.loading = false;
        this.error = 'Reporte no disponible';
        return;
    }

    reportObservable.subscribe({
      next: (response: any) => {
        console.log('✅ Reporte generado:', response);
        this.reportData = response;
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = 'Error al generar el reporte';
        this.loading = false;
      }
    });
  }

  downloadPDF(report: Report): void {
    // Implementar descarga de PDF (futuro)
    alert(`Descarga de PDF para "${report.title}" en desarrollo.\n\nEn producción se generará un PDF descargable.`);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin']);
  }

  getReportTitle(): string {
    if (!this.selectedReport) return '';
    const report = this.reports.find(r => r.id === this.selectedReport);
    return report ? report.title : '';
  }

  formatReportData(): string {
    if (!this.reportData) return 'No hay datos disponibles';
    return JSON.stringify(this.reportData, null, 2);
  }
}