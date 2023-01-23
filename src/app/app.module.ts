import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgxThreeModule } from 'ngx-three';
import { SkyrimLoadingComponent } from './skyrim-loading/skyrim-loading.component';
import { FogComponent } from './fog/fog.component';

@NgModule({
  declarations: [
    AppComponent,
    SkyrimLoadingComponent,
    FogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    NgxThreeModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
