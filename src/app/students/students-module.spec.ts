import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { StudentsModule } from './students-module';

describe('StudentsModule', () => {
  let component: StudentsModule;
  let fixture: ComponentFixture<StudentsModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        StudentsModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentsModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
