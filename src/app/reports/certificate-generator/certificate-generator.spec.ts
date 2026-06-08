import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateGenerator } from './certificate-generator';

describe('CertificateGenerator', () => {
  let component: CertificateGenerator;
  let fixture: ComponentFixture<CertificateGenerator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateGenerator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CertificateGenerator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
