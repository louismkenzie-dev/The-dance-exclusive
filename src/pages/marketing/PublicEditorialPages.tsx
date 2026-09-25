import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageMeta } from "@/components/marketing/PageMeta";
import { MotionMedia } from "@/components/marketing/MotionMedia";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { defaultPublicContact } from "@/lib/publicSchool";

function EditorialPage({ title, description, eyebrow, heading, children }: {
  title: string;
  description: string;
  eyebrow: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <article className="tde-directory tde-paper tde-editorial">
      <PageMeta title={title} description={description} path={pathname} />
      <header className="tde-page-top">
        <span className="tde-eyebrow">{eyebrow}</span>
        <h1>{heading}</h1>
        <p>{description}</p>
      </header>
      {children}
    </article>
  );
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="tde-text-link" to={to}>{children}<ArrowUpRight size={18} aria-hidden /></Link>;
}

const information = [
  {
    title: "Find the right class",
    copy: "Search by age group, day or location. Each class page shows its current timetable, age guidance, venue and available booking options.",
    to: "/classes", label: "Explore classes",
  },
  {
    title: "Prices & trials",
    copy: "Prices and payment plans depend on the class. Check its booking page for the available plans and any trial option before choosing your place.",
    to: "/classes", label: "See current options",
  },
  {
    title: "Dates for your diary",
    copy: "Use the school calendar for term dates and holidays. Individual class pages show upcoming sessions, and your account holds your bookings.",
    to: "/term-dates", label: "View term dates",
  },
  {
    title: "Before your first session",
    copy: "Ask the team about suitable clothing, footwear, arrival arrangements or any support your dancer needs. Venue pages include the visitor information available for that location.",
    to: "/venues", label: "Find your venue",
  },
  {
    title: "Your bookings",
    copy: "Sign in to the account you used to book to see your classes and manage your details. Contact the team if you need help with an existing booking.",
    to: "/account/bookings", label: "Open your account",
  },
  {
    title: "Policies & questions",
    copy: "For the school's current safeguarding, privacy, cancellation or refund policies, please contact the team. Booking terms are presented during the booking journey.",
    to: "/contact", label: "Speak to the team",
  },
];

