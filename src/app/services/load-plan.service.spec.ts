import { TestBed } from '@angular/core/testing';

import { LoadPlanService } from './load-plan.service';

describe('LoadPlanService', () => {
  let service: LoadPlanService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadPlanService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
