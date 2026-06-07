import React from 'react';

// StripeProvider mock for Web
export function StripeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// useStripe mock for Web returning errors to trigger the development mock checkouts
export function useStripe() {
  return {
    initPaymentSheet: async () => {
      return {
        error: {
          code: 'Failed',
          message: 'Stripe is not supported on web. Falling back to development mock checkout.',
        },
      };
    },
    presentPaymentSheet: async () => {
      return {
        error: {
          code: 'Failed',
          message: 'Stripe is not supported on web. Falling back to development mock checkout.',
        },
      };
    },
  };
}
