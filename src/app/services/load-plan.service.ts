import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoadPlanService {
  private apiUrl = 'https://localhost:7041/LoadPlan/execute';

  constructor(private http: HttpClient) {}

  executeLoadPlan(uld: any, packages: any[]): Observable<any> {
    return this.http.post(this.apiUrl, { uld, packages });
  }
}
