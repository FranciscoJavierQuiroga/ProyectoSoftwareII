import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-student-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-form.html',
  styleUrls: ['./student-form.css']
})
export class StudentFormComponent implements OnInit {
  isEdit = false;
  studentId: string | null = null;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Datos del formulario
  formData = {
    correo: '',
    nombres: '',
    apellidos: '',
    documento: '',
    tipo_doc: 'TI',
    codigo_est: '',
    fecha_nacimiento: '',
    direccion: '',
    telefono: '',
    nombre_acudiente: '',
    telefono_acudiente: '',
    correo_acudiente: '',
    activo: true
  };

  tiposDocumento = [
    { value: 'TI', label: 'Tarjeta de Identidad' },
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'PP', label: 'Pasaporte' }
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Verificar si es edición
    this.studentId = this.route.snapshot.paramMap.get('id');
    
    if (this.studentId) {
      this.isEdit = true;
      this.loadStudentData();
    }
  }

  loadStudentData(): void {
    if (!this.studentId) return;

    this.loading = true;
    this.api.getStudentDetail(this.studentId).subscribe({
      next: (response: any) => {
        if (response.success) {
          const student = response.student;
          
          // Llenar el formulario con los datos existentes
          this.formData = {
            correo: student.correo || '',
            nombres: student.nombres || '',
            apellidos: student.apellidos || '',
            documento: student.documento || '',
            tipo_doc: student.tipo_doc || 'TI',
            codigo_est: student.codigo_est || '',
            fecha_nacimiento: student.fecha_nacimiento ? 
              new Date(student.fecha_nacimiento).toISOString().split('T')[0] : '',
            direccion: student.direccion || '',
            telefono: student.telefono || '',
            nombre_acudiente: student.nombre_acudiente || '',
            telefono_acudiente: student.telefono_acudiente || '',
            correo_acudiente: student.correo_acudiente || '',
            activo: student.activo !== false
          };
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error cargando estudiante:', err);
        this.error = 'Error al cargar los datos del estudiante';
        this.loading = false;
      }
    });
  }

  validateForm(): boolean {
    // Validar campos requeridos
    if (!this.formData.correo || !this.formData.nombres || 
        !this.formData.apellidos || !this.formData.documento || 
        !this.formData.codigo_est) {
      this.error = 'Por favor complete todos los campos obligatorios';
      return false;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.formData.correo)) {
      this.error = 'Por favor ingrese un correo electrónico válido';
      return false;
    }

    if (this.formData.correo_acudiente && 
        !emailRegex.test(this.formData.correo_acudiente)) {
      this.error = 'Por favor ingrese un correo de acudiente válido';
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

    if (this.isEdit && this.studentId) {
      // Actualizar estudiante existente
      this.api.updateStudent(this.studentId, this.formData).subscribe({
        next: (response: any) => {
          console.log('✅ Estudiante actualizado:', response);
          this.success = 'Estudiante actualizado exitosamente';
          this.loading = false;
          
          setTimeout(() => {
            this.router.navigate(['/dashboard/admin']);
          }, 1500);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error = err.error?.error || 'Error al actualizar el estudiante';
          this.loading = false;
        }
      });
    } else {
      // Crear nuevo estudiante
      this.api.createStudent(this.formData).subscribe({
        next: (response: any) => {
          console.log('✅ Estudiante creado:', response);
          this.success = 'Estudiante creado exitosamente';
          this.loading = false;
          
          setTimeout(() => {
            this.router.navigate(['/dashboard/admin']);
          }, 1500);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error = err.error?.error || 'Error al crear el estudiante';
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
      correo: '',
      nombres: '',
      apellidos: '',
      documento: '',
      tipo_doc: 'TI',
      codigo_est: '',
      fecha_nacimiento: '',
      direccion: '',
      telefono: '',
      nombre_acudiente: '',
      telefono_acudiente: '',
      correo_acudiente: '',
      activo: true
    };
    this.error = null;
    this.success = null;
  }
}