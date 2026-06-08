import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-enrollment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enrollment-form.html',
  styleUrls: ['./enrollment-form.css']
})
export class EnrollmentFormComponent implements OnInit {
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Listas para selección
  students: any[] = [];
  courses: any[] = [];
  filteredStudents: any[] = [];
  filteredCourses: any[] = [];

  // Datos del formulario
  formData = {
    student_id: '',
    course_id: '',
    periodo: '1',
    estado: 'pendiente',
    observaciones: ''
  };

  periodos = ['1', '2', '3', '4'];
  estados = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'activo', label: 'Activo' },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'cancelado', label: 'Cancelado' }
  ];

  // Búsqueda
  searchStudent = '';
  searchCourse = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadStudents();
    this.loadCourses();
  }

  loadStudents(): void {
    this.loading = true;
    this.api.getAdminStudents({ estado: 'activo' }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.students = response.students;
          this.filteredStudents = this.students;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error cargando estudiantes:', err);
        this.error = 'Error al cargar la lista de estudiantes';
        this.loading = false;
      }
    });
  }

  loadCourses(): void {
    this.api.getAdminCourses({ estado: 'activo' }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.courses = response.courses;
          this.filteredCourses = this.courses;
        }
      },
      error: (err) => {
        console.error('❌ Error cargando cursos:', err);
        this.error = 'Error al cargar la lista de cursos';
      }
    });
  }

  filterStudents(): void {
    if (!this.searchStudent) {
      this.filteredStudents = this.students;
      return;
    }

    const search = this.searchStudent.toLowerCase();
    this.filteredStudents = this.students.filter(student =>
      student.nombres.toLowerCase().includes(search) ||
      student.apellidos.toLowerCase().includes(search) ||
      student.codigo_est.toLowerCase().includes(search) ||
      student.documento.includes(search)
    );
  }

  filterCourses(): void {
    if (!this.searchCourse) {
      this.filteredCourses = this.courses;
      return;
    }

    const search = this.searchCourse.toLowerCase();
    this.filteredCourses = this.courses.filter(course =>
      course.nombre_curso.toLowerCase().includes(search) ||
      course.codigo_curso.toLowerCase().includes(search) ||
      course.grado.includes(search)
    );
  }

  getStudentName(studentId: string): string {
    const student = this.students.find(s => s._id === studentId);
    if (student) {
      return `${student.nombres} ${student.apellidos} (${student.codigo_est})`;
    }
    return 'Seleccione un estudiante';
  }

  getCourseName(courseId: string): string {
    const course = this.courses.find(c => c._id === courseId);
    if (course) {
      return `${course.nombre_curso} (${course.codigo_curso}) - Grado ${course.grado}`;
    }
    return 'Seleccione un curso';
  }

  validateForm(): boolean {
    if (!this.formData.student_id) {
      this.error = 'Por favor seleccione un estudiante';
      return false;
    }

    if (!this.formData.course_id) {
      this.error = 'Por favor seleccione un curso';
      return false;
    }

    if (!this.formData.periodo) {
      this.error = 'Por favor seleccione un periodo';
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

    this.api.createEnrollment(this.formData).subscribe({
      next: (response: any) => {
        console.log('✅ Matrícula creada:', response);
        this.success = 'Matrícula creada exitosamente';
        this.loading = false;
        
        setTimeout(() => {
          this.router.navigate(['/dashboard/admin'], { 
            queryParams: { view: 'enrollments' } 
          });
        }, 1500);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || 'Error al crear la matrícula';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin'], { 
      queryParams: { view: 'enrollments' } 
    });
  }

  resetForm(): void {
    this.formData = {
      student_id: '',
      course_id: '',
      periodo: '1',
      estado: 'pendiente',
      observaciones: ''
    };
    this.searchStudent = '';
    this.searchCourse = '';
    this.filteredStudents = this.students;
    this.filteredCourses = this.courses;
    this.error = null;
    this.success = null;
  }
}