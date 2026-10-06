import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';
import { prefersReducedMotion, setupCharts } from './chart-setup';

export type AppChartConfig = ChartConfiguration<'bar'> | ChartConfiguration<'line'>;

/**
 * Lienzo de Chart.js controlado por una configuración reactiva: lo crea al renderizar,
 * lo actualiza cuando cambia `config` y lo destruye con el componente.
 * El canvas es una imagen con `label` como descripción; cada gráfico ofrece además su tabla.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div class="relative w-full" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="label()"></canvas>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartComponent {
  readonly config = input.required<AppChartConfig>();
  readonly label = input.required<string>();
  readonly height = input(260);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  constructor() {
    setupCharts();

    afterRenderEffect(() => {
      const config = this.config();
      const canvas = this.canvas().nativeElement;
      untracked(() => this.render(canvas, config));
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render(canvas: HTMLCanvasElement, config: AppChartConfig): void {
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion() ? (false as const) : { duration: 350 },
      ...config.options,
    };

    if (!this.chart) {
      this.chart = new Chart(canvas, { ...config, options } as ChartConfiguration);
      return;
    }
    this.chart.data = config.data as ChartConfiguration['data'];
    this.chart.options = options as ChartConfiguration['options'] & object;
    this.chart.update();
  }
}
