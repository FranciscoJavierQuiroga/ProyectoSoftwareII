import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-matriculas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matriculas.html',
  styleUrls: ['./matriculas.css']
})
export class Matriculas {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/dashboard/admin']);
  }
}
