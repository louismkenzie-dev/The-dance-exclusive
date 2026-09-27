# Customer journey integration
Mode: Operate. Extend the approved public V2 identity across customer booking, timetable, basket, checkout, confirmation, account, authentication and recovery. Preserve all real booking, pricing, eligibility, attendee and payment logic. Admin and staff management are outside this customer-facing scope.

THESIS: One recognisable TDE journey from discovery through payment and returning to class.
OWN-WORLD: Existing crown wordmark, #48b5dd blue, #080e16 ink, ruled frames. Adult pink only on adult content. Same public header; quiet footer on task pages and focused checkout. Condensed type for page titles; Inter for controls, dates, amounts and forms.
STORY: Discover -> choose class/date/attendee -> basket -> pay -> confirmation -> bookings/calendar/account.
FIRST VIEWPORT: Shared blue header and compact product navigation lead directly to useful booking content on dark panels. Mobile uses native scrolling, 16px input text, reachable controls and one bottom action/navigation bar at a time.
FORM: Preserve established layouts; semantic theme tokens reach body-portalled dialogs and Stripe appearance. No ornamental loading motion in task screens. Existing schedules, availability, terms, prices and account actions remain intact.
FINISH: Independent screenshot/code review, focused interaction tests, production build and preview verification. No live payment submission or production release.

Continuation: navigation now follows authentication state across public and product pages, and the basket remains accessible throughout customer discovery. Signed-out calendar booking actions open the existing class-page authentication dialog; old /book URLs retain query and booking anchor. Camp, pass and basket sign-in preserve their next destination. This changes handoffs, not the visual world or payment/eligibility rules. Cross-domain live-session behavior is a separate launch requirement recorded in PRODUCT.md; production remains unchanged.
