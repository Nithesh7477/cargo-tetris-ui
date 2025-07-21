import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trailer360Component } from './uld-360.component';

describe('Trailer360Component', () => {
  let component: Trailer360Component;
  let fixture: ComponentFixture<Trailer360Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trailer360Component],
    }).compileComponents();

    fixture = TestBed.createComponent(Trailer360Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
