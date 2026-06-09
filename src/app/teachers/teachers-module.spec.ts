import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TeachersModule } from './teachers-module';

describe('TeachersModule', () => {
  let component: TeachersModule;
  let fixture: ComponentFixture<TeachersModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TeachersModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeachersModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