export default function PublicEditorialPages() {
  const { pathname } = useLocation();
  const { data: school } = usePublicSchool();
  const contact = school?.contact ?? defaultPublicContact;

  if (pathname === "/contact") return (
    <EditorialPage title="Get in touch" eyebrow="Start a conversation" heading={<>LET'S<br /><em>TALK DANCE.</em></>}
      description="A first class, a new challenge or something you have in mind. Get in touch with The Dance Exclusive team.">
      <div className="tde-editorial-split">
        <div className="tde-contact-links">
          <a href={`mailto:${contact.email}`}><span className="tde-eyebrow">Email the team</span><strong>{contact.email}</strong><ArrowUpRight aria-hidden /></a>
          <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}><span className="tde-eyebrow">Give us a call</span><strong>{contact.phone}</strong><ArrowUpRight aria-hidden /></a>
          <div className="tde-contact-socials">
            <a href={contact.instagram} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={18} aria-hidden /></a>
            <a href={contact.facebook} target="_blank" rel="noreferrer">Facebook <ArrowUpRight size={18} aria-hidden /></a>
          </div>
        </div>
        <div className="tde-editorial-copy">
          <h2>YOUR NEXT<br />MOVE STARTS HERE.</h2>
          <p>Looking for a class? Tell us the dancer's age, their experience and the area that works for you. We can help you find a place to start.</p>
          <TextLink to="/classes">Browse current classes</TextLink>
          <TextLink to="/parties">Plan a dance party</TextLink>
          <TextLink to="/schools">Dance at your school</TextLink>
        </div>
      </div>
    </EditorialPage>
  );

  if (pathname === "/about") return (
    <EditorialPage title="Our school" eyebrow="The Dance Exclusive · Essex" heading={<>MORE THAN<br /><em>THE MOVES.</em></>}
      description="Commercial and street dance. Confidence, creativity and a place to belong. This is The Dance Exclusive.">
      <div className="tde-editorial-split">
        <MotionMedia className="tde-editorial-photo" image="/media/tde-community.jpg" alt="The Dance Exclusive dancers together at a performance" />
        <div className="tde-editorial-copy">
          <span className="tde-eyebrow">Our school. Your people.</span>
          <h2>COME AS YOU ARE.<br />GROW FROM HERE.</h2>
          <p>Led by founder and principal Amie Whitaker, The Dance Exclusive brings commercial and street dance to children, adults and schools across Essex.</p>
          <p>Our classes make room for self-expression, teamwork and the confidence that comes from trying something new. From your first steps to performing with a crew, there is more than one way to find your movement.</p>
          <TextLink to="/classes">Find your class</TextLink>
          <TextLink to="/venues">Explore our locations</TextLink>
        </div>
      </div>
      <div className="tde-editorial-links">
        <TextLink to="/team">Meet the teaching team</TextLink>
        <TextLink to="/results">Competition teams</TextLink>
        <TextLink to="/gallery">Life at The Dance Exclusive</TextLink>
      </div>
    </EditorialPage>
  );

  if (pathname === "/schools") return (
    <EditorialPage title="Dance in schools" eyebrow="For schools & educators" heading={<>MOVE THE<br /><em>WHOLE SCHOOL.</em></>}
      description="Dance sessions that bring energy, creativity and teamwork into the school day. Across Essex, for different ages and abilities.">
      <div className="tde-editorial-split">
        <div className="tde-editorial-copy">
          <h2>MAKE ROOM<br />FOR MOVEMENT.</h2>
          <p>Build dance into your PE programme, enrichment activities or a special event. We work with schools on one-off visits and ongoing sessions, shaped around their pupils and timetable.</p>
          <p>Tell us what you are planning and we can discuss a programme for your school.</p>
          <a className="tde-button tde-button-dark" href={`mailto:${contact.email}?subject=School%20dance%20enquiry`}>Let's plan it <ArrowUpRight size={18} aria-hidden /></a>
        </div>
        <ul className="tde-editorial-list">
          {[
            ["01", "PPA cover", "Dance teaching as part of your school's provision."],
            ["02", "Clubs", "Breakfast, lunchtime and after-school sessions."],
            ["03", "Workshops", "Themed dance experiences for your pupils."],
            ["04", "Performances", "Choreography for shows, events and competitions."],
            ["05", "Teacher development", "Dance education and training for your staff."],
          ].map(([number, title, copy]) => <li key={number}><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></li>)}
        </ul>
      </div>
    </EditorialPage>
  );

  if (pathname === "/results") return (
    <EditorialPage title="Competition teams & achievements" eyebrow="Take it to the stage" heading={<>ALL THE WORK.<br /><em>ALL THE FEELING.</em></>}
      description="Training together. Performing together. Our competition teams give existing dancers a way to take their commitment further.">
      <div className="tde-editorial-split">
        <MotionMedia className="tde-editorial-photo" image="/media/tde-school.jpg" alt="The Dance Exclusive team at a dance event" />
        <div className="tde-editorial-copy">
          <h2>MOMENTS<br />TO REMEMBER.</h2>
          <ul className="tde-awards-list">
            <li><span>2025</span><strong>U14 Beginner Crew National Champions</strong></li>
            <li><span>2025</span><strong>National Entertainment Awards SEEA · Best U10 Soloist</strong></li>
            <li><span>2024</span><strong>National Entertainment Awards SEEA · Best U18 Soloist</strong></li>
            <li><span>2024</span><strong>Small Business Awards · Arts / Creative winner</strong></li>
          </ul>
          <p>Interested in the competition pathway? Speak to the team about current opportunities and the training involved.</p>
          <TextLink to="/contact">Talk to the team</TextLink>
        </div>
      </div>
    </EditorialPage>
  );

  if (pathname === "/gallery") return (
    <EditorialPage title="Life at The Dance Exclusive" eyebrow="In the moment" heading={<>FEEL THE<br /><em>ENERGY.</em></>}
      description="A glimpse of the people, performances and shared moments that make The Dance Exclusive.">
      <figure className="tde-gallery-film">
        <video controls playsInline muted preload="none" poster="/media/tde-film-poster.jpg" aria-label="The Dance Exclusive group dance performance, silent film">
          <source src="/media/tde-hero-film.mp4" type="video/mp4" />
        </video>
        <figcaption>In performance · The Dance Exclusive. Silent film.</figcaption>
      </figure>
      <div className="tde-gallery-grid">
        <figure><img src="/media/tde-community.jpg" alt="The Dance Exclusive dancers gathered together at a performance" loading="lazy" width="900" height="900" /><figcaption>Our people.</figcaption></figure>
        <figure><img src="/media/tde-school.jpg" alt="The Dance Exclusive team celebrating at a dance event" loading="lazy" width="900" height="900" /><figcaption>Shared moments.</figcaption></figure>
      </div>
      <TextLink to="/classes">Be part of it</TextLink>
    </EditorialPage>
  );

  return (
    <EditorialPage title="Useful information for dancers & parents" eyebrow="Before you join us" heading={<>READY FOR<br /><em>YOUR FIRST MOVE?</em></>}
      description="A few useful starting points for dancers and parents. Everything you need to find your class and feel prepared.">
      <div className="tde-information-grid">
        {information.map((item, index) => <section key={item.title}><span className="tde-eyebrow">0{index + 1}</span><h2>{item.title}</h2><p>{item.copy}</p><TextLink to={item.to}>{item.label}</TextLink></section>)}
      </div>
    </EditorialPage>
  );
}
