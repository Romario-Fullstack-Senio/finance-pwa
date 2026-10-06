import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type Status = 'good' | 'warning' | 'critical';

/** Icono de estado; siempre va junto a un texto que dice lo mismo (nunca solo color) */
@Component({
  selector: 'app-status-icon',
  template: `
    @switch (status()) {
      @case ('good') {
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-good">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clip-rule="evenodd"
          />
        </svg>
      }
      @case ('warning') {
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-warning">
          <path
            fill-rule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clip-rule="evenodd"
          />
        </svg>
      }
      @case ('critical') {
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-critical">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
            clip-rule="evenodd"
          />
        </svg>
      }
    }
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusIconComponent {
  readonly status = input.required<Status>();
}
