import { IsEnum } from 'class-validator';
import { CheckoutReason } from '../checkout-reason.enum';

// bindingId is deliberately absent — always resolved server-side as "my own
// active binding" (RULE-DEV-01 nota C4's anti-spoofing posture extended
// here: never trust a client-supplied id representing someone else's
// binding).
export class CheckoutDto {
  @IsEnum(CheckoutReason)
  reason: CheckoutReason;
}
