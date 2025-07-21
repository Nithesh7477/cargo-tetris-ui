import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Package3dBoxComponent } from './package3d-box.component';

describe('Package3dBoxComponent', () => {
  let component: Package3dBoxComponent;
  let fixture: ComponentFixture<Package3dBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Package3dBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Package3dBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
