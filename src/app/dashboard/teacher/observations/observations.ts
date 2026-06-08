import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

interface Observacion {
  _id: string;
  fecha: string;
  estudiante_info: {
    nombres: string;
    apellidos: string;
    codigo_est: string;
  };
  curso_info: {
    nombre_curso: string;
    codigo_curso: string;
    grado: string;
  };
  tipo: 'positiva' | 'negativa' | 'neutral';
  categoria: string;
  descripcion: string;
  seguimiento: string;
  docente_info: {
    nombres: string;
    apellidos: string;
  };
  gravedad?: string;
  notificado_acudiente?: boolean;
}

interface Filtros {
  texto: string;
  tipo: string;
  grupo: string;
  categoria: string;
}

@Component({
  selector: 'app-observations',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './observations.html',
  styleUrls: ['./observations.css']
})
export default class ObservationsComponent implements OnInit {
  resumen = { total: 0, positivas: 0, negativas: 0, neutrales: 0 };
  filtros: Filtros = { 
    texto: '', 
    tipo: 'todas', 
    grupo: 'todos',
    categoria: 'todas'
  };

  observaciones: Observacion[] = [];
  observacionesFiltradas: Observacion[] = [];
  grupos: any[] = [];
  
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Modal de nueva observación
  showModal = false;
  editandoId: string | null = null;
  nuevaObs = {
    student_id: '',
    course_id: '',
    tipo: 'positiva',
    categoria: 'academica',
    descripcion: '',
    seguimiento: '',
    gravedad: 'leve',
    notificado_acudiente: false
  };

  estudiantes: any[] = [];

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarGrupos();
    this.cargarObservaciones();
  }

  cargarGrupos() {
    this.api.getTeacherGroups().subscribe({
      next: (res: any) => {
        if (res.success && res.groups) {
          this.grupos = res.groups;
        }
      },
      error: (err: any) => {
        console.error('Error cargando grupos:', err);
      }
    });
  }

  cargarObservaciones() {
    this.loading = true;
    this.error = null;

    const filters: any = {};
    if (this.filtros.tipo !== 'todas') {
      filters.tipo = this.filtros.tipo;
    }
    if (this.filtros.grupo !== 'todos') {
      filters.course_id = this.filtros.grupo;
    }
    if (this.filtros.categoria !== 'todas') {
      filters.categoria = this.filtros.categoria;
    }

    this.api.getObservations(filters).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.observaciones = res.observations;
          this.resumen = res.statistics;
          this.aplicarFiltroTexto();
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error cargando observaciones:', err);
        this.error = 'Error al cargar observaciones';
        this.loading = false;
      }
    });
  }

  aplicarFiltros() {
    this.cargarObservaciones();
  }

  aplicarFiltroTexto() {
    if (!this.filtros.texto) {
      this.observacionesFiltradas = this.observaciones;
    } else {
      const texto = this.filtros.texto.toLowerCase();
      this.observacionesFiltradas = this.observaciones.filter(o => 
        o.estudiante_info.nombres.toLowerCase().includes(texto) ||
        o.estudiante_info.apellidos.toLowerCase().includes(texto) ||
        o.descripcion.toLowerCase().includes(texto) ||
        o.seguimiento.toLowerCase().includes(texto)
      );
    }
  }

  onGrupoChange() {
    if (this.filtros.grupo !== 'todos') {
      // Cargar estudiantes del grupo seleccionado
      this.api.getCourseGrades(this.filtros.grupo).subscribe({
        next: (res: any) => {
          if (res.success && res.students) {
            this.estudiantes = res.students;
          }
        },
        error: (err: any) => {
          console.error('Error cargando estudiantes:', err);
        }
      });
    }
  }

  nuevaObservacion() {
    this.editandoId = null;
    this.nuevaObs = {
      student_id: '',
      course_id: '',
      tipo: 'positiva',
      categoria: 'academica',
      descripcion: '',
      seguimiento: '',
      gravedad: 'leve',
      notificado_acudiente: false
    };
    this.showModal = true;
  }

  editar(obs: Observacion) {
    this.editandoId = obs._id;
    this.nuevaObs = {
      student_id: '',
      course_id: '',
      tipo: obs.tipo,
      categoria: obs.categoria,
      descripcion: obs.descripcion,
      seguimiento: obs.seguimiento,
      gravedad: obs.gravedad || 'leve',
      notificado_acudiente: obs.notificado_acudiente || false
    };
    this.showModal = true;
  }

  guardarObservacion() {
    if (!this.nuevaObs.descripcion || !this.nuevaObs.student_id || !this.nuevaObs.course_id) {
      this.error = 'Completa todos los campos obligatorios';
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.editandoId) {
      // Actualizar observación existente
      this.api.updateObservation(this.editandoId, this.nuevaObs).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.successMessage = 'Observación actualizada exitosamente';
            this.showModal = false;
            this.cargarObservaciones();
            setTimeout(() => this.successMessage = null, 3000);
          }
          this.loading = false;
        },
        error: (err: any) => {
          console.error('Error actualizando observación:', err);
          this.error = err.error?.error || 'Error al actualizar la observación';
          this.loading = false;
        }
      });
    } else {
      // Crear nueva observación
      this.api.createObservation(this.nuevaObs).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.successMessage = 'Observación creada exitosamente';
            this.showModal = false;
            this.cargarObservaciones();
            setTimeout(() => this.successMessage = null, 3000);
          }
          this.loading = false;
        },
        error: (err: any) => {
          console.error('Error creando observación:', err);
          this.error = err.error?.error || 'Error al crear la observación';
          this.loading = false;
        }
      });
    }
  }

  eliminar(obs: Observacion) {
    if (!confirm(`¿Estás seguro de eliminar esta observación de ${obs.estudiante_info.nombres}?`)) {
      return;
    }

    this.loading = true;

    this.api.deleteObservation(obs._id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = 'Observación eliminada exitosamente';
          this.cargarObservaciones();
          setTimeout(() => this.successMessage = null, 3000);
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error eliminando observación:', err);
        this.error = err.error?.error || 'Error al eliminar la observación';
        this.loading = false;
      }
    });
  }

  cerrarModal() {
    this.showModal = false;
    this.editandoId = null;
  }

  getEstudianteNombre(obs: Observacion): string {
    return `${obs.estudiante_info.nombres} ${obs.estudiante_info.apellidos}`;
  }

  getGrupoNombre(obs: Observacion): string {
    return `${obs.curso_info.grado}° ${obs.curso_info.codigo_curso}`;
  }

  getDocenteNombre(obs: Observacion): string {
    return `${obs.docente_info.nombres} ${obs.docente_info.apellidos}`;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO');
  }
}