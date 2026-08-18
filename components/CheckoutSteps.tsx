export const CHECKOUT_STEPS = ["Address", "Payment", "Confirmation"] as const;

export type CheckoutStepNumber = 1 | 2 | 3;

export interface CheckoutStepsProps {
  current: CheckoutStepNumber;
}

/**
 * Where the shopper is in a three-step checkout, and how much is left. Presentational only —
 * it is not a control, so no step is clickable and it cannot navigate anywhere.
 */
export function CheckoutSteps({ current }: CheckoutStepsProps): JSX.Element {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {CHECKOUT_STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === current;
          const isComplete = stepNumber < current;

          return (
            <li key={label} className="flex items-center gap-3">
              {index > 0 ? (
                <span aria-hidden className="h-px w-6 bg-line sm:w-10" />
              ) : null}

              <span
                aria-current={isCurrent ? "step" : undefined}
                className="flex items-center gap-2"
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.625rem] font-medium leading-none ${
                    isCurrent || isComplete
                      ? "bg-charcoal text-ivory"
                      : "bg-line text-muted"
                  }`}
                >
                  {stepNumber}
                </span>
                <span
                  className={`text-eyebrow uppercase ${
                    isCurrent ? "text-ink" : "text-muted"
                  }`}
                >
                  {label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
