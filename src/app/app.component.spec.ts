import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { SkyrimLoadingComponent } from './skyrim-loading/skyrim-loading.component';

// The real scene needs WebGL, which the test DOM doesn't have
@Component({ selector: 'app-skyrim-loading', template: '' })
class SkyrimLoadingStubComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AppComponent, {
      remove: { imports: [SkyrimLoadingComponent] },
      add: { imports: [SkyrimLoadingStubComponent] },
    });
    await TestBed.configureTestingModule({
    imports: [
        AppComponent
    ],
}).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'Noah Surprenant'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Noah Surprenant');
  });

  it('should render name and links', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.name')?.textContent).toContain('Noah Surprenant');
    expect(compiled.querySelectorAll('.list a').length).toBe(4);
  });
});
