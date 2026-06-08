import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-course-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-form.html',
  styleUrls: ['./course-form.css']
})
export class CourseFormComponent implements OnInit {
  isEdit = false;
  courseId: string | null = null;
  loading = false;
  loadingTeachers = false;
  error: string | null = null;
  success: string | null = null;

  // Datos del formulario
  formData = {
    nombre_curso: '',
    codigo_curso: '',
    grado: '',
    periodo: '',
    descripcion: '',
    creditos: 1,
    intensidad_horaria: 2,
    teacher_id: '',
    activo: true
  };

  // Lista de docentes disponibles
  teachers: any[] = [];

  // Opciones de grados
  grados = [
    '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°', '11°'
  ];

  // Periodos académicos
  periodos = ['2024-1', '2024-2', '2025-1', '2025-2', '2026-1', '2026-2'];

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadTeachers();

    // Verificar si es edición
    this.courseId = this.route.snapshot.paramMap.get('id');
    
    if (this.courseId) {
      this.isEdit = true;
      this.loadCourseData();
    }
  }

  loadTeachers(): void {
    this.loadingTeachers = true;
    this.api.getAdminTeachers({ estado: 'activo' }).subscribe({
      next: (response: any) => {
        console.log('✅ Docentes cargados:', response);
        this.teachers = response.teachers || [];
        this.loadingTeachers = false;
      },
      error: (err) => {
        console.error('❌ Error cargando docentes:', err);
        this.loadingTeachers = false;
      }
    });
  }

  loadCourseData(): void {
    if (!this.courseId) return;

    this.loading = true;
    this.api.getCourseDetail(this.courseId).subscribe({
      next: (response: any) => {
        if (response.success) {
          const course = response.course;
          
          this.formData = {
            nombre_curso: course.nombre_curso || '',
            codigo_curso: course.codigo_curso || '',
            grado: course.grado || '',
            periodo: course.periodo || '',
            descripcion: course.descripcion || '',
            creditos: course.creditos || 1,
            intensidad_horaria: course.intensidad_horaria || 2,
            teacher_id: course.id_docente || '',
            activo: course.activo !== false
          };
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error cargando curso:', err);
        this.error = 'Error al cargar los datos del curso';
        this.loading = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.formData.nombre_curso || !this.formData.codigo_curso || 
        !this.formData.grado || !this.formData.periodo) {
      this.error = 'Por favor complete todos los campos obligatorios';
      return false;
    }

    if (this.formData.creditos < 1 || this.formData.creditos > 10) {
      this.error = 'Los créditos deben estar entre 1 y 10';
      return false;
    }

    if (this.formData.intensidad_horaria < 1 || this.formData.intensidad_horaria > 10) {
      this.error = 'La intensidad horaria debe estar entre 1 y 10 horas';
      return false;
    }

    return true;
  }

  onSubmit(): void {
    this.error = null;
    this.success = null;

    if (!this.validateForm()) {
      return;
    }

    this.loading = true;

    if (this.isEdit && this.courseId) {
      // Actualizar curso existente
      this.api.updateCourse(this.courseId, this.formData).subscribe({
        next: (response: any) => {
          console.log('✅ Curso actualizado:', response);
          this.success = 'Curso actualizado exitosamente';
          this.loading = false;
          
          setTimeout(() => {
            this.router.navigate(['/dashboard/admin']);
          }, 1500);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error = err.error?.error || 'Error al actualizar el curso';
          this.loading = false;
        }
      });
    } else {
      // Crear nuevo curso
      this.api.createCourse(this.formData).subscribe({
        next: (response: any) => {
          console.log('✅ Curso creado:', response);
          this.success = 'Curso creado exitosamente';
          this.loading = false;
          
          setTimeout(() => {
            this.router.navigate(['/dashboard/admin']);
          }, 1500);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error = err.error?.error || 'Error al crear el curso';
          this.loading = false;
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin']);
  }

  resetForm(): void {
    this.formData = {
      nombre_curso: '',
      codigo_curso: '',
      grado: '',
      periodo: '',
      descripcion: '',
      creditos: 1,
      intensidad_horaria: 2,
      teacher_id: '',
      activo: true
    };
    this.error = null;
    this.success = null;
  }
}