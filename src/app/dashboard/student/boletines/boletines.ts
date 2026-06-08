import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-boletines',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './boletines.html',
  styleUrls: ['./boletines.css']
})
export default class BoletinesComponent implements OnInit {
  periodos = ['1', '2', '3', '4'];
  periodoSeleccionado = '1';
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  courses: any[] = [];
  profile: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    // Cargar perfil del estudiante
    this.api.getStudentProfile().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.profile = res.profile;
        }
      },
      error: (err: any) => {
        console.error('Error cargando perfil:', err);
      }
    });

    // Cargar cursos
    this.api.getStudentCourses().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.courses = res.courses;
        }
      },
      error: (err: any) => {
        console.error('Error cargando cursos:', err);
      }
    });
  }

  downloadBoletin() {
    this.loading = true;
    this.error = null;
    this.successMessage = null;

    console.log(`📥 Descargando boletín del periodo ${this.periodoSeleccionado}...`);

    this.api.downloadBoletin(this.periodoSeleccionado).subscribe({
      next: (response: HttpResponse<Blob>) => {
        this.loading = false;
        const blob = response.body;
        
        if (blob) {
          // Crear URL temporal del blob
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `boletin_periodo_${this.periodoSeleccionado}_${new Date().getTime()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.successMessage = '✅ Boletín descargado exitosamente';
          setTimeout(() => this.successMessage = null, 3000);
        }
      },
      error: (err: any) => {
        this.loading = false;
        console.error('❌ Error al descargar boletín:', err);
        this.error = err.error?.error || 'Error al generar el boletín. Intenta nuevamente.';
      }
    });
  }
getCursosDelPeriodo() {
  return this.courses.map(curso => {
    // Obtener promedio específico del periodo seleccionado
    const promedioPeriodo = curso.promedios_por_periodo 
      ? curso.promedios_por_periodo[this.periodoSeleccionado] || 0
      : curso.promedio_general || 0;
    
    return {
      ...curso,
      promedio: promedioPeriodo  // ✅ Usar promedio del periodo
    };
  }).filter(curso => curso.promedio > 0); // Solo mostrar cursos con calificaciones
}

getPromedioGeneral(): number {
  const cursosDelPeriodo = this.getCursosDelPeriodo();
  if (cursosDelPeriodo.length === 0) return 0;
  
  const suma = cursosDelPeriodo.reduce((acc, c) => acc + (c.promedio || 0), 0);
  return Number((suma / cursosDelPeriodo.length).toFixed(2));
}
}