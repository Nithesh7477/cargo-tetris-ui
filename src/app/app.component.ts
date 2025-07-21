import { Component } from '@angular/core';
import { Uld360Component } from './components/uld-360/uld-360.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Uld360Component],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
