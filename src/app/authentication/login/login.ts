import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export default class LoginComponent {  // ✅ Cambiar a 'export default'
  username = '';
  password = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  async login(event?: Event) {
    if (event) event.preventDefault();
    
    this.error = null;
    
    if (!this.username || !this.password) {
      this.error = 'Usuario y contraseña son requeridos';
      return;
    }

    this.loading = true;

    this.api.login({ username: this.username, password: this.password }).subscribe({
      next: (data: any) => {
        this.loading = false;
        
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
          
          const role = data.role;
          localStorage.setItem('user_role', role);
          
          this.success = 'Inicio de sesión exitoso';
          console.log('Login exitoso, token guardado');
          console.log('Rol detectado:', role);
          
          if (role === 'estudiante') {
            this.router.navigate(['/dashboard/student']);
          } else if (role === 'docente') {
            this.router.navigate(['/dashboard/teacher']);
          } else if (role === 'administrador') {
            this.router.navigate(['/dashboard/admin']);
          } else if (role) {
            this.error = 'Rol no reconocido: ' + role;
          } else {
            this.error = 'Inicio de sesión correcto pero el usuario no tiene rol asignado.';
          }
        } else {
          this.error = 'No se recibió token de acceso';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Error al iniciar sesión';
        console.error('Error en login:', err);
      }
    });
  }
}