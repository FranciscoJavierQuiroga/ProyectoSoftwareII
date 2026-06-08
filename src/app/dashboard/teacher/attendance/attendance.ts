import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

interface Estudiante {
  id_estudiante: string;
  codigo: string;
  nombre: string;
  estado: 'presente' | 'ausente' | 'tarde' | 'excusa';
  observaciones: string;
}

interface Grupo {
  _id: string;
  name: string;
  codigo: string;
  periodo: string;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './attendance.html',
  styleUrls: ['./attendance.css']
})
export default class AttendanceComponent implements OnInit {
  grupos: Grupo[] = [];
  periodos = ['1', '2', '3', '4'];
  grupoSeleccionado: Grupo | null = null;
  periodoSeleccionado: string | null = null;
  fechaSeleccionada: string = new Date().toISOString().slice(0, 10);
  maxFecha: string = new Date().toISOString().slice(0, 10); // ✅ AGREGAR ESTA LÍNEA

  estudiantes: Estudiante[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarGrupos();
  }

  cargarGrupos() {
    this.loading = true;
    this.api.getTeacherGroups().subscribe({
      next: (res: any) => {
        if (res.success && res.groups) {
          this.grupos = res.groups.map((g: any) => ({
            _id: g._id,
            name: g.name,
            codigo: g.codigo,
            periodo: g.periodo
          }));
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando grupos:', err);
        this.error = 'Error al cargar los grupos';
        this.loading = false;
      }
    });
  }

  onGrupoChange() {
    if (this.grupoSeleccionado) {
      this.periodoSeleccionado = this.grupoSeleccionado.periodo;
      this.cargarEstudiantes();
    }
  }

  cargarEstudiantes() {
  if (!this.grupoSeleccionado) return;

  this.loading = true;
  this.error = null;

  // Primero intentar cargar asistencia existente
  this.api.getAttendance(this.grupoSeleccionado._id, this.fechaSeleccionada).subscribe({
    next: (res: any) => {
      if (res.success && res.attendance && res.attendance.registros) {
        // Hay asistencia registrada para esta fecha
        this.estudiantes = res.attendance.registros.map((reg: any) => ({
          id_estudiante: reg.id_estudiante,
          codigo: reg.estudiante_info?.codigo_est || '',
          nombre: `${reg.estudiante_info?.nombres || ''} ${reg.estudiante_info?.apellidos || ''}`,
          estado: reg.estado,
          observaciones: reg.observaciones || ''
        }));
        this.loading = false;
      } else {
        // No hay asistencia, cargar lista de estudiantes del curso
        this.cargarEstudiantesDelCurso();
      }
    },
    error: (err: any) => {  // ✅ Agregar tipo 'any'
      console.error('Error cargando asistencia:', err);
      this.cargarEstudiantesDelCurso();
    }
  });
}

  cargarEstudiantesDelCurso() {
    if (!this.grupoSeleccionado) return;

    this.api.getCourseGrades(this.grupoSeleccionado._id).subscribe({
      next: (res: any) => {
        if (res.success && res.students) {
          this.estudiantes = res.students.map((student: any) => ({
            id_estudiante: student.student_id,
            codigo: student.student_code,
            nombre: student.student_name,
            estado: 'presente' as const,
            observaciones: ''
          }));
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando estudiantes:', err);
        this.error = 'Error al cargar estudiantes del curso';
        this.loading = false;
      }
    });
  }

  onFechaChange() {
    if (this.grupoSeleccionado) {
      this.cargarEstudiantes();
    }
  }

  marcarTodos(estado: 'presente' | 'ausente') {
    this.estudiantes.forEach(e => e.estado = estado);
  }

  guardarAsistencia() {
  if (!this.grupoSeleccionado || this.estudiantes.length === 0) {
    this.error = 'Selecciona un grupo y asegúrate de tener estudiantes listados';
    return;
  }

  this.saving = true;
  this.error = null;
  this.successMessage = null;

  const datos = {
    course_id: this.grupoSeleccionado._id,
    fecha: this.fechaSeleccionada,
    periodo: this.periodoSeleccionado || this.grupoSeleccionado.periodo,
    registros: this.estudiantes.map(e => ({
      id_estudiante: e.id_estudiante,
      estado: e.estado,
      observaciones: e.observaciones
    }))
  };

  this.api.saveAttendance(datos).subscribe({
    next: (res: any) => {
      if (res.success) {
        this.successMessage = res.message || 'Asistencia guardada exitosamente';
        setTimeout(() => this.successMessage = null, 3000);
      }
      this.saving = false;
    },
    error: (err: any) => {  // ✅ Agregar tipo 'any'
      console.error('Error guardando asistencia:', err);
      this.error = err.error?.error || 'Error al guardar la asistencia';
      this.saving = false;
    }
  });
}

  getResumen() {
    const presentes = this.estudiantes.filter(e => e.estado === 'presente').length;
    const ausentes = this.estudiantes.filter(e => e.estado === 'ausente').length;
    const tardes = this.estudiantes.filter(e => e.estado === 'tarde').length;
    const excusas = this.estudiantes.filter(e => e.estado === 'excusa').length;

    return { presentes, ausentes, tardes, excusas, total: this.estudiantes.length };
  }
}