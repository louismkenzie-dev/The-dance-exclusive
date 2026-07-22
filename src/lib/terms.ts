// The Dance Exclusive Terms & Conditions — supplied by the client (July 2026).
// Shown in the checkout T&C dialog; acceptance is mandatory before payment.

export interface TermsSection {
  title: string;
  points: string[];
}

export const TERMS_AND_CONDITIONS: TermsSection[] = [
  {
    title: "1. Liability",
    points: [
      "The Dance Exclusive and its staff are not responsible for any loss, damage, or injury sustained before, during, or after classes.",
      "All students participate at their own risk. It is the responsibility of the parent/carer to ensure that their child is fit and well enough to attend class.",
    ],
  },
  {
    title: "2. Behaviour Policy",
    points: [
      "The Dance Exclusive reserves the right to remove any participant from a class without refund if they are found to be bullying, disruptive, misbehaving, or endangering themselves or others.",
      "This decision is at the discretion of the instructors and management team.",
    ],
  },
  {
    title: "3. Health & Medical Information",
    points: [
      "All medical conditions must be declared during registration.",
      "You must inform us immediately of any changes to your child's medical needs by emailing us.",
      "In the case of illness, children must be kept at home for at least 48 hours following the last symptoms of any contagious illness (e.g. sickness, fever, diarrhoea, etc.).",
    ],
  },
  {
    title: "4. Photography & Media Consent",
    points: [
      "We regularly take photographs and videos during sessions for marketing and promotional purposes (social media, website, printed material).",
      "If you do not wish for your child to be photographed or filmed, you must notify us in writing via email or phone.",
      "You may change your consent status at any time by contacting us using the provided details.",
    ],
  },
  {
    title: "5. Bookings & Payments",
    points: [
      "Your booking is only confirmed once full payment has been received.",
      "Paid bookings will be given priority; unpaid places may be offered to others.",
      "No refunds are issued for missed sessions, late arrivals, or if your child decides not to continue attending.",
      "Any deposit for ticketed events/competitions arranged by The Dance Exclusive are non-refundable.",
      "If a session is cancelled by The Dance Exclusive, we will either refund or reschedule the session.",
      "Any late payments will result in a £10 admin charge.",
    ],
  },
  {
    title: "6. Drop-Off & Pick-Up Policy",
    points: [
      "All classes and workshops are drop-off only. Parents/carers are not permitted to stay during sessions unless otherwise specified.",
      "Children must be dropped off and picked up promptly at the designated times.",
    ],
  },
  {
    title: "7. Cancellation of Memberships",
    points: [
      "A minimum of one month's notice is required in writing if you wish to cancel your membership — this is a rolling contract.",
      "For example, if notice is given on 15th November, your final payment will be due on 15th December.",
      "If a membership is cancelled without written notice, the outstanding balance will be pursued and may be referred to the Small Claims Court.",
    ],
  },
  {
    title: "8. Code of Conduct",
    points: [
      "Respect must be shown to all staff, students, and property at all times.",
      "Appropriate dancewear and footwear should be worn to all classes for safety and comfort.",
      "Mobile phones must be switched off or silenced during class.",
    ],
  },
  {
    title: "9. Adult Classes",
    points: [
      "Adult classes are non-refundable. However, you can move your class to another date if you do so at least 24 hours prior to the class start time.",
      "Multi-class passes are valid for 6 weeks from purchase (2-class passes cover classes within the same calendar week, Monday–Sunday).",
    ],
  },
];
